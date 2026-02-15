import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime } from "../lib/dateFormat";
import { useAuthProfile } from "../hooks/useAuthProfile";
import { usePurchaseCustomerSearch } from "../hooks/usePurchaseCustomerSearch";
import { getPickupSidebarLinks } from "../lib/navigation";
import { formatILS, parsePrice } from "../lib/orders";
import { buildCollectedMoneyMessage, buildPickupStatusMessage, notifyPickupStatus } from "../lib/pickupNotifications";
import { PICKUP_HOME } from "../lib/pickup";
import { signOutAndRedirect } from "../lib/session";
import { sb } from "../lib/supabaseClient";
import SessionLoader from "../components/common/SessionLoader";
import "./homepickup-page.css";

const BUCKET = "purchase-images";
export default function HomePickupPage({ embedded = false }) {
  const { profile } = useAuthProfile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [purchases, setPurchases] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [error, setError] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightPurchaseId, setHighlightPurchaseId] = useState("");
  const [paidEditor, setPaidEditor] = useState({ id: "", value: "", saving: false });
  const [lightbox, setLightbox] = useState({ open: false, images: [], index: 0, label: "" });
  const sidebarLinks = useMemo(() => getPickupSidebarLinks(profile.role), [profile.role]);
  const highlightTimeoutRef = useRef(null);
  const { searchResults, searchLoading, clearSearchResults } = usePurchaseCustomerSearch({
    search,
    orders,
    queryBuilder: (request) => request.eq("pickup_point", PICKUP_HOME)
  });

  const isRahaf = profile.role === "rahaf";
  const isReemOrRawand = profile.role === "reem" || profile.role === "rawand";

  const selectedOrder = useMemo(
    () => orders.find((order) => String(order.id) === String(selectedOrderId)) || null,
    [orders, selectedOrderId]
  );

  const visiblePurchases = useMemo(() => purchases.filter((purchase) => !purchase.collected), [purchases]);
  const pickedTotal = useMemo(
    () =>
      visiblePurchases
        .filter((purchase) => purchase.picked_up)
        .reduce((sum, purchase) => sum + parsePrice(purchase.paid_price ?? purchase.price), 0),
    [visiblePurchases]
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
        setLightbox((prev) => ({ ...prev, open: false }));
      }
      if (!lightbox.open || !lightbox.images.length) return;
      if (event.key === "ArrowLeft") {
        setLightbox((prev) => ({
          ...prev,
          index: (prev.index - 1 + prev.images.length) % prev.images.length
        }));
      }
      if (event.key === "ArrowRight") {
        setLightbox((prev) => ({
          ...prev,
          index: (prev.index + 1) % prev.images.length
        }));
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [lightbox.images.length, lightbox.open]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    setError("");

    try {
      const { data: pickupRows, error: pickupError } = await sb
        .from("purchases")
        .select("order_id, pickup_point, collected")
        .eq("pickup_point", PICKUP_HOME)
        .eq("collected", false);

      if (pickupError) throw pickupError;

      const orderIds = Array.from(new Set((pickupRows || []).map((row) => row.order_id)));
      if (!orderIds.length) {
        setOrders([]);
        setSelectedOrderId("");
        setPurchases([]);
        return;
      }

      const { data: orderRows, error: orderError } = await sb
        .from("orders")
        .select("id, order_name, created_at")
        .in("id", orderIds)
        .eq("arrived", true)
        .order("created_at", { ascending: false });

      if (orderError) throw orderError;

      const nextOrders = (orderRows || []).map((order) => ({
        id: order.id,
        orderName: order.order_name || "",
        createdAt: order.created_at
      }));

      setOrders(nextOrders);
      setSelectedOrderId((prev) => {
        if (prev && nextOrders.some((order) => String(order.id) === String(prev))) return prev;
        return nextOrders[0]?.id || "";
      });
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل الطلبات.");
      setOrders([]);
      setSelectedOrderId("");
      setPurchases([]);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const loadPurchases = useCallback(async (orderId) => {
    if (!orderId) {
      setPurchases([]);
      return;
    }

    setLoadingPurchases(true);
    setError("");
    try {
      const { data, error: purchasesError } = await sb
        .from("purchases")
        .select(
          "id, customer_name, price, paid_price, picked_up, picked_up_at, pickup_point, collected, purchase_images(storage_path)"
        )
        .eq("order_id", orderId)
        .eq("pickup_point", PICKUP_HOME)
        .eq("collected", false)
        .order("created_at", { ascending: true });

      if (purchasesError) throw purchasesError;

      const mapped = (data || []).map((purchase) => ({
        ...purchase,
        images: (purchase.purchase_images || []).map((img) => {
          const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(img.storage_path);
          return urlData?.publicUrl || "";
        })
      }));

      setPurchases(mapped);
      setPaidEditor({ id: "", value: "", saving: false });
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل مشتريات الطلب.");
      setPurchases([]);
    } finally {
      setLoadingPurchases(false);
    }
  }, []);

  useEffect(() => {
    if (profile.loading || !profile.authenticated) return;
    if (!isRahaf && !isReemOrRawand) return;
    loadOrders();
  }, [isRahaf, isReemOrRawand, loadOrders, profile.authenticated, profile.loading]);

  useEffect(() => {
    if (!selectedOrderId || (!isRahaf && !isReemOrRawand)) return;
    loadPurchases(selectedOrderId);
  }, [isRahaf, isReemOrRawand, loadPurchases, selectedOrderId]);

  async function signOut() {
    await signOutAndRedirect();
  }

  async function togglePicked(purchaseId, checked) {
    const target = purchases.find((item) => String(item.id) === String(purchaseId));
    const payload = checked
      ? { picked_up: true, picked_up_at: new Date().toISOString() }
      : { picked_up: false, picked_up_at: null };

    setPurchases((prev) =>
      prev.map((item) => (String(item.id) === String(purchaseId) ? { ...item, ...payload } : item))
    );

    const { error: updateError } = await sb.from("purchases").update(payload).eq("id", purchaseId);
    if (updateError) {
      console.error(updateError);
      await loadPurchases(selectedOrderId);
      return;
    }

    if (target) {
      await notifyPickupStatus(
        buildPickupStatusMessage({
          picked: payload.picked_up,
          customerName: target.customer_name,
          price: target.price,
          pickupLabel: PICKUP_HOME
        })
      );
    }
  }

  async function collectHomeMoney() {
    if (!isRahaf || !selectedOrderId) return;
    const pending = visiblePurchases.filter((purchase) => purchase.picked_up && !purchase.collected);
    if (!pending.length) return;

    const pendingTotal = pending.reduce(
      (sum, purchase) => sum + parsePrice(purchase.paid_price ?? purchase.price),
      0
    );
    const pendingText = formatILS(pendingTotal);
    const ok = window.confirm(`تأكيد تحصيل ${pending.length} مشتريات بمبلغ ${pendingText} ₪؟`);
    if (!ok) return;

    setCollecting(true);
    const { error: collectError } = await sb
      .from("purchases")
      .update({ collected: true, collected_at: new Date().toISOString() })
      .eq("order_id", selectedOrderId)
      .eq("pickup_point", PICKUP_HOME)
      .eq("picked_up", true);

    if (collectError) {
      console.error(collectError);
      setCollecting(false);
      return;
    }
    await notifyPickupStatus(
      buildCollectedMoneyMessage({ pickupLabel: PICKUP_HOME, amountText: pendingText })
    );
    await loadPurchases(selectedOrderId);
    await loadOrders();
    setCollecting(false);
  }

  function startEditPaid(purchase) {
    if (!isRahaf) return;
    setPaidEditor({
      id: purchase.id,
      value: purchase.paid_price ?? "",
      saving: false
    });
  }

  function cancelEditPaid() {
    setPaidEditor({ id: "", value: "", saving: false });
  }

  async function savePaidPrice() {
    if (!isRahaf || !paidEditor.id) return;
    const raw = String(paidEditor.value ?? "").trim();
    const nextVal = raw === "" ? null : Number(raw);
    if (raw !== "" && (!Number.isFinite(nextVal) || nextVal < 0)) {
      window.alert("السعر المدفوع غير صحيح.");
      return;
    }

    setPaidEditor((prev) => ({ ...prev, saving: true }));
    const { error: updateError } = await sb
      .from("purchases")
      .update({ paid_price: nextVal })
      .eq("id", paidEditor.id);

    if (updateError) {
      console.error(updateError);
      window.alert("فشل حفظ المدفوع.");
      setPaidEditor((prev) => ({ ...prev, saving: false }));
      return;
    }

    setPurchases((prev) =>
      prev.map((purchase) =>
        String(purchase.id) === String(paidEditor.id) ? { ...purchase, paid_price: nextVal } : purchase
      )
    );
    cancelEditPaid();
  }

  function openSearchResult(result) {
    clearSearchResults();
    setSelectedOrderId(result.order_id);
    setHighlightPurchaseId(result.id);
    if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightPurchaseId("");
    }, 2500);
  }

  function openLightbox(images, index, label) {
    if (!images.length) return;
    setLightbox({
      open: true,
      images,
      index,
      label: label || ""
    });
  }

  if (profile.loading) {
    return (
      <div className="homepickup-page homepickup-state" dir="rtl">
        <SessionLoader />
      </div>
    );
  }

  if (!profile.authenticated) {
    return (
      <div className="homepickup-page homepickup-state" dir="rtl">
        <div className="homepickup-note homepickup-note-danger">
          <h2>لا توجد جلسة نشطة</h2>
          <p>يلزم تسجيل الدخول أولًا.</p>
          <a href="#/login" className="homepickup-link">
            فتح تسجيل الدخول
          </a>
        </div>
      </div>
    );
  }

  if (!isRahaf && !isReemOrRawand) {
    return (
      <div className="homepickup-page homepickup-state" dir="rtl">
        <div className="homepickup-note homepickup-note-danger">
          <h2>لا توجد صلاحية</h2>
          <p>هذه الصفحة متاحة لرهف، ريم، وروند فقط.</p>
          <a href="#/pickup-dashboard" className="homepickup-link">
            العودة
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`homepickup-page ${embedded ? "embedded" : ""}`} dir="rtl">
      {!embedded ? (
        <>
          <div className={`homepickup-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />
          <aside className={`homepickup-sidebar ${sidebarOpen ? "open" : ""}`}>
            <div className="homepickup-sidebar-head">
              <b>القائمة</b>
              <button type="button" className="homepickup-menu-btn danger" onClick={() => setSidebarOpen(false)}>
                ✕
              </button>
            </div>
            <div className="homepickup-sidebar-content">
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
      <div className="homepickup-wrap">
        {!embedded ? (
          <div className="homepickup-topbar">
            <div className="homepickup-brand">
              <b>مستلمو البيت</b>
              <div className="homepickup-muted">طلبات الاستلام من البيت</div>
            </div>
            <button type="button" className="homepickup-menu-btn" onClick={() => setSidebarOpen(true)}>
              ☰
            </button>
          </div>
        ) : null}

        <div className="homepickup-search-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="homepickup-search-box"
            placeholder="بحث باسم الزبون..."
          />
          {search.trim().length >= 2 ? (
            <span className="homepickup-pill">
              {searchLoading ? "..." : `${searchResults.length} نتيجة`}
            </span>
          ) : null}
        </div>

        {search.trim().length >= 2 && searchResults.length ? (
          <div className="homepickup-search-results">
            {searchResults.map((result) => (
              <button key={result.id} type="button" onClick={() => openSearchResult(result)}>
                <b>{result.customer_name || ""}</b>
                <div className="homepickup-muted">
                  {result.orderName} — السعر: {result.price ?? ""}
                </div>
              </button>
            ))}
          </div>
        ) : null}

        <div className="homepickup-grid">
          <aside className="homepickup-card homepickup-list-card">
            <div className="homepickup-row">
              <b>الطلبيات</b>
              <span className="homepickup-pill">{orders.length}</span>
            </div>

            {loadingOrders ? <div className="homepickup-muted homepickup-spacer">جاري تحميل البيانات...</div> : null}
            {error ? <div className="homepickup-error homepickup-spacer">{error}</div> : null}

            {!loadingOrders && !error && !orders.length ? (
              <div className="homepickup-muted homepickup-spacer">
                لا يوجد بيانات
                <div className="homepickup-refresh-row">
                  <button className="homepickup-btn" type="button" onClick={loadOrders}>
                    تحديث
                  </button>
                </div>
              </div>
            ) : null}

            {!loadingOrders && !error && orders.length ? (
              <div className="homepickup-orders-list">
                {orders.map((order) => {
                  const active = String(selectedOrderId) === String(order.id);
                  return (
                    <button
                      key={order.id}
                      type="button"
                      className={`homepickup-order-item ${active ? "active" : ""}`}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <span>{order.orderName}</span>
                      <span className="homepickup-pill">فتح</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </aside>

          <main className="homepickup-card">
            {!selectedOrder ? (
              <div className="homepickup-muted homepickup-spacer">
                لا يوجد بيانات
                <div className="homepickup-refresh-row">
                  <button className="homepickup-btn" type="button" onClick={loadOrders}>
                    تحديث
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="homepickup-row">
                  <div>
                    <b>{selectedOrder.orderName}</b>
                  </div>
                  <div className="homepickup-row">
                    <span className="homepickup-pill">عدد المشتريات: {visiblePurchases.length}</span>
                    <span className="homepickup-pill">مجموع أسعار المستلم: {formatILS(pickedTotal)} ₪</span>
                    {isRahaf ? (
                      <button
                        type="button"
                        className="homepickup-btn"
                        onClick={collectHomeMoney}
                        disabled={collecting}
                      >
                        {collecting ? "جاري التحصيل..." : "تم استلام تحصيل المستلمين"}
                      </button>
                    ) : null}
                  </div>
                </div>

                {loadingPurchases ? <div className="homepickup-muted homepickup-spacer">جاري تحميل المشتريات...</div> : null}

                {!loadingPurchases ? (
                  <div className="homepickup-table-wrap">
                    <table className="homepickup-table">
                      <thead>
                        <tr>
                          <th>الزبون</th>
                          <th>السعر</th>
                          {isRahaf ? <th>المدفوع</th> : null}
                          {isRahaf ? <th className="homepickup-edit-col" /> : null}
                          <th>صور</th>
                          <th>تم الاستلام</th>
                          <th>وقت الاستلام</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visiblePurchases.length ? (
                          visiblePurchases.map((purchase) => {
                            const isHighlight = highlightPurchaseId && String(highlightPurchaseId) === String(purchase.id);
                            const isEditing = String(paidEditor.id) === String(purchase.id);
                            return (
                              <tr key={purchase.id}>
                                <td>
                                  {isHighlight ? <div className="homepickup-highlight">✅ هذا هو البحث</div> : null}
                                  {purchase.customer_name || ""}
                                </td>
                                <td>{purchase.paid_price ?? purchase.price ?? ""}</td>

                                {isRahaf ? (
                                  <>
                                    <td>
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={paidEditor.value}
                                          onChange={(event) =>
                                            setPaidEditor((prev) => ({ ...prev, value: event.target.value }))
                                          }
                                          className="homepickup-paid-input"
                                        />
                                      ) : (
                                        purchase.paid_price ?? "—"
                                      )}
                                    </td>
                                    <td className="homepickup-edit-col">
                                      {isEditing ? (
                                        <div className="homepickup-edit-actions">
                                          <button
                                            type="button"
                                            className="homepickup-btn mini"
                                            onClick={savePaidPrice}
                                            disabled={paidEditor.saving}
                                          >
                                            ✅
                                          </button>
                                          <button
                                            type="button"
                                            className="homepickup-btn mini"
                                            onClick={cancelEditPaid}
                                            disabled={paidEditor.saving}
                                          >
                                            ✖
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          className="homepickup-btn mini"
                                          onClick={() => startEditPaid(purchase)}
                                        >
                                          ✏️
                                        </button>
                                      )}
                                    </td>
                                  </>
                                ) : null}

                                <td>
                                  {purchase.images?.length ? (
                                    <div className="homepickup-thumbs">
                                      {purchase.images.map((url, index) => (
                                        <img
                                          key={`${purchase.id}-img-${index}`}
                                          src={url}
                                          alt="صورة"
                                          onClick={() => openLightbox(purchase.images, index, purchase.customer_name || "")}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    "—"
                                  )}
                                </td>

                                <td>
                                  <label className="homepickup-pick-row">
                                    <input
                                      className="homepickup-check"
                                      type="checkbox"
                                      checked={!!purchase.picked_up}
                                      onChange={(event) => togglePicked(purchase.id, event.target.checked)}
                                    />
                                    <span>{purchase.picked_up ? "تم الاستلام" : "غير مستلم"}</span>
                                  </label>
                                </td>

                                <td>{formatDateTime(purchase.picked_up_at)}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={isRahaf ? 7 : 5} className="homepickup-muted">
                              لا يوجد مشتريات
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </>
            )}
          </main>
        </div>
      </div>

      {lightbox.open ? (
        <div className="homepickup-lightbox" onClick={() => setLightbox((prev) => ({ ...prev, open: false }))}>
          <button
            type="button"
            className="homepickup-lightbox-btn close"
            onClick={(event) => {
              event.stopPropagation();
              setLightbox((prev) => ({ ...prev, open: false }));
            }}
          >
            ✕
          </button>
          <div className="homepickup-lightbox-count">
            {lightbox.images.length ? `${lightbox.index + 1}/${lightbox.images.length}` : ""}
            {lightbox.label ? ` — ${lightbox.label}` : ""}
          </div>
          {lightbox.images.length > 1 ? (
            <button
              type="button"
              className="homepickup-lightbox-btn prev"
              onClick={(event) => {
                event.stopPropagation();
                setLightbox((prev) => ({
                  ...prev,
                  index: (prev.index - 1 + prev.images.length) % prev.images.length
                }));
              }}
            >
              ‹
            </button>
          ) : null}
          <img src={lightbox.images[lightbox.index]} alt="صورة كبيرة" />
          {lightbox.images.length > 1 ? (
            <button
              type="button"
              className="homepickup-lightbox-btn next"
              onClick={(event) => {
                event.stopPropagation();
                setLightbox((prev) => ({
                  ...prev,
                  index: (prev.index + 1) % prev.images.length
                }));
              }}
            >
              ›
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
