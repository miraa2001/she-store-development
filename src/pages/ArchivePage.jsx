import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuthProfile } from "../hooks/useAuthProfile";
import { formatILS, isOlderThanCurrentMonth, parsePrice } from "../lib/orders";
import { getOrdersNavItems, isNavHrefActive } from "../lib/navigation";
import { signOutAndRedirect } from "../lib/session";
import { sb } from "../lib/supabaseClient";
import SessionLoader from "../components/common/SessionLoader";
import "./archive-page.css";

const IMAGE_BUCKET = "purchase-images";
const TAB_COLLECTED = "collected";
const TAB_PREVIOUS = "previous";

function cleanupMessage(kind, count = 0) {
  if (kind === "none") return "لا يوجد صور للحذف.";
  if (kind === "start") return `جاري حذف ${count} صورة من التخزين...`;
  if (kind === "done") return `تم حذف ${count} صورة من التخزين.`;
  if (kind === "storage-error") return "تعذر حذف بعض الصور من التخزين.";
  if (kind === "db-error") return "تم حذف الصور من التخزين، لكن حدث خطأ في قاعدة البيانات.";
  return "";
}

function orderTitle(tab) {
  return tab === TAB_COLLECTED ? "طلبات تم تحصيلها" : "طلبات سابقة";
}

