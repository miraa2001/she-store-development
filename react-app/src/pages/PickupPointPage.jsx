import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthProfile } from "../hooks/useAuthProfile";
import { getPickupSidebarLinks } from "../lib/navigation";
import { formatILS, parsePrice } from "../lib/orders";
import { signOutAndRedirect } from "../lib/session";
import { sb } from "../lib/supabaseClient";
import "./pickuppoint-page.css";

const PICKUP_VALUE = "من نقطة الاستلام";
const PICKUP_ALIASES = [
  PICKUP_VALUE,
  "من نقطه الاستلام",
  "La Aura",
  "la aura",
  "LAAURA",
  "لا اورا",
  "لا أورا",
  "لاورا"
];
const NTFY_TOPIC = "she-store-rahaf-2001-2014";

function formatDateTime(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const dateText = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  const timeText = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${dateText} ${timeText}`;
}

function formatDMY(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function getOrderDateKey(order) {
  return formatDMY(order?.placedAtPickupAt || order?.orderDate || order?.createdAt);
}

function normalizePickup(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[أإآ]/g, "ا");
}

function isAuraPickup(value) {
  const normalized = normalizePickup(value || PICKUP_VALUE);
  if (!normalized) return false;
  if (normalized.includes("بيت") || normalized.includes("توصيل")) return false;

  if (
    PICKUP_ALIASES.some((alias) => {
      const normalizedAlias = normalizePickup(alias);
      return normalizedAlias && (normalized === normalizedAlias || normalized.includes(normalizedAlias));
    })
  ) {
    return true;
  }

  if (normalized.includes("aura")) return true;
  if (normalized.includes("لاورا") || normalized.includes("لااورا")) return true;
  if (normalized.includes("نقطه") || normalized.includes("نقطة") || normalized.includes("استلام")) return true;
  return false;
}

function buildOrderGroups(orderList) {
  const groups = [];
  const map = new Map();

  orderList.forEach((order) => {
    const dateKey = getOrderDateKey(order) || "غير محدد";
    if (!map.has(dateKey)) {
      const group = {
        id: `group-${dateKey}`,
        kind: "group",
        dateKey,
        label: `طلبية ${dateKey}`,
        orderIds: []
      };
      map.set(dateKey, group);
      groups.push(group);
    }
    map.get(dateKey).orderIds.push(order.id);
  });

  return groups;
}

function pickupMessage({ picked, customerName, price, pickupLabel }) {
  const status = picked ? "✅" : "❌";
  return [
    `تم استلام الطلب ${status}`,
    `الزبون: ${customerName || ""}`,
    `نقطة الاستلام: ${pickupLabel || ""}`,
    `السعر: ${formatILS(price)}`
  ].join("\n");
}

function notifyPickup(message) {
  return fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: "POST",
    body: message
  }).catch((error) => {
    console.error("NTFY ERROR:", error);
  });
}

export default function PickupPointPage({ embedded = false }) {
  const { profile } = useAuthProfile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [purchases, setPurchases] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [error, setError] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [collectingAll, setCollectingAll] = useState(false);
  const [allOrdersTotal, setAllOrdersTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [highlightPurchaseId, setHighlightPurchaseId] = useState("");
  const [paidEditor, setPaidEditor] = useState({ id: "", value: "", saving: false });
  const highlightTimeoutRef = useRef(null);

  const isRahaf = profile.role === "rahaf";
  const isLaaura = profile.role === "laaura";
  const canAccess = isRahaf || isLaaura;
  const sidebarLinks = useMemo(
    () => (isRahaf ? getPickupSidebarLinks(profile.role) : []),
    [isRahaf, profile.role]
  );

  const listItems = useMemo(() => {
    if (isLaaura) return buildOrderGroups(orders);
    return orders.map((order) => ({
      id: `order-${order.id}`,
      kind: "order",
      label: order.orderName || "طلبية",
      orderIds: [order.id]
    }));
  }, [isLaaura, orders]);

  const selectedItem = useMemo(
    () => listItems.find((item) => item.id === selectedItemId) || null,
    [listItems, selectedItemId]
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
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setSelectedItemId((prev) => {
      if (prev && listItems.some((item) => item.id === prev)) return prev;
      return listItems[0]?.id || "";
    });
    if (!listItems.length) setPurchases([]);
  }, [listItems]);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    setError("");
    try {
      const { data: purchaseRows, error: purchasesError } = await sb
        .from("purchases")
        .select("order_id, pickup_point, collected")
        .eq("collected", false);

      if (purchasesError) throw purchasesError;

      const pendingAura = (purchaseRows || []).filter((purchase) => isAuraPickup(purchase.pickup_point));
      const orderIds = Array.from(new Set(pendingAura.map((purchase) => purchase.order_id)));

      if (!orderIds.length) {
        setOrders([]);
        return;
      }

      const { data: orderRows, error: ordersError } = await sb
        .from("orders")
        .select("id, order_name, created_at, order_date, placed_at_pickup_at")
        .in("id", orderIds)
        .eq("arrived", true)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      setOrders(
        (orderRows || []).map((order) => ({
          id: order.id,
          orderName: order.order_name || "",
          createdAt: order.created_at,
          orderDate: order.order_date,
          placedAtPickupAt: order.placed_at_pickup_at
        }))
      );
    } catch (err) {
      console.error(err);
      setOrders([]);
      setError("تعذر تحميل الطلبات.");
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const loadPurchases = useCallback(async (item) => {
    if (!item?.orderIds?.length) {
      setPurchases([]);
      return;
    }

    setLoadingPurchases(true);
    setError("");
    try {
      const { data, error: purchasesError } = await sb
        .from("purchases")
        .select("id, order_id, customer_name, price, paid_price, bag_size, picked_up, picked_up_at, pickup_point, collected")
        .in("order_id", item.orderIds)
        .eq("collected", false)
        .order("created_at", { ascending: true });

      if (purchasesError) throw purchasesError;

      setPurchases((data || []).filter((purchase) => isAuraPickup(purchase.pickup_point)));
      setPaidEditor({ id: "", value: "", saving: false });
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل مشتريات الطلب.");
      setPurchases([]);
    } finally {
      setLoadingPurchases(false);
    }
  }, []);

  const loadAllOrdersTotal = useCallback(async () => {
    if (!isRahaf) {
      setAllOrdersTotal(0);
      return;
    }

    const { data, error: totalError } = await sb
      .from("purchases")
      .select("paid_price, price, pickup_point")
      .eq("picked_up", true)
      .eq("collected", false);

    if (totalError) {
      console.error(totalError);
      setAllOrdersTotal(0);
      return;
    }

    const total = (data || [])
      .filter((purchase) => isAuraPickup(purchase.pickup_point))
      .reduce((sum, purchase) => sum + parsePrice(purchase.paid_price ?? purchase.price), 0);

    setAllOrdersTotal(total);
  }, [isRahaf]);

  useEffect(() => {
    if (profile.loading || !profile.authenticated || !canAccess) return;
    loadOrders();
  }, [canAccess, loadOrders, profile.authenticated, profile.loading]);

  useEffect(() => {
    if (profile.loading || !profile.authenticated || !isRahaf) return;
    loadAllOrdersTotal();
  }, [isRahaf, loadAllOrdersTotal, profile.authenticated, profile.loading]);

  useEffect(() => {
    if (!selectedItem || !canAccess) return;
    loadPurchases(selectedItem);
  }, [canAccess, loadPurchases, selectedItem]);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const orderIds = orders.map((order) => order.id);
    if (!orderIds.length) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data, error: searchError } = await sb
          .from("purchases")
          .select("id, order_id, customer_name, price, created_at, pickup_point")
          .in("order_id", orderIds)
          .eq("collected", false)
          .ilike("customer_name", `%${query}%`)
          .order("created_at", { ascending: false })
          .limit(50);

        if (searchError) throw searchError;

        const list = (data || [])
          .filter((purchase) => isAuraPickup(purchase.pickup_point))
          .map((purchase) => ({
            ...purchase,
            orderName: orders.find((order) => String(order.id) === String(purchase.order_id))?.orderName || "طلبية"
          }));
        setSearchResults(list);
      } catch (err) {
        console.error(err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [orders, search]);

  async function signOut() {
    await signOutAndRedirect();
  }

  async function togglePicked(purchaseId, checked) {
    const target = purchases.find((purchase) => String(purchase.id) === String(purchaseId));
    const payload = checked
      ? { picked_up: true, picked_up_at: new Date().toISOString() }
      : { picked_up: false, picked_up_at: null };

    setPurchases((prev) =>
      prev.map((purchase) => (String(purchase.id) === String(purchaseId) ? { ...purchase, ...payload } : purchase))
    );

    const { error: updateError } = await sb.from("purchases").update(payload).eq("id", purchaseId);
    if (updateError) {
      console.error(updateError);
      await loadPurchases(selectedItem);
      return;
    }

    if (target) {
      await notifyPickup(
        pickupMessage({
          picked: payload.picked_up,
          customerName: target.customer_name,
          price: target.price,
          pickupLabel: "نقطة الاستلام (La Aura)"
        })
      );
    }

    await loadAllOrdersTotal();
  }

  async function collectCurrentOrder() {
    if (!isRahaf || !selectedItem) return;
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
    const ids = pending.map((purchase) => purchase.id);
    const { error: collectError } = await sb
      .from("purchases")
      .update({ collected: true, collected_at: new Date().toISOString() })
      .in("id", ids);

    if (collectError) {
      console.error(collectError);
      setCollecting(false);
      return;
    }

    await notifyPickup(["تم استلام تحصيل النقود ✅", "المكان: نقطة الاستلام (La Aura)", `المبلغ: ${pendingText}`].join("\n"));
    await loadOrders();
    await loadAllOrdersTotal();
    setCollecting(false);
  }

  async function collectAllOrders() {
    if (!isRahaf) return;

    const { data, error: totalError } = await sb
      .from("purchases")
      .select("id, paid_price, price, pickup_point")
      .eq("picked_up", true)
      .eq("collected", false);

    if (totalError) {
      console.error(totalError);
      return;
    }

    const auraList = (data || []).filter((purchase) => isAuraPickup(purchase.pickup_point));
    const total = auraList.reduce((sum, purchase) => sum + parsePrice(purchase.paid_price ?? purchase.price), 0);
    if (total <= 0) return;

    const ok = window.confirm(`تأكيد تحصيل كل المبالغ (${auraList.length} مشتريات) بمبلغ ${formatILS(total)} ₪؟`);
    if (!ok) return;

    setCollectingAll(true);
    const ids = auraList.map((purchase) => purchase.id);
    const { error: collectError } = await sb
      .from("purchases")
      .update({ collected: true, collected_at: new Date().toISOString() })
      .in("id", ids);

    if (collectError) {
      console.error(collectError);
      setCollectingAll(false);
      return;
    }

    await notifyPickup(["تم استلام تحصيل النقود ✅", "المكان: نقطة الاستلام (La Aura)", `المبلغ: ${formatILS(total)}`].join("\n"));
    await loadOrders();
    await loadAllOrdersTotal();
    setCollectingAll(false);
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
    await loadAllOrdersTotal();
    cancelEditPaid();
  }

  function openSearchResult(result) {
    const targetOrder = orders.find((order) => String(order.id) === String(result.order_id));
    if (!targetOrder) return;

    if (isLaaura) {
      const dateKey = getOrderDateKey(targetOrder) || "غير محدد";
      setSelectedItemId(`group-${dateKey}`);
    } else {
      setSelectedItemId(`order-${targetOrder.id}`);
    }

    setSearchResults([]);
    setHighlightPurchaseId(result.id);

    if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightPurchaseId("");
    }, 2500);
  }

  if (profile.loading) {
    return (
      <div className="pickuppoint-page pickuppoint-state" dir="rtl">
        <div className="pickuppoint-note">جاري التحقق من الجلسة...</div>
      </div>
    );
  }

  if (!profile.authenticated) {
    return (
      <div className="pickuppoint-page pickuppoint-state" dir="rtl">
        <div className="pickuppoint-note pickuppoint-note-danger">
          <h2>لا توجد جلسة نشطة</h2>
          <p>يلزم تسجيل الدخول أولًا.</p>
          <a href="#/login" className="pickuppoint-link">
            فتح تسجيل الدخول
          </a>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="pickuppoint-page pickuppoint-state" dir="rtl">
        <div className="pickuppoint-note pickuppoint-note-danger">
          <h2>لا توجد صلاحية</h2>
          <p>هذه الصفحة متاحة لرهف أو لارا فقط.</p>
          <a href="#/pickup-dashboard" className="pickuppoint-link">
            العودة
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`pickuppoint-page ${embedded ? "embedded" : ""}`} dir="rtl">
      {!embedded ? (
        <>
          <div className={`pickuppoint-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />
          <aside className={`pickuppoint-sidebar ${sidebarOpen ? "open" : ""}`}>
            <div className="pickuppoint-sidebar-head">
              <b>القائمة</b>
              <button type="button" className="pickuppoint-menu-btn danger" onClick={() => setSidebarOpen(false)}>
                ✕
              </button>
            </div>
            <div className="pickuppoint-sidebar-content">
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
      <div className="pickuppoint-wrap">
        {!embedded ? (
          <div className="pickuppoint-topbar">
            <div className="pickuppoint-brand">
              <b>نقطة الاستلام - La Aura</b>
              <div className="pickuppoint-muted">طلبات الاستلام من نقطة الاستلام</div>
            </div>
            <button type="button" className="pickuppoint-menu-btn" onClick={() => setSidebarOpen(true)}>
              ☰
            </button>
          </div>
        ) : null}

        <div className="pickuppoint-search-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pickuppoint-search-box"
            placeholder="بحث باسم الزبون..."
          />
          {search.trim().length >= 2 ? (
            <span className="pickuppoint-pill">{searchLoading ? "..." : `${searchResults.length} نتيجة`}</span>
          ) : null}
        </div>

        {search.trim().length >= 2 && searchResults.length ? (
          <div className="pickuppoint-search-results">
            {searchResults.map((result) => (
              <button key={result.id} type="button" onClick={() => openSearchResult(result)}>
                <b>{result.customer_name || ""}</b>
                <div className="pickuppoint-muted">
                  {result.orderName} — السعر: {formatILS(result.price)}
                </div>
              </button>
            ))}
          </div>
        ) : null}

        <div className="pickuppoint-grid">
          <aside className="pickuppoint-card pickuppoint-list-card">
            <div className="pickuppoint-row">
              <b>الطلبيات</b>
              <span className="pickuppoint-pill">{listItems.length}</span>
            </div>

            {loadingOrders ? <div className="pickuppoint-muted pickuppoint-spacer">جاري تحميل البيانات...</div> : null}
            {error ? <div className="pickuppoint-error pickuppoint-spacer">{error}</div> : null}

            {!loadingOrders && !error && !listItems.length ? (
              <div className="pickuppoint-muted pickuppoint-spacer">
                لا يوجد بيانات
                <div className="pickuppoint-refresh-row">
                  <button className="pickuppoint-btn" type="button" onClick={loadOrders}>
                    تحديث
                  </button>
                </div>
              </div>
            ) : null}

            {!loadingOrders && !error && listItems.length ? (
              <div className="pickuppoint-orders-list">
                {listItems.map((item) => {
                  const active = item.id === selectedItemId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`pickuppoint-order-item ${active ? "active" : ""}`}
                      onClick={() => setSelectedItemId(item.id)}
                    >
                      <span>{item.label}</span>
                      <span className="pickuppoint-pill">
                        {item.kind === "group" ? `الطلبيات: ${item.orderIds.length}` : "فتح"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </aside>

          <main className="pickuppoint-card">
            {isRahaf ? (
              <div className="pickuppoint-global-summary">
                <div className="pickuppoint-row">
                  <span className="pickuppoint-pill">اجمالي المبلغ للتحصيل: {formatILS(allOrdersTotal)} ₪</span>
                  <button
                    className="pickuppoint-btn"
                    type="button"
                    disabled={collectingAll || allOrdersTotal <= 0}
                    onClick={collectAllOrders}
                  >
                    {collectingAll ? "جاري التحصيل..." : "تم استلام تحصيل الكل"}
                  </button>
                </div>
              </div>
            ) : null}

            {!selectedItem ? (
              <div className="pickuppoint-muted pickuppoint-spacer">
                لا يوجد بيانات
                <div className="pickuppoint-refresh-row">
                  <button className="pickuppoint-btn" type="button" onClick={loadOrders}>
                    تحديث
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="pickuppoint-row">
                  <div>
                    <b>{selectedItem.label}</b>
                  </div>
                  <div className="pickuppoint-row">
                    <span className="pickuppoint-pill">عدد المشتريات: {visiblePurchases.length}</span>
                    <span className="pickuppoint-pill">مجموع المستلم: {formatILS(pickedTotal)} ₪</span>
                    {isRahaf ? (
                      <button
                        type="button"
                        className="pickuppoint-btn"
                        onClick={collectCurrentOrder}
                        disabled={collecting}
                      >
                        {collecting ? "جاري التحصيل..." : "تم استلام تحصيل المستلمين"}
                      </button>
                    ) : null}
                  </div>
                </div>

                {loadingPurchases ? <div className="pickuppoint-muted pickuppoint-spacer">جاري تحميل المشتريات...</div> : null}

                {!loadingPurchases ? (
                  <div className="pickuppoint-table-wrap">
                    <table className="pickuppoint-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>الزبون</th>
                          <th>السعر</th>
                          {isRahaf ? <th>المدفوع</th> : null}
                          {isRahaf ? <th className="pickuppoint-edit-col" /> : null}
                          <th>حجم الكيس</th>
                          <th>تم الاستلام</th>
                          {isRahaf ? <th>تاريخ الاستلام</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {visiblePurchases.length ? (
                          visiblePurchases.map((purchase, index) => {
                            const isHighlight = highlightPurchaseId && String(highlightPurchaseId) === String(purchase.id);
                            const isEditing = String(paidEditor.id) === String(purchase.id);
                            return (
                              <tr key={purchase.id} className={isHighlight ? "highlight" : ""}>
                                <td>{index + 1}</td>
                                <td>{purchase.customer_name || ""}</td>
                                <td>{formatILS(purchase.paid_price ?? purchase.price)}</td>
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
                                          className="pickuppoint-paid-input"
                                          onKeyDown={(event) => {
                                            if (event.key === "Enter") savePaidPrice();
                                            if (event.key === "Escape") cancelEditPaid();
                                          }}
                                        />
                                      ) : (
                                        purchase.paid_price ?? "—"
                                      )}
                                    </td>
                                    <td className="pickuppoint-edit-col">
                                      {isEditing ? (
                                        <div className="pickuppoint-edit-actions">
                                          <button
                                            type="button"
                                            className="pickuppoint-btn mini"
                                            onClick={savePaidPrice}
                                            disabled={paidEditor.saving}
                                          >
                                            ✅
                                          </button>
                                          <button
                                            type="button"
                                            className="pickuppoint-btn mini"
                                            onClick={cancelEditPaid}
                                            disabled={paidEditor.saving}
                                          >
                                            ✖
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          className="pickuppoint-btn mini"
                                          onClick={() => startEditPaid(purchase)}
                                        >
                                          ✏️
                                        </button>
                                      )}
                                    </td>
                                  </>
                                ) : null}
                                <td>{purchase.bag_size || "—"}</td>
                                <td>
                                  <label className="pickuppoint-pick-row">
                                    <input
                                      className="pickuppoint-check"
                                      type="checkbox"
                                      checked={!!purchase.picked_up}
                                      onChange={(event) => togglePicked(purchase.id, event.target.checked)}
                                    />
                                    <span className={`pickuppoint-status ${purchase.picked_up ? "success" : "neutral"}`}>
                                      {purchase.picked_up ? "تم الاستلام" : "غير مستلم"}
                                    </span>
                                  </label>
                                </td>
                                {isRahaf ? <td>{formatDateTime(purchase.picked_up_at)}</td> : null}
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={isRahaf ? 8 : 5} className="pickuppoint-muted">
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
    </div>
  );
}
