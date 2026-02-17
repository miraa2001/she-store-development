import { useState, useRef, useEffect } from "react";

/**
 * OrdersDrawer — Desktop top drawer (replaces vertical sidebar)
 *
 * Props mirror OrdersSidebar for drop-in compatibility:
 *   groupedOrders, ordersLoading, ordersError,
 *   selectedOrderId, onSelectOrder, isRahaf,
 *   onForceOrdersTab, totalOrders, statusLabel
 */
export default function OrdersDrawer({
  groupedOrders = [],
  ordersLoading,
  ordersError,
  selectedOrderId,
  onSelectOrder,
  isRahaf,
  onForceOrdersTab,
  totalOrders,
  statusLabel,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const drawerRef = useRef(null);
  const searchRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus search when drawer opens
  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 120);
    } else {
      setSearch("");
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const allOrders = groupedOrders.flatMap((g) => g.orders);
  const selectedOrder = allOrders.find((o) => String(o.id) === String(selectedOrderId));

  const needle = search.trim().toLowerCase();
  const filtered = !needle
    ? groupedOrders
    : groupedOrders
        .map((g) => ({ ...g, orders: g.orders.filter((o) => o.name.toLowerCase().includes(needle) || o.orderNo?.toLowerCase().includes(needle)) }))
        .filter((g) => g.orders.length > 0);

  const handleSelect = (id) => {
    onSelectOrder(id);
    if (isRahaf) onForceOrdersTab();
    setOpen(false);
  };

  return (
    <>
      <style>{`
        .od-trigger {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 14px;
          background: #fff;
          border: 1px solid #dde7e3;
          border-radius: 12px;
          cursor: pointer;
          color: #334155;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
          min-width: 220px;
          max-width: 320px;
          box-shadow: 0 1px 3px rgba(15,23,42,0.07);
          position: relative;
        }
        .od-trigger:hover {
          border-color: #b0cdc5;
          background: #f8fbfa;
          box-shadow: 0 2px 8px rgba(79,138,123,0.1);
        }
        .od-trigger.is-open {
          border-color: #4f8a7b;
          box-shadow: 0 0 0 3px rgba(79,138,123,0.12);
          background: #f5faf8;
        }
        .od-trigger-icon {
          width: 28px; height: 28px;
          border-radius: 8px;
          background: linear-gradient(135deg,#4f8a7b,#3d6f61);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          color: #fff;
        }
        .od-trigger-label {
          flex: 1;
          min-width: 0;
          text-align: right;
        }
        .od-trigger-label span {
          display: block;
          font-size: 11px;
          color: #94a3b8;
          font-weight: 400;
          margin-bottom: 1px;
        }
        .od-trigger-label strong {
          display: block;
          font-size: 13px;
          color: #111827;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .od-trigger-caret {
          color: #94a3b8;
          flex-shrink: 0;
          transition: transform 0.2s;
        }
        .od-trigger.is-open .od-trigger-caret {
          transform: rotate(180deg);
        }
        .od-count-badge {
          background: rgba(79,138,123,0.1);
          color: #3d6f61;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 7px;
          flex-shrink: 0;
        }

        /* Drawer */
        .od-drawer-wrap {
          position: relative;
          z-index: 30;
        }
        .od-backdrop {
          position: fixed;
          inset: 0;
          z-index: 28;
          background: rgba(15,23,42,0.18);
          backdrop-filter: blur(1px);
          animation: od-fade-in 0.18s ease;
        }
        @keyframes od-fade-in {
          from { opacity: 0; } to { opacity: 1; }
        }
        .od-drawer {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          z-index: 29;
          width: min(520px, 90vw);
          background: #fff;
          border: 1px solid #dde7e3;
          border-radius: 16px;
          box-shadow: 0 16px 48px rgba(15,23,42,0.16), 0 2px 8px rgba(15,23,42,0.08);
          overflow: hidden;
          animation: od-slide-down 0.22s cubic-bezier(0.16,1,0.3,1);
          transform-origin: top right;
        }
        @keyframes od-slide-down {
          from { opacity: 0; transform: translateY(-10px) scaleY(0.96); }
          to   { opacity: 1; transform: translateY(0) scaleY(1); }
        }

        /* Search */
        .od-search-wrap {
          padding: 12px 12px 8px;
          border-bottom: 1px solid #f0f4f2;
          position: sticky;
          top: 0;
          background: #fff;
          z-index: 2;
        }
        .od-search-inner {
          position: relative;
        }
        .od-search-inner input {
          width: 100%;
          height: 38px;
          border: 1px solid #dde7e3;
          border-radius: 10px;
          background: #f8fbfa;
          padding: 0 36px 0 12px;
          font-family: inherit;
          font-size: 13px;
          color: #111827;
          outline: none;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .od-search-inner input:focus {
          border-color: #4f8a7b;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(79,138,123,0.1);
        }
        .od-search-icon {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        /* Order list */
        .od-list {
          max-height: 380px;
          overflow-y: auto;
          padding: 8px;
          scrollbar-width: thin;
          scrollbar-color: #dde7e3 transparent;
        }
        .od-month-label {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px 4px;
          font-size: 11px;
          font-weight: 700;
          color: #4f8a7b;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          position: sticky;
          top: 0;
          background: #fff;
          z-index: 1;
        }
        .od-month-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #4f8a7b;
          flex-shrink: 0;
        }
        .od-month-count {
          margin-right: auto;
          background: #f0f6f4;
          border-radius: 999px;
          padding: 1px 6px;
          font-size: 10px;
          color: #64748b;
        }
        .od-order-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 10px;
          border: 1px solid transparent;
          border-radius: 10px;
          background: transparent;
          cursor: pointer;
          font-family: inherit;
          text-align: right;
          color: #334155;
          transition: background 0.15s, border-color 0.15s, transform 0.15s;
          margin-bottom: 2px;
        }
        .od-order-btn:hover {
          background: #f5faf8;
          border-color: #dde7e3;
          transform: translateX(-2px);
        }
        .od-order-btn.selected {
          background: linear-gradient(135deg,rgba(79,138,123,0.1),rgba(61,111,97,0.06));
          border-color: rgba(79,138,123,0.35);
          color: #1a4f44;
        }
        .od-order-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .od-order-dot.completed { background: #12b76a; }
        .od-order-dot.pending   { background: #f0a500; }
        .od-order-dot.processing { background: #3b82f6; }
        .od-order-info {
          flex: 1;
          min-width: 0;
        }
        .od-order-info strong {
          display: block;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .od-order-info span {
          font-size: 11px;
          color: #94a3b8;
        }
        .od-order-btn.selected .od-order-info span {
          color: #6aab96;
        }
        .od-order-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 3px;
          flex-shrink: 0;
        }
        .od-order-amount {
          font-size: 12px;
          font-weight: 700;
          color: #3d6f61;
        }
        .od-order-btn.selected .od-order-amount { color: #2a5e52; }
        .od-status-dot {
          font-size: 10px;
          border-radius: 999px;
          padding: 2px 7px;
          font-weight: 600;
        }
        .od-status-dot.completed { background: #dcfce7; color: #15803d; }
        .od-status-dot.pending   { background: #fef3c7; color: #b45309; }
        .od-status-dot.processing { background: #dbeafe; color: #1d4ed8; }

        .od-empty {
          padding: 24px;
          text-align: center;
          color: #94a3b8;
          font-size: 13px;
        }

        /* Footer */
        .od-footer {
          padding: 8px 12px;
          border-top: 1px solid #f0f4f2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fafcfb;
        }
        .od-footer span {
          font-size: 11px;
          color: #94a3b8;
        }
        .od-footer strong {
          color: #4f8a7b;
        }
      `}</style>

      <div className="od-drawer-wrap" ref={drawerRef}>
        {/* Trigger button */}
        <button
          className={`od-trigger${open ? " is-open" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span className="od-trigger-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
          </span>
          <span className="od-trigger-label">
            <span>الطلب الحالي</span>
            <strong>{selectedOrder ? selectedOrder.name : "اختر طلباً…"}</strong>
          </span>
          {totalOrders > 0 && <span className="od-count-badge">{totalOrders}</span>}
          <svg className="od-trigger-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {/* Drawer */}
        {open && (
          <>
            <div className="od-backdrop" onClick={() => setOpen(false)} />
            <div className="od-drawer" role="listbox" aria-label="قائمة الطلبات">
              {/* Search */}
              <div className="od-search-wrap">
                <div className="od-search-inner">
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="بحث باسم العميل أو رقم الطلب…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <svg className="od-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>
              </div>

              {/* List */}
              <div className="od-list">
                {ordersLoading && <div className="od-empty">جاري تحميل الطلبات…</div>}
                {!ordersLoading && ordersError && <div className="od-empty" style={{color:"#b42318"}}>{ordersError}</div>}
                {!ordersLoading && !ordersError && !filtered.length && (
                  <div className="od-empty">{search ? "لا توجد نتائج مطابقة" : "لا توجد طلبات"}</div>
                )}
                {!ordersLoading && !ordersError && filtered.map((group) => (
                  <div key={group.month}>
                    <div className="od-month-label">
                      <span className="od-month-dot" />
                      {group.month}
                      <span className="od-month-count">{group.orders.length}</span>
                    </div>
                    {group.orders.map((order) => {
                      const selected = String(selectedOrderId) === String(order.id);
                      const status = order.status || "pending";
                      return (
                        <button
                          key={order.id}
                          className={`od-order-btn${selected ? " selected" : ""}`}
                          role="option"
                          aria-selected={selected}
                          onClick={() => handleSelect(order.id)}
                        >
                          <span className={`od-order-dot ${status}`} />
                          <span className="od-order-info">
                            <strong>{order.name}</strong>
                            <span>#{order.orderNo} · {order.purchaseCount || 0} قطعة</span>
                          </span>
                          <span className="od-order-right">
                            <span className="od-order-amount">{order.amountLabel}</span>
                            <span className={`od-status-dot ${status}`}>{statusLabel(status)}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="od-footer">
                <span>اضغط <strong>Esc</strong> للإغلاق</span>
                <span><strong>{totalOrders}</strong> طلب إجمالي</span>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
