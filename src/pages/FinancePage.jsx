import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuthProfile } from "../hooks/useAuthProfile";
import { getOrdersNavItems, isNavHrefActive } from "../lib/navigation";
import { formatILS, parsePrice } from "../lib/orders";
import { signOutAndRedirect } from "../lib/session";
import { sb } from "../lib/supabaseClient";
import SessionLoader from "../components/common/SessionLoader";
import "./finance-page.css";

function getOrderDate(order) {
  if (order?.order_date) {
    const d = new Date(`${order.order_date}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const fallback = new Date(order?.created_at || Date.now());
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date) {
  return date.toLocaleDateString("ar", { month: "long", year: "numeric" });
}

function monthNames() {
  return ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
}

function topPickupPoint(map) {
  let top = "—";
  let max = 0;
  map.forEach((value, key) => {
    if (value > max) {
      max = value;
      top = key;
    }
  });
  return top;
}

export default function FinancePage({ embedded = false }) {
  const { profile } = useAuthProfile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);
  const [orderStatsMap, setOrderStatsMap] = useState(new Map());

  const [activeTab, setActiveTab] = useState("orders");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [spentInput, setSpentInput] = useState("");
  const [spentMessage, setSpentMessage] = useState("");
  const [savingSpent, setSavingSpent] = useState(false);

  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState("");
  const location = useLocation();
  const sidebarLinks = useMemo(() => getOrdersNavItems(profile.role), [profile.role]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ordersRes, purchasesRes] = await Promise.all([
        sb.from("orders").select("id, order_name, order_date, created_at, spent_amount").order("created_at", { ascending: false }),
        sb.from("purchases").select("order_id, price, paid_price, pickup_point, collected, picked_up")
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (purchasesRes.error) throw purchasesRes.error;

      const orderRows = (ordersRes.data || []).map((o) => ({ ...o, spent_amount: parsePrice(o.spent_amount) }));
      const stats = new Map();

      (purchasesRes.data || []).forEach((p) => {
        if (!p.order_id) return;
        if (!stats.has(p.order_id)) {
          stats.set(p.order_id, { collected: 0, expected: 0, purchaseCount: 0, pickupTotals: new Map() });
        }
        const s = stats.get(p.order_id);
        const value = parsePrice(p.paid_price ?? p.price);
        s.expected += value;
        s.purchaseCount += 1;
        if (p.collected) s.collected += value;
        const pickup = String(p.pickup_point || "").trim();
        if (pickup) {
          s.pickupTotals.set(pickup, (s.pickupTotals.get(pickup) || 0) + value);
        }
      });

      setOrders(orderRows);
      setOrderStatsMap(stats);
    } catch (err) {
      console.error(err);
      setOrders([]);
      setOrderStatsMap(new Map());
      setError("تعذر تحميل بيانات المالية.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (profile.loading || !profile.authenticated || profile.role !== "rahaf") return;
    loadData();
  }, [loadData, profile.authenticated, profile.loading, profile.role]);

  const orderRows = useMemo(() => {
    return orders.map((order) => {
      const stats = orderStatsMap.get(order.id) || { collected: 0, expected: 0, purchaseCount: 0, pickupTotals: new Map() };
      const spent = parsePrice(order.spent_amount);
      const pending = Math.max(0, stats.expected - stats.collected);
      return {
        id: order.id,
        name: order.order_name || "طلبية",
        createdAt: order.created_at,
        orderDate: order.order_date,
        spent,
        collected: stats.collected,
        expected: stats.expected,
        pending,
        purchaseCount: stats.purchaseCount,
        pickupTotals: stats.pickupTotals
      };
    });
  }, [orderStatsMap, orders]);

  const selectedOrder = useMemo(
    () => orderRows.find((o) => String(o.id) === String(selectedOrderId)) || null,
    [orderRows, selectedOrderId]
  );

  useEffect(() => {
    if (!orderRows.length) {
      setSelectedOrderId("");
      return;
    }
    setSelectedOrderId((prev) => (prev && orderRows.some((o) => String(o.id) === String(prev)) ? prev : orderRows[0].id));
  }, [orderRows]);

  useEffect(() => {
    if (!selectedOrder) {
      setSpentInput("");
      return;
    }
    setSpentInput(selectedOrder.spent ? String(selectedOrder.spent) : "");
    setSpentMessage("");
  }, [selectedOrder]);

  const monthSummary = useMemo(() => {
    const map = new Map();
    orderRows.forEach((order) => {
      const date = getOrderDate(order);
      const key = monthKey(date);
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: monthLabel(date),
          year: date.getFullYear(),
          monthIndex: date.getMonth(),
          orders: 0,
          purchases: 0,
          collected: 0,
          expected: 0,
          spent: 0,
          pickupTotals: new Map()
        });
      }
      const item = map.get(key);
      item.orders += 1;
      item.purchases += order.purchaseCount;
      item.collected += order.collected;
      item.expected += order.expected;
      item.spent += order.spent;
      order.pickupTotals.forEach((value, pickup) => {
        item.pickupTotals.set(pickup, (item.pickupTotals.get(pickup) || 0) + value);
      });
    });
    const years = Array.from(new Set(Array.from(map.values()).map((m) => m.year))).sort((a, b) => a - b);
    return { map, years };
  }, [orderRows]);

  useEffect(() => {
    if (!monthSummary.years.length) {
      setSelectedYear(null);
      setSelectedMonthKey("");
      return;
    }
    setSelectedYear((prev) => (prev !== null && monthSummary.years.includes(prev) ? prev : monthSummary.years[monthSummary.years.length - 1]));
  }, [monthSummary.years]);

  useEffect(() => {
    if (selectedYear === null) return;
    const monthKeys = Array.from(monthSummary.map.values())
      .filter((m) => m.year === selectedYear)
      .map((m) => m.key)
      .sort();
    if (!monthKeys.length) {
      setSelectedMonthKey("");
      return;
    }
    setSelectedMonthKey((prev) => (prev && monthKeys.includes(prev) ? prev : monthKeys[monthKeys.length - 1]));
  }, [monthSummary.map, selectedYear]);

  const selectedMonth = useMemo(() => (selectedMonthKey ? monthSummary.map.get(selectedMonthKey) || null : null), [monthSummary.map, selectedMonthKey]);

  async function saveSpent() {
    if (!selectedOrder || savingSpent) return;
    const value = spentInput.trim() === "" ? 0 : Number(spentInput);
    if (!Number.isFinite(value) || value < 0) {
      setSpentMessage("المصروف غير صحيح.");
      return;
    }
    setSavingSpent(true);
    setSpentMessage("جاري الحفظ...");
    const { error: updateError } = await sb.from("orders").update({ spent_amount: value }).eq("id", selectedOrder.id);
    if (updateError) {
      console.error(updateError);
      setSpentMessage("فشل الحفظ.");
      setSavingSpent(false);
      return;
    }
    setOrders((prev) => prev.map((o) => (String(o.id) === String(selectedOrder.id) ? { ...o, spent_amount: value } : o)));
    setSavingSpent(false);
    setSpentMessage("تم ✅");
    window.setTimeout(() => setSpentMessage(""), 1500);
  }

  async function signOut() {
    await signOutAndRedirect();
  }

  if (profile.loading) return <div className="finance-page finance-state"><SessionLoader /></div>;
  if (!profile.authenticated) return <div className="finance-page finance-state"><div className="finance-note finance-note-danger"><h2>لا توجد جلسة نشطة</h2><p>يلزم تسجيل الدخول أولًا.</p><a href="#/login" className="finance-link">فتح تسجيل الدخول</a></div></div>;
  if (profile.role !== "rahaf") return <div className="finance-page finance-state"><div className="finance-note finance-note-danger"><h2>لا توجد صلاحية</h2><p>هذه الصفحة متاحة لحساب رهف فقط.</p><a href="#/orders" className="finance-link">العودة للطلبيات</a></div></div>;

  return (
    <div className={`finance-page ${embedded ? "embedded" : ""}`} dir="rtl">
      {!embedded ? (
        <>
          <div
            className={`finance-overlay app-sidebar-overlay ${sidebarOpen ? "open" : ""}`}
            onClick={() => setSidebarOpen(false)}
          />
          <aside className={`finance-sidebar app-sidebar-drawer ${sidebarOpen ? "open" : ""}`}>
            <div className="finance-sidebar-head app-sidebar-head">
              <b>القائمة</b>
              <button type="button" className="finance-menu-btn danger app-sidebar-close" onClick={() => setSidebarOpen(false)}>
                ✕
              </button>
            </div>
            <div className="finance-sidebar-content app-sidebar-content">
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
        </>
      ) : null}
      <div className="finance-wrap">
        {!embedded ? <div className="finance-topbar"><div className="finance-brand"><b>المالية</b><div className="finance-muted">ملخص المصروفات والإيرادات</div></div><button type="button" className="finance-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button></div> : null}
        <div className="finance-tabs"><button type="button" className={`finance-tab-btn ${activeTab === "orders" ? "active" : ""}`} onClick={() => setActiveTab("orders")}>احصاء الطلبات</button><button type="button" className={`finance-tab-btn ${activeTab === "months" ? "active" : ""}`} onClick={() => setActiveTab("months")}>احصاء شهري</button></div>
        {error ? <div className="finance-error">{error}</div> : null}
        {loading ? <div className="finance-loading">جاري تحميل البيانات...</div> : null}
        {!loading && activeTab === "orders" ? (
          <div className="finance-grid">
            <aside className="finance-card finance-list-card">
              <div className="finance-row"><b>الطلبيات</b><span className="finance-pill">{orderRows.length}</span></div>
              {!orderRows.length ? <div className="finance-empty">لا يوجد بيانات<div className="finance-refresh-row"><button type="button" className="finance-btn" onClick={loadData}>تحديث</button></div></div> : (
                <div className="finance-order-groups">
                  {orderRows.map((order) => (
                    <button key={order.id} type="button" className={`finance-order-item ${String(order.id) === String(selectedOrderId) ? "active" : ""}`} onClick={() => setSelectedOrderId(order.id)}>
                      <span>{order.name}</span><span className="finance-pill">فتح</span>
                    </button>
                  ))}
                </div>
              )}
            </aside>
            <main className="finance-card">
              {!selectedOrder ? <div className="finance-empty">اختاري طلبية من القائمة</div> : (
                <>
                  <div className="finance-row"><b>{selectedOrder.name}</b><span className={`finance-status ${selectedOrder.pending === 0 && selectedOrder.expected > 0 ? "success" : selectedOrder.expected === 0 ? "neutral" : "warning"}`}>{selectedOrder.expected === 0 ? "لا يوجد مشتريات" : selectedOrder.pending === 0 ? "مكتمل" : "قيد التحصيل"}</span></div>
                  <div className="finance-kpi-grid">
                    <div className="finance-kpi"><div className="label">تم تحصيله</div><div className="value">{formatILS(selectedOrder.collected)}</div></div>
                    <div className="finance-kpi"><div className="label">متبقي للتحصيل</div><div className="value">{formatILS(selectedOrder.pending)}</div></div>
                    <div className="finance-kpi"><div className="label">إجمالي متوقع</div><div className="value">{formatILS(selectedOrder.expected)}</div></div>
                  </div>
                  <div className="finance-kpi-grid compact">
                    <div className="finance-kpi"><div className="label">صافي محصّل</div><div className={`value ${selectedOrder.collected - selectedOrder.spent < 0 ? "neg" : ""}`}>{formatILS(selectedOrder.collected - selectedOrder.spent)}</div></div>
                    <div className="finance-kpi"><div className="label">صافي متوقع</div><div className={`value ${selectedOrder.expected - selectedOrder.spent < 0 ? "neg" : ""}`}>{formatILS(selectedOrder.expected - selectedOrder.spent)}</div></div>
                    <div className="finance-kpi"><div className="label">المصروف</div><div className="value">{formatILS(selectedOrder.spent)}</div></div>
                  </div>
                  <div className="finance-spent-row">
                    <label htmlFor="financeSpentInput">المصروف:</label>
                    <input id="financeSpentInput" type="number" step="0.01" min="0" value={spentInput} onChange={(e) => setSpentInput(e.target.value)} placeholder="المصروف على الطلبية" />
                    <button type="button" className="finance-btn primary" onClick={saveSpent} disabled={savingSpent}>{savingSpent ? "جاري الحفظ..." : "حفظ المصروف"}</button>
                    {spentMessage ? <span className="finance-muted">{spentMessage}</span> : null}
                  </div>
                </>
              )}
            </main>
          </div>
        ) : null}
        {!loading && activeTab === "months" ? (
          <main className="finance-card">
            <div className="finance-row center"><div className="finance-section-title">ملخص شهري</div></div>
            <div className="finance-month-picker">
              <div className="finance-month-header">
                <button type="button" className="finance-btn mini" disabled={!monthSummary.years.length || selectedYear === monthSummary.years[0]} onClick={() => setSelectedYear((v) => (v === null ? v : monthSummary.years[Math.max(0, monthSummary.years.indexOf(v) - 1)]))}>‹</button>
                <b>{selectedYear ?? "—"}</b>
                <button type="button" className="finance-btn mini" disabled={!monthSummary.years.length || selectedYear === monthSummary.years[monthSummary.years.length - 1]} onClick={() => setSelectedYear((v) => (v === null ? v : monthSummary.years[Math.min(monthSummary.years.length - 1, monthSummary.years.indexOf(v) + 1)]))}>›</button>
              </div>
              <div className="finance-month-grid">
                {monthNames().map((name, idx) => {
                  const key = `${selectedYear}-${String(idx + 1).padStart(2, "0")}`;
                  const hasData = monthSummary.map.has(key);
                  return <button key={name} type="button" className={`finance-month-btn ${selectedMonthKey === key ? "active" : ""}`} disabled={!hasData} onClick={() => setSelectedMonthKey(key)}>{name}</button>;
                })}
              </div>
            </div>
            {!selectedMonth ? <div className="finance-empty">لا يوجد بيانات شهرية</div> : (
              <div className="finance-month-shell">
                <div className="finance-row"><b>{selectedMonth.label}</b><span className={`finance-status ${selectedMonth.expected > 0 && selectedMonth.collected >= selectedMonth.expected ? "success" : "warning"}`}>{selectedMonth.expected > 0 && selectedMonth.collected >= selectedMonth.expected ? "مكتمل" : "قيد التحصيل"}</span></div>
                <div className="finance-health-row">
                  <span className="finance-pill">الطلبات: {selectedMonth.orders}</span>
                  <span className="finance-pill">المشتريات: {selectedMonth.purchases}</span>
                  <span className="finance-pill">نسبة التحصيل: {selectedMonth.expected > 0 ? Math.round((selectedMonth.collected / selectedMonth.expected) * 100) : 0}%</span>
                  <span className="finance-pill">أكبر نقطة: {topPickupPoint(selectedMonth.pickupTotals)}</span>
                </div>
                <div className="finance-kpi-grid">
                  <div className="finance-kpi"><div className="label">تم تحصيله</div><div className="value">{formatILS(selectedMonth.collected)}</div></div>
                  <div className="finance-kpi"><div className="label">متبقي للتحصيل</div><div className="value">{formatILS(Math.max(0, selectedMonth.expected - selectedMonth.collected))}</div></div>
                  <div className="finance-kpi"><div className="label">إجمالي متوقع</div><div className="value">{formatILS(selectedMonth.expected)}</div></div>
                </div>
                <div className="finance-kpi-grid compact">
                  <div className="finance-kpi"><div className="label">صافي محصّل</div><div className={`value ${selectedMonth.collected - selectedMonth.spent < 0 ? "neg" : ""}`}>{formatILS(selectedMonth.collected - selectedMonth.spent)}</div></div>
                  <div className="finance-kpi"><div className="label">صافي متوقع</div><div className={`value ${selectedMonth.expected - selectedMonth.spent < 0 ? "neg" : ""}`}>{formatILS(selectedMonth.expected - selectedMonth.spent)}</div></div>
                  <div className="finance-kpi"><div className="label">المصروف</div><div className="value">{formatILS(selectedMonth.spent)}</div></div>
                </div>
              </div>
            )}
          </main>
        ) : null}
      </div>
    </div>
  );
}
