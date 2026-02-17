import { useEffect } from "react";

export default function OrdersBottomSheet({
  open = false,
  onClose,
  groupedOrders,
  ordersLoading,
  ordersError,
  selectedOrderId,
  onSelectOrder,
  isRahaf,
  onForceOrdersTab
}) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="orders-sheet-overlay" onClick={onClose}>
      <div className="orders-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="orders-sheet-handle" />

        <div className="orders-sheet-head">
          <strong>اختيار الطلب</strong>
          <button type="button" className="icon-btn tiny" onClick={onClose} aria-label="إغلاق قائمة الطلبات">
            ✕
          </button>
        </div>

        <div className="orders-sheet-list">
          {ordersLoading ? <div className="orders-horizontal-empty">جاري تحميل الطلبات...</div> : null}

          {!ordersLoading && ordersError ? <div className="orders-horizontal-empty orders-horizontal-error">{ordersError}</div> : null}

          {!ordersLoading && !ordersError && !groupedOrders.length ? (
            <div className="orders-horizontal-empty">لا توجد طلبات مطابقة.</div>
          ) : null}

          {!ordersLoading && !ordersError
            ? groupedOrders.map((group) => (
                <div key={group.month} className="orders-sheet-group">
                  <span className="orders-sheet-month">{group.month}</span>

                  <div className="orders-sheet-group-list">
                    {group.orders.map((order) => {
                      const selected = String(selectedOrderId) === String(order.id);
                      return (
                        <button
                          key={order.id}
                          type="button"
                          className={`orders-sheet-item ${selected ? "selected" : ""}`}
                          onClick={() => {
                            onSelectOrder(order.id);
                            if (isRahaf) onForceOrdersTab();
                            onClose?.();
                          }}
                        >
                          <span className="order-name">{order.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            : null}
        </div>
      </div>
    </div>
  );
}
