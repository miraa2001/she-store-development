import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuthProfile } from "../hooks/useAuthProfile";
import { getOrdersNavItems, isNavHrefActive } from "../lib/navigation";
import { formatILS, parsePrice } from "../lib/orders";
import { signOutAndRedirect } from "../lib/session";
import { sb } from "../lib/supabaseClient";
import SessionLoader from "../components/common/SessionLoader";
import "./archive-page.css";

const IMAGE_BUCKET = "purchase-images";

function cleanupMessage(kind, count = 0) {
  if (kind === "none") return "لا يوجد صور للحذف.";
  if (kind === "start") return `جاري حذف ${count} صورة من التخزين...`;
  if (kind === "done") return `تم حذف ${count} صورة من التخزين.`;
  if (kind === "storage-error") return "تعذر حذف بعض الصور من التخزين.";
  if (kind === "db-error") return "تم حذف الصور من التخزين، لكن حدث خطأ في قاعدة البيانات.";
  return "";
}

export default function ArchivePage() {
  const { profile } = useAuthProfile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cleanupMsg, setCleanupMsg] = useState("");
  const location = useLocation();
  const sidebarLinks = useMemo(() => getOrdersNavItems(profile.role), [profile.role]);

  const selectedOrder = useMemo(
    () => orders.find((order) => String(order.id) === String(selectedOrderId)) || null,
    [orders, selectedOrderId]
  );

  const totalArchivedPaid = useMemo(
    () => orders.reduce((sum, order) => sum + (order.totalPaid || 0), 0),
    [orders]
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const cleanupArchiveImages = useCallback(async (archivedOrders) => {
    const allPaths = [];
    archivedOrders.forEach((order) => {
      (order.purchases || []).forEach((purchase) => {
        (purchase.purchase_images || []).forEach((img) => {
          if (img?.storage_path) allPaths.push(img.storage_path);
        });
      });
    });

    const uniquePaths = Array.from(new Set(allPaths));
    if (!uniquePaths.length) {
      setCleanupMsg(cleanupMessage("none"));
      return;
    }

    setCleanupMsg(cleanupMessage("start", uniquePaths.length));

    const storageChunk = 100;
    for (let i = 0; i < uniquePaths.length; i += storageChunk) {
      const chunk = uniquePaths.slice(i, i + storageChunk);
      const { error: storageError } = await sb.storage.from(IMAGE_BUCKET).remove(chunk);
      if (storageError) {
        console.error(storageError);
        setCleanupMsg(cleanupMessage("storage-error"));
        return;
      }
    }

    const dbChunk = 500;
    for (let i = 0; i < uniquePaths.length; i += dbChunk) {
      const chunk = uniquePaths.slice(i, i + dbChunk);
      const { error: dbError } = await sb.from("purchase_images").delete().in("storage_path", chunk);
      if (dbError) {
        console.error(dbError);
        setCleanupMsg(cleanupMessage("db-error"));
        return;
      }
    }

    setCleanupMsg(cleanupMessage("done", uniquePaths.length));
  }, []);

  const loadArchive = useCallback(async () => {
    setLoading(true);
    setError("");
    setCleanupMsg("");

    try {
      const { data: purchaseRows, error: purchaseError } = await sb
        .from("purchases")
        .select(
          "id, order_id, customer_name, price, paid_price, pickup_point, collected, purchase_images(id, storage_path)"
        )
        .order("created_at", { ascending: false });

      if (purchaseError) throw purchaseError;

      const byOrder = new Map();
      (purchaseRows || []).forEach((purchase) => {
        if (!byOrder.has(purchase.order_id)) {
          byOrder.set(purchase.order_id, { allCollected: true, purchases: [] });
        }
        const entry = byOrder.get(purchase.order_id);
        if (!purchase.collected) entry.allCollected = false;
        entry.purchases.push(purchase);
      });

      const archivedOrderIds = [];
      byOrder.forEach((entry, orderId) => {
        if (entry.purchases.length && entry.allCollected) {
          archivedOrderIds.push(orderId);
        }
      });

      if (!archivedOrderIds.length) {
        setOrders([]);
        setSelectedOrderId("");
        setCleanupMsg("لا يوجد أرشيف بعد.");
        return;
      }

      const { data: orderRows, error: orderError } = await sb
        .from("orders")
        .select("id, order_name, created_at")
        .in("id", archivedOrderIds)
        .order("created_at", { ascending: false });

      if (orderError) throw orderError;

      const archivedOrders = (orderRows || []).map((order) => {
        const entry = byOrder.get(order.id);
        const purchases = entry?.purchases || [];
        const totalPaid = purchases.reduce(
          (sum, purchase) => sum + parsePrice(purchase.paid_price ?? purchase.price),
          0
        );
        return {
          id: order.id,
          orderName: order.order_name || "",
          createdAt: order.created_at,
          purchases,
          totalPaid
        };
      });

      setOrders(archivedOrders);
      setSelectedOrderId((prev) => {
        if (prev && archivedOrders.some((order) => String(order.id) === String(prev))) return prev;
        return archivedOrders[0]?.id || "";
      });

      await cleanupArchiveImages(archivedOrders);
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل الأرشيف.");
    } finally {
      setLoading(false);
    }
  }, [cleanupArchiveImages]);

  useEffect(() => {
    if (profile.loading || !profile.authenticated) return;
    if (profile.role !== "rahaf") return;
    loadArchive();
  }, [loadArchive, profile.authenticated, profile.loading, profile.role]);

  async function signOut() {
    await signOutAndRedirect();
  }

  if (profile.loading) {
    return (
      <div className="archive-page archive-state" dir="rtl">
        <SessionLoader />
      </div>
    );
  }

  if (!profile.authenticated) {
    return (
      <div className="archive-page archive-state" dir="rtl">
        <div className="archive-note archive-note-danger">
          <h2>لا توجد جلسة نشطة</h2>
          <p>يلزم تسجيل الدخول أولًا.</p>
          <a href="#/login" className="archive-link">
            فتح تسجيل الدخول
          </a>
        </div>
      </div>
    );
  }

  if (profile.role !== "rahaf") {
    return (
      <div className="archive-page archive-state" dir="rtl">
        <div className="archive-note archive-note-danger">
          <h2>لا توجد صلاحية</h2>
          <p>هذه الصفحة متاحة لحساب رهف فقط.</p>
          <a href="#/orders" className="archive-link">
            العودة للطلبات
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="archive-page" dir="rtl">
      <div
        className={`archive-overlay app-sidebar-overlay ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`archive-sidebar app-sidebar-drawer ${sidebarOpen ? "open" : ""}`}>
        <div className="archive-sidebar-head app-sidebar-head">
          <b>القائمة</b>
          <button
            type="button"
            className="archive-menu-btn danger app-sidebar-close"
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>
            </div>
            <div className="archive-sidebar-content app-sidebar-content">
              {sidebarLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={`app-sidebar-link ${isNavHrefActive(item.href, location) ? "active" : ""}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <button type="button" className="danger app-sidebar-link app-sidebar-danger" onClick={signOut}>
                تسجيل خروج
              </button>
        </div>
      </aside>

      <div className="archive-wrap">
        <div className="archive-topbar">
          <div className="archive-brand">
            <b>الأرشيف</b>
            <div className="archive-muted">الطلبات المحصلة بالكامل</div>
          </div>
          <button type="button" className="archive-menu-btn" onClick={() => setSidebarOpen(true)}>
            ☰
          </button>
        </div>

        <div className="archive-grid">
          <aside className="archive-card archive-list-card">
            <div className="archive-row">
              <b>الطلبيات</b>
              <div className="archive-orders-meta">
                <span className="archive-pill">{orders.length}</span>
                <span className="archive-pill">إجمالي التحصيل: {formatILS(totalArchivedPaid)} ₪</span>
              </div>
            </div>
            {cleanupMsg ? <div className="archive-cleanup-msg">{cleanupMsg}</div> : null}

            {loading ? <div className="archive-muted archive-spacer">جاري تحميل البيانات...</div> : null}
            {error ? <div className="archive-error archive-spacer">{error}</div> : null}

            {!loading && !error && !orders.length ? (
              <div className="archive-muted archive-spacer">
                لا يوجد بيانات
                <div className="archive-refresh-row">
                  <button className="archive-btn" type="button" onClick={loadArchive}>
                    تحديث
                  </button>
                </div>
              </div>
            ) : null}

            {!loading && !error && orders.length ? (
              <div className="archive-orders-list">
                {orders.map((order) => {
                  const active = String(selectedOrderId) === String(order.id);
                  return (
                    <button
                      key={order.id}
                      type="button"
                      className={`archive-order-item ${active ? "active" : ""}`}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <span>{order.orderName}</span>
                      <div className="archive-orders-meta">
                        <span className="archive-pill">{order.purchases.length}</span>
                        <span className="archive-pill">{formatILS(order.totalPaid)} ₪</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </aside>

          <main className="archive-card">
            {!selectedOrder ? (
              <div className="archive-muted archive-spacer">
                لا يوجد بيانات
                <div className="archive-refresh-row">
                  <button className="archive-btn" type="button" onClick={loadArchive}>
                    تحديث
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="archive-row">
                  <b>{selectedOrder.orderName}</b>
                  <div className="archive-row">
                    <span className="archive-pill">عدد المشتريات: {selectedOrder.purchases.length}</span>
                    <span className="archive-pill">المجموع الكلي: {formatILS(selectedOrder.totalPaid)} ₪</span>
                  </div>
                </div>

                <hr className="archive-divider" />

                <div className="archive-table-wrap">
                  <table className="archive-table">
                    <thead>
                      <tr>
                        <th>الزبون</th>
                        <th>المكان</th>
                        <th>السعر</th>
                        <th>المدفوع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.purchases.length ? (
                        selectedOrder.purchases.map((purchase) => (
                          <tr key={purchase.id}>
                            <td>{purchase.customer_name || ""}</td>
                            <td>{purchase.pickup_point || ""}</td>
                            <td>{purchase.price ?? ""}</td>
                            <td>{purchase.paid_price ?? "—"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="archive-muted">
                            لا يوجد مشتريات
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
