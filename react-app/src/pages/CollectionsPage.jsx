import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthProfile } from "../hooks/useAuthProfile";
import { getPickupSidebarLinks } from "../lib/navigation";
import { formatILS, parsePrice } from "../lib/orders";
import { signOutAndRedirect } from "../lib/session";
import { sb } from "../lib/supabaseClient";
import "./collections-page.css";

const HOME_PICKUP_VALUE = "من البيت";
const PICKUP_VALUE = "من نقطة الاستلام";

export default function CollectionsPage({ embedded = false }) {
  const { profile } = useAuthProfile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState("");
  const [homeList, setHomeList] = useState([]);
  const [pickupList, setPickupList] = useState([]);
  const sidebarLinks = useMemo(() => getPickupSidebarLinks(profile.role), [profile.role]);

  const selectedOrder = useMemo(
    () => orders.find((order) => String(order.id) === String(selectedOrderId)) || null,
    [orders, selectedOrderId]
  );

  const overallCollected = useMemo(
    () => orders.reduce((sum, order) => sum + order.collectedTotal, 0),
    [orders]
  );

  const homeTotal = useMemo(
    () => homeList.reduce((sum, item) => sum + parsePrice(item.paid_price ?? item.price), 0),
    [homeList]
  );

  const pickupTotal = useMemo(
    () => pickupList.reduce((sum, item) => sum + parsePrice(item.paid_price ?? item.price), 0),
    [pickupList]
  );

  const grandTotal = homeTotal + pickupTotal;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    setError("");
    try {
      const { data, error: ordersError } = await sb
        .from("orders")
        .select(
          "id, order_name, created_at, purchases!inner(id, pickup_point, collected, paid_price, price)"
        )
        .eq("arrived", true)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      const filtered = (data || [])
        .filter((order) => {
          const list = order.purchases || [];
          return (
            list.some((p) => p.pickup_point === HOME_PICKUP_VALUE && p.collected) ||
            list.some((p) => p.pickup_point === PICKUP_VALUE && p.collected)
          );
        })
        .map((order) => {
          const collectedTotal = (order.purchases || []).reduce((sum, purchase) => {
            if (!purchase.collected) return sum;
            return sum + parsePrice(purchase.paid_price ?? purchase.price);
          }, 0);
          return {
            id: order.id,
            orderName: order.order_name || "",
            createdAt: order.created_at,
            collectedTotal
          };
        });

      setOrders(filtered);
      setSelectedOrderId((prev) => {
        if (prev && filtered.some((order) => String(order.id) === String(prev))) return prev;
        return filtered[0]?.id || "";
      });
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل الطلبات.");
      setOrders([]);
      setSelectedOrderId("");
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const loadOrderCollections = useCallback(async (orderId) => {
    if (!orderId) {
      setHomeList([]);
      setPickupList([]);
      return;
    }

    setLoadingDetails(true);
    setError("");
    try {
      const { data, error: purchasesError } = await sb
        .from("purchases")
        .select("id, customer_name, price, paid_price, pickup_point, collected")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      if (purchasesError) throw purchasesError;

      const list = data || [];
      setHomeList(list.filter((purchase) => purchase.pickup_point === HOME_PICKUP_VALUE && purchase.collected));
      setPickupList(list.filter((purchase) => purchase.pickup_point === PICKUP_VALUE && purchase.collected));
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل بيانات التحصيل.");
      setHomeList([]);
      setPickupList([]);
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    if (profile.loading || !profile.authenticated) return;
    if (profile.role !== "rahaf") return;
    loadOrders();
  }, [loadOrders, profile.authenticated, profile.loading, profile.role]);

  useEffect(() => {
    if (!selectedOrderId || profile.role !== "rahaf") return;
    loadOrderCollections(selectedOrderId);
  }, [loadOrderCollections, profile.role, selectedOrderId]);

  async function signOut() {
    await signOutAndRedirect();
  }

  if (profile.loading) {
    return (
      <div className="collections-page collections-state" dir="rtl">
        <div className="collections-note">جاري التحقق من الجلسة...</div>
      </div>
    );
  }

  if (!profile.authenticated) {
    return (
      <div className="collections-page collections-state" dir="rtl">
        <div className="collections-note collections-note-danger">
          <h2>لا توجد جلسة نشطة</h2>
          <p>يلزم تسجيل الدخول أولًا.</p>
          <a href="#/login" className="collections-link">
            فتح تسجيل الدخول
          </a>
        </div>
      </div>
    );
  }

  if (profile.role !== "rahaf") {
    return (
      <div className="collections-page collections-state" dir="rtl">
        <div className="collections-note collections-note-danger">
          <h2>لا توجد صلاحية</h2>
          <p>هذه الصفحة متاحة لحساب رهف فقط.</p>
          <a href="#/orders" className="collections-link">
            العودة للطلبات
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`collections-page ${embedded ? "embedded" : ""}`} dir="rtl">
      {!embedded ? (
        <>
          <div className={`collections-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />
          <aside className={`collections-sidebar ${sidebarOpen ? "open" : ""}`}>
            <div className="collections-sidebar-head">
              <b>القائمة</b>
              <button type="button" className="collections-menu-btn danger" onClick={() => setSidebarOpen(false)}>
                ✕
              </button>
            </div>
            <div className="collections-sidebar-content">
              {sidebarLinks.map((item) => (
                <a key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}>
                  {item.label}
                </a>
              ))}
              <button type="button" className="danger" onClick={signOut}>
                تسجيل خروج
              </button>
            </div>
          </aside>
        </>
      ) : null}
      <div className="collections-wrap">
        {!embedded ? (
          <div className="collections-topbar">
            <div className="collections-brand">
              <b>تحصيل المبالغ</b>
              <div className="collections-muted">الطلبات المحصلة</div>
            </div>
            <button type="button" className="collections-menu-btn" onClick={() => setSidebarOpen(true)}>
              ☰
            </button>
          </div>
        ) : null}

        <div className="collections-grid">
          <aside className="collections-card collections-list-card">
            <div className="collections-row">
              <b>الطلبيات</b>
              <div className="collections-orders-meta">
                <span className="collections-pill">{orders.length}</span>
                <span className="collections-pill">إجمالي التحصيل: {formatILS(overallCollected)} ₪</span>
              </div>
            </div>

            {loadingOrders ? <div className="collections-muted collections-spacer">جاري تحميل البيانات...</div> : null}
            {error ? <div className="collections-error collections-spacer">{error}</div> : null}

            {!loadingOrders && !error && !orders.length ? (
              <div className="collections-muted collections-spacer">
                لا يوجد بيانات
                <div className="collections-refresh-row">
                  <button className="collections-btn" type="button" onClick={loadOrders}>
                    تحديث
                  </button>
                </div>
              </div>
            ) : null}

            {!loadingOrders && !error && orders.length ? (
              <div className="collections-orders-list">
                {orders.map((order) => {
                  const active = String(selectedOrderId) === String(order.id);
                  return (
                    <button
                      key={order.id}
                      type="button"
                      className={`collections-order-item ${active ? "active" : ""}`}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <span>{order.orderName}</span>
                      <span className="collections-pill">فتح</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </aside>

          <main className="collections-card">
            {!selectedOrder ? (
              <div className="collections-muted collections-spacer">
                لا يوجد بيانات
                <div className="collections-refresh-row">
                  <button className="collections-btn" type="button" onClick={loadOrders}>
                    تحديث
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="collections-row">
                  <div>
                    <b>{selectedOrder.orderName}</b>
                    <span className="collections-status-badge">تم التحصيل</span>
                  </div>
                  <div className="collections-row">
                    <span className="collections-pill">عدد المشتريات: {homeList.length + pickupList.length}</span>
                    <span className="collections-pill">مجموع البيت: {formatILS(homeTotal)} ₪</span>
                    <span className="collections-pill">مجموع نقطة الاستلام: {formatILS(pickupTotal)} ₪</span>
                    <span className="collections-pill">المجموع الكلي: {formatILS(grandTotal)} ₪</span>
                  </div>
                </div>

                {loadingDetails ? <div className="collections-muted collections-spacer">جاري تحميل تفاصيل التحصيل...</div> : null}

                {!loadingDetails ? (
                  <>
                    <div className="collections-section-title">مستلمو البيت</div>
                    <div className="collections-table-wrap">
                      <table className="collections-table">
                        <thead>
                          <tr>
                            <th>الزبون</th>
                            <th>السعر</th>
                          </tr>
                        </thead>
                        <tbody>
                          {homeList.length ? (
                            homeList.map((purchase) => (
                              <tr key={purchase.id}>
                                <td>{purchase.customer_name || ""}</td>
                                <td>{formatILS(purchase.paid_price ?? purchase.price)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={2} className="collections-muted">
                                لا يوجد مشتريات
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="collections-section-title">نقطة الاستلام - La Aura</div>
                    <div className="collections-table-wrap">
                      <table className="collections-table">
                        <thead>
                          <tr>
                            <th>الزبون</th>
                            <th>السعر</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pickupList.length ? (
                            pickupList.map((purchase) => (
                              <tr key={purchase.id}>
                                <td>{purchase.customer_name || ""}</td>
                                <td>{formatILS(purchase.paid_price ?? purchase.price)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={2} className="collections-muted">
                                لا يوجد مشتريات
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
