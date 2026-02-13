import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentUserProfile } from "../lib/auth";
import { formatILS, parsePrice } from "../lib/orders";
import { sb } from "../lib/supabaseClient";
import "./finance-page.css";

function getOrderDate(order) {
  if (order?.order_date) {
    const date = new Date(`${order.order_date}T00:00:00`);
    if (!Number.isNaN(date.getTime())) return date;
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

function createEmptyStats() {
  return {
    collected: 0,
    pending: 0,
    notPicked: 0,
    expected: 0,
    purchaseCount: 0,
    pickupTotals: new Map(),
    dailyCollected: new Map()
  };
}

function buildOrderStats(purchases) {
  const map = new Map();

  (purchases || []).forEach((purchase) => {
    const orderId = purchase.order_id;
    if (!orderId) return;

    if (!map.has(orderId)) {
      map.set(orderId, createEmptyStats());
    }

    const stats = map.get(orderId);
    const amount = parsePrice(purchase.paid_price ?? purchase.price);
    const pickupPoint = String(purchase.pickup_point || "").trim();

    stats.purchaseCount += 1;
    stats.expected += amount;
    if (pickupPoint) {
      stats.pickupTotals.set(pickupPoint, (stats.pickupTotals.get(pickupPoint) || 0) + amount);
    }

    if (purchase.collected) {
      stats.collected += amount;
      const collectedAt = new Date(purchase.collected_at || "");
      if (!Number.isNaN(collectedAt.getTime())) {
        const day = collectedAt.getDate();
        stats.dailyCollected.set(day, (stats.dailyCollected.get(day) || 0) + amount);
      }
    } else if (purchase.picked_up) {
      stats.pending += amount;
    } else {
      stats.notPicked += amount;
    }
  });

  return map;
}

function buildMonthData(orderRows) {
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
        collected: 0,
        expected: 0,
        spent: 0,
        purchaseCount: 0,
        orderCount: 0,
        pickupTotals: new Map(),
        dailyCollected: new Map(),
        dailySpent: new Map()
      });
    }

    const month = map.get(key);
    month.collected += order.collected;
    month.expected += order.expected;
    month.spent += order.spentAmount;
    month.purchaseCount += order.purchaseCount;
    month.orderCount += 1;

    order.pickupTotals.forEach((value, pickupPoint) => {
      month.pickupTotals.set(pickupPoint, (month.pickupTotals.get(pickupPoint) || 0) + value);
    });

    let dailyCollectedTotal = 0;
    order.dailyCollected.forEach((value, day) => {
      dailyCollectedTotal += value;
      month.dailyCollected.set(day, (month.dailyCollected.get(day) || 0) + value);
    });

    if (order.collected > dailyCollectedTotal) {
      const fallbackDay = date.getDate();
      const missing = order.collected - dailyCollectedTotal;
      month.dailyCollected.set(fallbackDay, (month.dailyCollected.get(fallbackDay) || 0) + missing);
    }

    if (order.spentAmount > 0) {
      const spentDay = date.getDate();
      month.dailySpent.set(spentDay, (month.dailySpent.get(spentDay) || 0) + order.spentAmount);
    }
  });

  const years = Array.from(new Set(Array.from(map.values()).map((item) => item.year))).sort((a, b) => a - b);
  return { map, years };
}

function topPickupPoint(pickupTotals) {
  let label = "?";
  let max = 0;

  pickupTotals.forEach((value, key) => {
    if (value > max) {
      max = value;
      label = key;
    }
  });

  return label;
}

