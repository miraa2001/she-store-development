import { useState, useRef, useEffect } from "react";

/**
 * OrdersBottomSheet — Mobile bottom sheet (replaces HorizontalOrderPicker)
 *
 * Props mirror HorizontalOrderPicker for drop-in compatibility:
 *   groupedOrders, ordersLoading, ordersError,
 *   selectedOrderId, onSelectOrder, isRahaf, onForceOrdersTab,
 *   totalOrders, statusLabel
 */
export default function OrdersBottomSheet({
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
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef(null);
  const dragStartY = useRef(null);
  const searchRef = useRef(null);

  const allOrders = groupedOrders.flatMap((g) => g.orders);
  const selectedOrder = allOrders.find((o) => String(o.id) === String(selectedOrderId));

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => searchRef.current?.focus(), 200);
    } else {
      document.body.style.overflow = "";
      setSearch("");
      setDragY(0);
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Drag to dismiss
  const onDragStart = (clientY) => {
    dragStartY.current = clientY;
    setIsDragging(true);
  };
  const onDragMove = (clientY) => {
    if (!isDragging || dragStartY.current === null) return;
    const delta = clientY - dragStartY.current;
    if (delta > 0) setDragY(delta);
  };
  const onDragEnd = () => {
    setIsDragging(false);
    if (dragY > 100) {
      setOpen(false);
    } else {
      setDragY(0);
    }
    dragStartY.current = null;
  };

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
        /* ── Sticky bar at bottom of screen ── */
        .obs-bar {
          position: fixed;
          bottom: 0;
          left: 0; right: 0;
          z-index: 40;
          padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-top: 1px solid #dde7e3;
          box-shadow: 0 -4px 24px rgba(15,23,42,0.08);
        }
        .obs-bar-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: #fff;
          border: 1.5px solid #dde7e3;
          border-radius: 14px;
          cursor: pointer;
          font-family: inherit;
          color: #334155;
          box-shadow: 0 2px 8px rgba(15,23,42,0.06);
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .obs-bar-btn:active {
          background: #f5faf8;
          border-color: #4f8a7b;
        }
        .obs-bar-icon {
          width: 32px; height: 32px;
          border-radius: 9px;
          background: linear-gradient(135deg,#4f8a7b,#3d6f61);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          color: #fff;
        }
        .obs-bar-label {
          flex: 1; min-width: 0; text-align: right;
        }
        .obs-bar-label span {
          display: block;
          font-size: 11px;
          color: #94a3b8;
          margin-bottom: 1px;
        }
        .obs-bar-label strong {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .obs-bar-count {
          background: rgba(79,138,123,0.1);
          color: #3d6f61;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          flex-shrink: 0;
        }
        .obs-bar-chevron {
          color: #94a3b8;
          flex-shrink: 0;
          transition: transform 0.2s;
        }

        /* ── Backdrop ── */
        .obs-backdrop {
          position: fixed;
          inset: 0;
          z-index: 45;
          background: rgba(10,20,15,0.45);
          animation: obs-fade 0.2s ease;
        }
        @keyframes obs-fade {
          from { opacity: 0; } to { opacity: 1; }
        }

        /* ── Sheet ── */
        .obs-sheet {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 50;
          background: #fff;
          border-radius: 22px 22px 0 0;
          box-shadow: 0 -8px 40px rgba(15,23,42,0.2);
          display: flex;
          flex-direction: column;
          max-height: 82dvh;
          padding-bottom: env(safe-area-inset-bottom);
          animation: obs-slide-up 0.28s cubic-bezier(0.16,1,0.3,1);
          will-change: transform;
        }
        @keyframes obs-slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .obs-sheet.is-closing {
          animation: obs-slide-down 0.22s cubic-bezier(0.4,0,1,1) forwards;
        }
        @keyframes obs-slide-down {
          to { transform: translateY(100%); }
        }

        /* drag handle area */
        .obs-handle-area {
          padding: 10px 0 4px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
          touch-action: none;
          user-select: none;
        }
        .obs-handle {
          width: 40px; height: 4px;
          border-radius: 999px;
          background: #d1dbd6;
        }
        .obs-sheet-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 0 16px 8px;
        }
        .obs-sheet-title h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #111827;
        }
        .obs-sheet-title span {
          font-size: 12px;
          color: #94a3b8;
        }
        .obs-close-btn {
          width: 32px; height: 32px;
          border-radius: 999px;
          border: 1px solid #e5ece8;
          background: #f5faf8;
          color: #64748b;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          flex-shrink: 0;
        }

        /* search */
        .obs-search {
          padding: 0 14px 10px;
          flex-shrink: 0;
          border-bottom: 1px solid #f0f5f2;
          position: relative;
        }
        .obs-search input {
          width: 100%;
          height: 40px;
          border: 1px solid #dde7e3;
          border-radius: 12px;
          background: #f8fbfa;
          padding: 0 36px 0 12px;
          font-family: inherit;
          font-size: 14px;
          color: #111827;
          outline: none;
          -webkit-appearance: none;
        }
        .obs-search input:focus {
          border-color: #4f8a7b;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(79,138,123,0.1);
        }
        .obs-search-icon {
          position: absolute;
          right: 26px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        /* list */
        .obs-list {
          flex: 1;
          overflow-y: auto;
          padding: 10px 14px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .obs-list::-webkit-scrollbar { display: none; }

        .obs-month-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #4f8a7b;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 8px 2px 4px;
          position: sticky;
          top: 0;
          background: #fff;
          z-index: 1;
        }
        .obs-month-pip {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #4f8a7b;
        }
        .obs-month-count {
          margin-right: auto;
          background: #f0f6f4;
          border-radius: 999px;
          padding: 1px 6px;
          font-size: 10px;
          color: #64748b;
        }
        .obs-order-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 12px;
          border: 1px solid transparent;
          border-radius: 12px;
          background: transparent;
          cursor: pointer;
          font-family: inherit;
          text-align: right;
          color: #334155;
          margin-bottom: 4px;
          transition: background 0.15s, border-color 0.15s;
          -webkit-tap-highlight-color: transparent;
          min-height: 56px;
        }
        .obs-order-btn:active {
          background: #f0f7f4;
        }
        .obs-order-btn.selected {
          background: linear-gradient(135deg,rgba(79,138,123,0.1),rgba(61,111,97,0.06));
          border-color: rgba(79,138,123,0.35);
        }
        .obs-order-status-dot {
          width: 9px; height: 9px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .obs-order-status-dot.completed  { background: #12b76a; }
        .obs-order-status-dot.pending    { background: #f0a500; }
        .obs-order-status-dot.processing { background: #3b82f6; }
        .obs-order-info {
          flex: 1; min-width: 0;
        }
        .obs-order-info strong {
          display: block;
          font-size: 14px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #111827;
        }
        .obs-order-info span {
          display: block;
          font-size: 12px;
          color: #94a3b8;
          margin-top: 2px;
        }
        .obs-order-btn.selected .obs-order-info strong { color: #1a4f44; }
        .obs-order-btn.selected .obs-order-info span   { color: #6aab96; }
        .obs-order-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          flex-shrink: 0;
        }
        .obs-order-amount {
          font-size: 13px;
          font-weight: 700;
          color: #3d6f61;
        }
        .obs-status-badge {
          font-size: 10px;
          border-radius: 999px;
          padding: 2px 7px;
          font-weight: 600;
        }
        .obs-status-badge.completed  { background: #dcfce7; color: #15803d; }
        .obs-status-badge.pending    { background: #fef3c7; color: #b45309; }
        .obs-status-badge.processing { background: #dbeafe; color: #1d4ed8; }

        .obs-empty {
          padding: 32px 0;
          text-align: center;
          color: #94a3b8;
          font-size: 14px;
        }

        /* ── Space so content isn't hidden behind fixed bar ── */
        .obs-page-spacer {
          height: calc(72px + env(safe-area-inset-bottom));
        }
      `}</style>

      {/* Content spacer so page content isn't hidden behind bar */}
      <div className="obs-page-spacer" />

      {/* Fixed bottom trigger bar */}
      <div className="obs-bar">
        <button className="obs-bar-btn" onClick={() => setOpen(true)}>
          <span className="obs-bar-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
          </span>
          <span className="obs-bar-label">
            <span>الطلب الحالي</span>
            <strong>{selectedOrder ? selectedOrder.name : "اختر طلباً…"}</strong>
          </span>
          {totalOrders > 0 && <span className="obs-bar-count">{totalOrders} طلب</span>}
          <svg className="obs-bar-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
      </div>

      {/* Bottom sheet */}
      {open && (
        <>
          <div className="obs-backdrop" onClick={() => setOpen(false)} />
          <div
            className="obs-sheet"
            ref={sheetRef}
            style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }}
            role="dialog"
            aria-modal="true"
            aria-label="قائمة الطلبات"
          >
            {/* Drag handle */}
            <div
              className="obs-handle-area"
              onTouchStart={(e) => onDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => onDragMove(e.touches[0].clientY)}
              onTouchEnd={onDragEnd}
              onMouseDown={(e) => onDragStart(e.clientY)}
              onMouseMove={(e) => isDragging && onDragMove(e.clientY)}
              onMouseUp={onDragEnd}
            >
              <div className="obs-handle" />
              <div className="obs-sheet-title">
                <h3>الطلبات</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{totalOrders} طلب</span>
                  <button className="obs-close-btn" onClick={() => setOpen(false)} aria-label="إغلاق">✕</button>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="obs-search">
              <input
                ref={searchRef}
                type="text"
                placeholder="بحث باسم العميل أو رقم الطلب…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <svg className="obs-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>

            {/* Order list */}
            <div className="obs-list" role="listbox">
              {ordersLoading && <div className="obs-empty">جاري تحميل الطلبات…</div>}
              {!ordersLoading && ordersError && <div className="obs-empty" style={{color:"#b42318"}}>{ordersError}</div>}
              {!ordersLoading && !ordersError && !filtered.length && (
                <div className="obs-empty">{search ? "لا توجد نتائج مطابقة" : "لا توجد طلبات"}</div>
              )}
              {!ordersLoading && !ordersError && filtered.map((group) => (
                <div key={group.month}>
                  <div className="obs-month-label">
                    <span className="obs-month-pip" />
                    {group.month}
                    <span className="obs-month-count">{group.orders.length}</span>
                  </div>
                  {group.orders.map((order) => {
                    const selected = String(selectedOrderId) === String(order.id);
                    const status = order.status || "pending";
                    return (
                      <button
                        key={order.id}
                        className={`obs-order-btn${selected ? " selected" : ""}`}
                        role="option"
                        aria-selected={selected}
                        onClick={() => handleSelect(order.id)}
                      >
                        <span className={`obs-order-status-dot ${status}`} />
                        <span className="obs-order-info">
                          <strong>{order.name}</strong>
                          <span>#{order.orderNo} · {order.purchaseCount || 0} قطعة</span>
                        </span>
                        <span className="obs-order-right">
                          <span className="obs-order-amount">{order.amountLabel}</span>
                          <span className={`obs-status-badge ${status}`}>{statusLabel(status)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