function formatOrderDate(iso) {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("ar", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function pickSelectedId(currentId, list) {
  if (currentId && list.some((item) => String(item.id) === String(currentId))) return currentId;
  return list[0]?.id || "";
}

export default function ArchivePage() {
  const { profile } = useAuthProfile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [archiveTab, setArchiveTab] = useState(TAB_COLLECTED);
  const [collectedOrders, setCollectedOrders] = useState([]);
  const [previousOrders, setPreviousOrders] = useState([]);
  const [selectedOrderByTab, setSelectedOrderByTab] = useState({
    [TAB_COLLECTED]: "",
    [TAB_PREVIOUS]: ""
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cleanupMsg, setCleanupMsg] = useState("");
  const location = useLocation();
  const sidebarLinks = useMemo(() => getOrdersNavItems(profile.role), [profile.role]);

  const activeOrders = useMemo(
    () => (archiveTab === TAB_COLLECTED ? collectedOrders : previousOrders),
    [archiveTab, collectedOrders, previousOrders]
  );

  const selectedOrder = useMemo(() => {
    const selectedId = selectedOrderByTab[archiveTab];
    return activeOrders.find((order) => String(order.id) === String(selectedId)) || null;
  }, [activeOrders, archiveTab, selectedOrderByTab]);

  const totalActivePaid = useMemo(
    () => activeOrders.reduce((sum, order) => sum + (order.totalPaid || 0), 0),
    [activeOrders]
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setSelectedOrderByTab((prev) => {
      const nextId = pickSelectedId(prev[archiveTab], activeOrders);
      if (prev[archiveTab] === nextId) return prev;
      return { ...prev, [archiveTab]: nextId };
    });
  }, [activeOrders, archiveTab]);

  const cleanupArchiveImages = useCallback(async (ordersToCleanup) => {
    const allPaths = [];
    ordersToCleanup.forEach((order) => {
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
    for (let index = 0; index < uniquePaths.length; index += storageChunk) {
      const chunk = uniquePaths.slice(index, index + storageChunk);
      const { error: storageError } = await sb.storage.from(IMAGE_BUCKET).remove(chunk);
      if (storageError) {
        console.error(storageError);
        setCleanupMsg(cleanupMessage("storage-error"));
        return;
      }
    }

    const dbChunk = 500;
    for (let index = 0; index < uniquePaths.length; index += dbChunk) {
      const chunk = uniquePaths.slice(index, index + dbChunk);
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

      const purchasesByOrder = new Map();
      (purchaseRows || []).forEach((purchase) => {
        if (!purchasesByOrder.has(purchase.order_id)) {
          purchasesByOrder.set(purchase.order_id, { allCollected: true, purchases: [] });
        }
        const entry = purchasesByOrder.get(purchase.order_id);
        if (!purchase.collected) entry.allCollected = false;
        entry.purchases.push(purchase);
      });

      const { data: orderRows, error: orderError } = await sb
        .from("orders")
        .select("id, order_name, created_at")
        .order("created_at", { ascending: false });

      if (orderError) throw orderError;

      const nextCollected = [];
      const nextPrevious = [];

      (orderRows || []).forEach((order) => {
        const entry = purchasesByOrder.get(order.id);
        const purchases = entry?.purchases || [];
        const allCollected = purchases.length > 0 && entry?.allCollected;
        const previousMonth = isOlderThanCurrentMonth(order.created_at);

        if (!allCollected && !previousMonth) return;

        const normalized = {
          id: order.id,
          orderName: String(order.order_name || "").trim() || "طلب بدون اسم",
          createdAt: order.created_at,
          purchases,
          totalPaid: purchases.reduce(
            (sum, purchase) => sum + parsePrice(purchase.paid_price ?? purchase.price),
            0
          )
        };

        if (allCollected) nextCollected.push(normalized);
        if (previousMonth && !allCollected) nextPrevious.push(normalized);
      });

      setCollectedOrders(nextCollected);
      setPreviousOrders(nextPrevious);
      setArchiveTab((prev) => {
        if (prev === TAB_COLLECTED && !nextCollected.length && nextPrevious.length) return TAB_PREVIOUS;
        if (prev === TAB_PREVIOUS && !nextPrevious.length && nextCollected.length) return TAB_COLLECTED;
        return prev;
      });
      setSelectedOrderByTab((prev) => ({
        [TAB_COLLECTED]: pickSelectedId(prev[TAB_COLLECTED], nextCollected),
        [TAB_PREVIOUS]: pickSelectedId(prev[TAB_PREVIOUS], nextPrevious)
      }));

      if (!nextCollected.length && !nextPrevious.length) {
        setCleanupMsg("لا يوجد أرشيف بعد.");
      } else if (nextCollected.length) {
        await cleanupArchiveImages(nextCollected);
      } else {
        setCleanupMsg("");
      }
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
            <div className="archive-muted">طلبات تم تحصيلها + طلبات أقدم من الشهر الحالي</div>
          </div>
          <button type="button" className="archive-menu-btn" onClick={() => setSidebarOpen(true)}>
            ☰
          </button>
        </div>

        <div className="archive-grid">
          <aside className="archive-card archive-list-card">
            <div className="archive-tabs" role="tablist" aria-label="تصنيفات الأرشيف">
              <button
                type="button"
                role="tab"
                aria-selected={archiveTab === TAB_COLLECTED}
                className={`archive-tab ${archiveTab === TAB_COLLECTED ? "active" : ""}`}
                onClick={() => setArchiveTab(TAB_COLLECTED)}
              >
                طلبات تم تحصيلها
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={archiveTab === TAB_PREVIOUS}
                className={`archive-tab ${archiveTab === TAB_PREVIOUS ? "active" : ""}`}
                onClick={() => setArchiveTab(TAB_PREVIOUS)}
              >
                طلبات سابقة
              </button>
            </div>

            <div className="archive-row">
              <b>{orderTitle(archiveTab)}</b>
              <div className="archive-orders-meta">
                <span className="archive-pill">{activeOrders.length}</span>
                <span className="archive-pill">إجمالي التحصيل: {formatILS(totalActivePaid)} ₪</span>
              </div>
            </div>

            {cleanupMsg ? <div className="archive-cleanup-msg">{cleanupMsg}</div> : null}

            {loading ? <div className="archive-muted archive-spacer">جاري تحميل البيانات...</div> : null}
            {error ? <div className="archive-error archive-spacer">{error}</div> : null}

            {!loading && !error && !activeOrders.length ? (
              <div className="archive-muted archive-spacer">
                لا يوجد بيانات في هذا التصنيف
                <div className="archive-refresh-row">
                  <button className="archive-btn" type="button" onClick={loadArchive}>
                    تحديث
                  </button>
                </div>
              </div>
            ) : null}

            {!loading && !error && activeOrders.length ? (
              <div className="archive-orders-list">
                {activeOrders.map((order) => {
                  const active =
                    String(selectedOrderByTab[archiveTab] || "") === String(order.id || "");
                  return (
                    <button
                      key={order.id}
                      type="button"
                      className={`archive-order-item ${active ? "active" : ""}`}
                      onClick={() =>
                        setSelectedOrderByTab((prev) => ({ ...prev, [archiveTab]: order.id }))
                      }
                    >
                      <div className="archive-order-main">
                        <span>{order.orderName}</span>
                        <small>{formatOrderDate(order.createdAt)}</small>
                      </div>
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
                  <div>
                    <b>{selectedOrder.orderName}</b>
                    <div className="archive-muted">{formatOrderDate(selectedOrder.createdAt)}</div>
                  </div>
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