export default function FinancePage({ embedded = false }) {
  const [profile, setProfile] = useState({
    loading: true,
    authenticated: false,
    role: "viewer"
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("orders");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [spentInput, setSpentInput] = useState("");
  const [spentSaving, setSpentSaving] = useState(false);
  const [spentMessage, setSpentMessage] = useState("");
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState("");
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [chartMode, setChartMode] = useState("status");

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const result = await getCurrentUserProfile();
        if (!mounted) return;
        setProfile({
          loading: false,
          authenticated: result.authenticated,
          role: result.role
        });
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        setProfile({ loading: false, authenticated: false, role: "viewer" });
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const loadFinanceData = useCallback(async () => {
    setLoadingData(true);
    setError("");

    try {
      const [ordersRes, purchasesRes] = await Promise.all([
        sb
          .from("orders")
          .select("id, order_name, order_date, created_at, spent_amount")
          .order("created_at", { ascending: false }),
        sb
          .from("purchases")
          .select("order_id, price, paid_price, pickup_point, collected, picked_up, collected_at")
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (purchasesRes.error) throw purchasesRes.error;

      const orderRows = (ordersRes.data || []).map((order) => ({
        ...order,
        spent_amount: parsePrice(order.spent_amount)
      }));

      setOrders(orderRows);
      setPurchases(purchasesRes.data || []);
    } catch (err) {
      console.error(err);
      setOrders([]);
      setPurchases([]);
      setError("???? ????? ?????? ???????.");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (profile.loading || !profile.authenticated || profile.role !== "rahaf") return;
    loadFinanceData();
  }, [loadFinanceData, profile.authenticated, profile.loading, profile.role]);

  const orderStats = useMemo(() => buildOrderStats(purchases), [purchases]);

  const orderRows = useMemo(() => {
    return orders.map((order) => {
      const stats = orderStats.get(order.id) || createEmptyStats();
      const collected = stats.collected;
      const expected = stats.expected;
      const pending = Math.max(0, expected - collected);
      const spentAmount = parsePrice(order.spent_amount);
      const netCollected = collected - spentAmount;
      const netExpected = expected - spentAmount;
      const progressPct = expected > 0 ? Math.round((collected / expected) * 100) : 0;
      const isComplete = pending === 0 && expected > 0;

      return {
        id: order.id,
        orderName: order.order_name || "",
        orderDate: order.order_date,
        createdAt: order.created_at,
        spentAmount,
        collected,
        pending,
        expected,
        netCollected,
        netExpected,
        progressPct,
        purchaseCount: stats.purchaseCount,
        pickupTotals: stats.pickupTotals,
        dailyCollected: stats.dailyCollected,
        statusVariant: expected === 0 ? "neutral" : isComplete ? (netCollected < 0 ? "danger" : "success") : "warning",
        statusLabel:
          expected === 0
            ? "?? ???? ???????"
            : isComplete
              ? netCollected < 0
                ? "??? ????"
                : "??? ????"
              : "??? ???????"
      };
    });
  }, [orderStats, orders]);

  const groupedOrders = useMemo(() => {
    const map = new Map();
    orderRows.forEach((order) => {
      const date = getOrderDate(order);
      const key = monthKey(date);
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: monthLabel(date),
          orders: [],
          collected: 0,
          expected: 0
        });
      }

      const group = map.get(key);
      group.orders.push(order);
      group.collected += order.collected;
      group.expected += order.expected;
    });

    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [orderRows]);

  const selectedOrder = useMemo(
    () => orderRows.find((order) => String(order.id) === String(selectedOrderId)) || null,
    [orderRows, selectedOrderId]
  );

  const monthBundle = useMemo(() => buildMonthData(orderRows), [orderRows]);

  useEffect(() => {
    if (!orderRows.length) {
      setSelectedOrderId("");
      return;
    }
    setSelectedOrderId((prev) => (prev && orderRows.some((order) => String(order.id) === String(prev)) ? prev : orderRows[0].id));
  }, [orderRows]);

  useEffect(() => {
    if (!selectedOrder) {
      setSpentInput("");
      return;
    }
    setSpentInput(selectedOrder.spentAmount ? String(selectedOrder.spentAmount) : "");
    setSpentMessage("");
  }, [selectedOrder]);

  useEffect(() => {
    const years = monthBundle.years;
    if (!years.length) {
      setSelectedYear(null);
      setSelectedMonthKey("");
      return;
    }

    setSelectedYear((prev) => {
      if (prev !== null && years.includes(prev)) return prev;
      return years[years.length - 1];
    });
  }, [monthBundle.years]);

  useEffect(() => {
    if (selectedYear === null) {
      setSelectedMonthKey("");
      return;
    }

    const monthKeysInYear = Array.from(monthBundle.map.values())
      .filter((item) => item.year === selectedYear)
      .map((item) => item.key)
      .sort();

    if (!monthKeysInYear.length) {
      setSelectedMonthKey("");
      return;
    }

    setSelectedMonthKey((prev) => (prev && monthKeysInYear.includes(prev) ? prev : monthKeysInYear[monthKeysInYear.length - 1]));
  }, [monthBundle.map, selectedYear]);

  const selectedMonth = useMemo(() => {
    if (!selectedMonthKey) return null;
    return monthBundle.map.get(selectedMonthKey) || null;
  }, [monthBundle.map, selectedMonthKey]);

  async function signOut() {
    try {
      await sb.auth.signOut();
    } catch (err) {
      console.error(err);
    } finally {
      window.location.hash = "#/login";
    }
  }

  async function saveSpent() {
    if (!selectedOrder || spentSaving) return;

    const raw = spentInput.trim();
    const value = raw === "" ? 0 : Number(raw);
    if (raw !== "" && (!Number.isFinite(value) || value < 0)) {
      setSpentMessage("??????? ??? ????.");
      return;
    }

    setSpentSaving(true);
    setSpentMessage("???? ?????...");
    const { error: updateError } = await sb.from("orders").update({ spent_amount: value }).eq("id", selectedOrder.id);
    if (updateError) {
      console.error(updateError);
      setSpentMessage("??? ?????.");
      setSpentSaving(false);
      return;
    }

    setOrders((prev) =>
      prev.map((order) => (String(order.id) === String(selectedOrder.id) ? { ...order, spent_amount: value } : order))
    );
    setSpentMessage("?? ?");
    setSpentSaving(false);
    window.setTimeout(() => setSpentMessage(""), 1500);
  }

  function monthNames() {
    return [
      "?????",
      "??????",
      "????",
      "?????",
      "????",
      "?????",
      "?????",
      "?????",
      "??????",
      "??????",
      "??????",
      "??????"
    ];
  }

  function monthDaySeries(month) {
    if (!month) return [];
    const days = new Date(month.year, month.monthIndex + 1, 0).getDate();
    const values = [];
    for (let day = 1; day <= days; day += 1) {
      const collected = month.dailyCollected.get(day) || 0;
      const spent = month.dailySpent.get(day) || 0;
      const value = chartMode === "profit" ? collected - spent : collected;
      values.push({ day, value });
    }
    return values;
  }

  if (profile.loading) {
    return (
      <div className="finance-page finance-state" dir="rtl">
        <div className="finance-note">???? ?????? ?? ??????...</div>
      </div>
    );
  }

  if (!profile.authenticated) {
    return (
      <div className="finance-page finance-state" dir="rtl">
        <div className="finance-note finance-note-danger">
          <h2>?? ???? ???? ????</h2>
          <p>???? ????? ?????? ?????.</p>
          <a href="#/login" className="finance-link">
            ??? ????? ??????
          </a>
        </div>
      </div>
    );
  }

  if (profile.role !== "rahaf") {
    return (
      <div className="finance-page finance-state" dir="rtl">
        <div className="finance-note finance-note-danger">
          <h2>?? ???? ??????</h2>
          <p>??? ?????? ????? ????? ??? ???.</p>
          <a href="#/orders" className="finance-link">
            ?????? ????????
          </a>
        </div>
      </div>
    );
  }

  const outstanding = selectedOrder ? Math.max(0, selectedOrder.expected - selectedOrder.collected) : 0;
  const monthOutstanding = selectedMonth ? Math.max(0, selectedMonth.expected - selectedMonth.collected) : 0;
  const monthProgress = selectedMonth && selectedMonth.expected > 0 ? Math.round((selectedMonth.collected / selectedMonth.expected) * 100) : 0;
  const monthSeries = monthDaySeries(selectedMonth);
  const monthPeak = monthSeries.reduce((max, item) => Math.max(max, Math.abs(item.value)), 0);
  const monthHasSeries = monthSeries.some((item) => item.value !== 0);

  return (
    <div className={`finance-page ${embedded ? "embedded" : ""}`} dir="rtl">
      {!embedded ? (
        <>
          <div className={`finance-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />
          <aside className={`finance-sidebar ${sidebarOpen ? "open" : ""}`}>
            <div className="finance-sidebar-head">
              <b>???????</b>
              <button type="button" className="finance-menu-btn danger" onClick={() => setSidebarOpen(false)}>
                ?
              </button>
            </div>
            <div className="finance-sidebar-content">
              <a href="#/orders" onClick={() => setSidebarOpen(false)}>
                ????????
              </a>
              <a href="#/pickup-dashboard" onClick={() => setSidebarOpen(false)}>
                ???????? ????????
              </a>
              <a href="#/archive" onClick={() => setSidebarOpen(false)}>
                ???????
              </a>
              <a href="#/finance" onClick={() => setSidebarOpen(false)}>
                ???????
              </a>
              <button type="button" className="danger" onClick={signOut}>
                ????? ????
              </button>
            </div>
          </aside>
        </>
      ) : null}

      <div className="finance-wrap">
        {!embedded ? (
          <div className="finance-topbar">
            <div className="finance-brand">
              <b>???????</b>
              <div className="finance-muted">???? ????????? ??????????</div>
            </div>
            <button type="button" className="finance-menu-btn" onClick={() => setSidebarOpen(true)}>
              ?
            </button>
          </div>
        ) : null}

        <div className="finance-tabs">
          <button
            type="button"
            className={`finance-tab-btn ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            ????? ???????
          </button>
          <button
            type="button"
            className={`finance-tab-btn ${activeTab === "months" ? "active" : ""}`}
            onClick={() => setActiveTab("months")}
          >
            ????? ????
          </button>
        </div>

        {error ? <div className="finance-error">{error}</div> : null}
        {loadingData ? <div className="finance-loading">???? ????? ????????...</div> : null}

        {!loadingData && activeTab === "orders" ? (
          <div className="finance-grid">
            <aside className="finance-card finance-list-card">
              <div className="finance-row">
                <b>????????</b>
                <span className="finance-pill">{orderRows.length}</span>
              </div>
              {!orderRows.length ? (
                <div className="finance-empty">
                  ?? ???? ??????
                  <div className="finance-refresh-row">
                    <button type="button" className="finance-btn" onClick={loadFinanceData}>
                      ?????
                    </button>
                  </div>
                </div>
              ) : (
                <div className="finance-order-groups">
                  {groupedOrders.map((group) => (
                    <div key={group.key} className="finance-order-group">
                      <div className="finance-group-head">
                        <div className="finance-group-title">{group.label}</div>
                        <div className="finance-group-pills">
                          <span className="finance-pill">???????: {group.orders.length}</span>
                          <span className="finance-pill">??: {formatILS(group.collected)}</span>
                          <span className="finance-pill">?????: {formatILS(Math.max(0, group.expected - group.collected))}</span>
                        </div>
                      </div>
                      {group.orders.map((order) => (
                        <button
                          key={order.id}
                          type="button"
                          className={`finance-order-item ${String(order.id) === String(selectedOrderId) ? "active" : ""}`}
                          onClick={() => setSelectedOrderId(order.id)}
                        >
                          <span>{order.orderName || "?????"}</span>
                          <span className="finance-pill">???</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </aside>

            <main className="finance-card">
              {!selectedOrder ? (
                <div className="finance-empty">?????? ????? ?? ???????</div>
              ) : (
                <>
                  <div className="finance-row">
                    <b>{selectedOrder.orderName || "?????"}</b>
                    <span className={`finance-status ${selectedOrder.statusVariant}`}>{selectedOrder.statusLabel}</span>
                  </div>

                  <div className="finance-kpi-grid">
                    <div className="finance-kpi">
                      <div className="label">?? ??????</div>
                      <div className="value">{formatILS(selectedOrder.collected)}</div>
                    </div>
                    <div className="finance-kpi">
                      <div className="label">????? ???????</div>
                      <div className="value">{formatILS(outstanding)}</div>
                    </div>
                    <div className="finance-kpi">
                      <div className="label">?????? ?????</div>
                      <div className="value">{formatILS(selectedOrder.expected)}</div>
                    </div>
                  </div>

                  <div className="finance-progress-wrap">
                    {selectedOrder.expected > 0 ? (
                      <>
                        <div className="finance-progress-head">
                          <span>{formatILS(selectedOrder.collected)} ?? {formatILS(selectedOrder.expected)} ?? ???????</span>
                          <span>{selectedOrder.progressPct}% ?????</span>
                        </div>
                        <div className="finance-progress">
                          <span style={{ width: `${selectedOrder.progressPct}%` }} />
                        </div>
                      </>
                    ) : (
                      <div className="finance-muted">?? ???? ????? ???</div>
                    )}
                  </div>

                  <div className="finance-kpi-grid compact">
                    {selectedOrder.pending === 0 && selectedOrder.expected > 0 ? (
                      <div className="finance-kpi">
                        <div className="label">???? ?????</div>
                        <div className={`value ${selectedOrder.netCollected < 0 ? "neg" : ""}`}>
                          {formatILS(selectedOrder.netCollected)}
                        </div>
                      </div>
                    ) : null}
                    <div className="finance-kpi">
                      <div className="label">{selectedOrder.netExpected < 0 ? "???????" : "???? ?????"}</div>
                      <div className={`value ${selectedOrder.netExpected < 0 ? "neg" : ""}`}>
                        {formatILS(selectedOrder.netExpected)}
                      </div>
                    </div>
                    <div className="finance-kpi">
                      <div className="label">???????</div>
                      <div className="value">{formatILS(selectedOrder.spentAmount)}</div>
                    </div>
                  </div>

                  <div className="finance-spent-row">
                    <label htmlFor="financeSpentInput">???????:</label>
                    <input
                      id="financeSpentInput"
                      type="number"
                      step="0.01"
                      min="0"
                      value={spentInput}
                      onChange={(event) => setSpentInput(event.target.value)}
                      placeholder="??????? ??? ???????"
                    />
                    <button type="button" className="finance-btn primary" onClick={saveSpent} disabled={spentSaving}>
                      {spentSaving ? "???? ?????..." : "??? ???????"}
                    </button>
                    {spentMessage ? <span className="finance-muted">{spentMessage}</span> : null}
                  </div>
                </>
              )}
            </main>
          </div>
        ) : null}

        {!loadingData && activeTab === "months" ? (
          <main className="finance-card">
            <div className="finance-row center">
              <div className="finance-section-title">???? ????</div>
              <button type="button" className="finance-btn" onClick={() => setMonthPickerOpen((prev) => !prev)}>
                {monthPickerOpen ? "????? ?????? ?????" : "?????? ?????"}
              </button>
            </div>

            {monthPickerOpen ? (
              <div className="finance-month-picker">
                <div className="finance-month-header">
                  <button
                    type="button"
                    className="finance-btn mini"
                    disabled={!monthBundle.years.length || selectedYear === monthBundle.years[0]}
                    onClick={() =>
                      setSelectedYear((prev) => {
                        if (prev === null) return prev;
                        const idx = monthBundle.years.indexOf(prev);
                        if (idx <= 0) return prev;
                        return monthBundle.years[idx - 1];
                      })
                    }
                  >
                    ?
                  </button>
                  <b>{selectedYear ?? "?"}</b>
                  <button
                    type="button"
                    className="finance-btn mini"
                    disabled={!monthBundle.years.length || selectedYear === monthBundle.years[monthBundle.years.length - 1]}
                    onClick={() =>
                      setSelectedYear((prev) => {
                        if (prev === null) return prev;
                        const idx = monthBundle.years.indexOf(prev);
                        if (idx < 0 || idx >= monthBundle.years.length - 1) return prev;
                        return monthBundle.years[idx + 1];
                      })
                    }
                  >
                    ?
                  </button>
                </div>
                <div className="finance-month-grid">
                  {monthNames().map((name, idx) => {
                    const key = `${selectedYear}-${String(idx + 1).padStart(2, "0")}`;
                    const hasData = monthBundle.map.has(key);
                    return (
                      <button
                        key={name}
                        type="button"
                        className={`finance-month-btn ${selectedMonthKey === key ? "active" : ""}`}
                        disabled={!hasData}
                        onClick={() => {
                          setSelectedMonthKey(key);
                          setMonthPickerOpen(false);
                        }}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {!selectedMonth ? (
              <div className="finance-empty">
                ?? ???? ?????? ?????
                <div className="finance-refresh-row">
                  <button type="button" className="finance-btn" onClick={loadFinanceData}>
                    ?????
                  </button>
                </div>
              </div>
            ) : (
              <div className="finance-month-shell">
                <div className="finance-row">
                  <b>{selectedMonth.label}</b>
                  <span className={`finance-status ${monthOutstanding === 0 && selectedMonth.expected > 0 ? "success" : selectedMonth.expected === 0 ? "neutral" : "warning"}`}>
                    {selectedMonth.expected === 0 ? "?? ???? ???????" : monthOutstanding === 0 ? "?????" : "??? ???????"}
                  </span>
                </div>

                <div className="finance-health-row">
                  <span className="finance-pill">???????: {selectedMonth.orderCount}</span>
                  <span className="finance-pill">?????????: {selectedMonth.purchaseCount}</span>
                  <span className="finance-pill">???? ???????: {monthProgress}%</span>
                  <span className="finance-pill">???? ????: {topPickupPoint(selectedMonth.pickupTotals)}</span>
                </div>

                <div className="finance-kpi-grid">
                  <div className="finance-kpi">
                    <div className="label">?? ??????</div>
                    <div className="value">{formatILS(selectedMonth.collected)}</div>
                  </div>
                  <div className="finance-kpi">
                    <div className="label">????? ???????</div>
                    <div className="value">{formatILS(monthOutstanding)}</div>
                  </div>
                  <div className="finance-kpi">
                    <div className="label">?????? ?????</div>
                    <div className="value">{formatILS(selectedMonth.expected)}</div>
                  </div>
                </div>

                <div className="finance-progress-wrap">
                  {selectedMonth.expected > 0 ? (
                    <>
                      <div className="finance-progress-head">
                        <span>{formatILS(selectedMonth.collected)} ?? {formatILS(selectedMonth.expected)} ?? ???????</span>
                        <span>{monthProgress}% ?????</span>
                      </div>
                      <div className="finance-progress">
                        <span style={{ width: `${monthProgress}%` }} />
                      </div>
                    </>
                  ) : (
                    <div className="finance-muted">?? ???? ????? ???</div>
                  )}
                </div>

                <div className="finance-kpi-grid compact">
                  {monthOutstanding === 0 && selectedMonth.expected > 0 ? (
                    <div className="finance-kpi">
                      <div className="label">???? ?????</div>
                      <div className={`value ${selectedMonth.collected - selectedMonth.spent < 0 ? "neg" : ""}`}>
                        {formatILS(selectedMonth.collected - selectedMonth.spent)}
                      </div>
                    </div>
                  ) : null}
                  <div className="finance-kpi">
                    <div className="label">{selectedMonth.expected - selectedMonth.spent < 0 ? "???????" : "???? ?????"}</div>
                    <div className={`value ${selectedMonth.expected - selectedMonth.spent < 0 ? "neg" : ""}`}>
                      {formatILS(selectedMonth.expected - selectedMonth.spent)}
                    </div>
                  </div>
                  <div className="finance-kpi">
                    <div className="label">???????</div>
                    <div className="value">{formatILS(selectedMonth.spent)}</div>
                  </div>
                </div>

                <div className="finance-segmented">
                  <button
                    type="button"
                    className={chartMode === "status" ? "active" : ""}
                    onClick={() => setChartMode("status")}
                  >
                    ???? ???????
                  </button>
                  <button
                    type="button"
                    className={chartMode === "profit" ? "active" : ""}
                    onClick={() => setChartMode("profit")}
                  >
                    ???????
                  </button>
                </div>

                <div className="finance-chart-card">
                  {!monthHasSeries ? (
                    <div className="finance-muted">
                      {chartMode === "profit" ? "?? ???? ???? ???? ???" : "?? ???? ????? ???? ??? ????? ???"}
                    </div>
                  ) : (
                    <div className="finance-day-bars">
                      {monthSeries.map((point) => {
                        const heightPct = monthPeak ? Math.max(6, Math.round((Math.abs(point.value) / monthPeak) * 100)) : 0;
                        return (
                          <div key={point.day} className="finance-day-bar-wrap" title={`??? ${point.day}: ${formatILS(point.value)}`}>
                            <span
                              className={`finance-day-bar ${point.value < 0 ? "neg" : ""}`}
                              style={{ height: `${heightPct}%` }}
                            />
                            <small>{point.day}</small>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        ) : null}
      </div>
    </div>
  );
}
