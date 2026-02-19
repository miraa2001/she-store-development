import { useEffect } from "react";
import SheStoreLogo from "../common/SheStoreLogo";

export default function OrdersDrawer({
  open = false,
  onClose,
  groupedOrders,
  ordersLoading,
  ordersError,
  selectedOrderId,
  onSelectOrder,
  isRahaf,
  onForceOrdersTab,
  totalOrders,
  statusLabel,
  Icon
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
    <div className="orders-drawer-overlay" onClick={onClose}>
      <aside className="orders-drawer-panel" onClick={(event) => event.stopPropagation()}>
        <div className="orders-drawer-head">
          <div className="workspace-brand">
            <SheStoreLogo className="she-store-logo-link orders-drawer-logo-link" imageClassName="she-store-logo-img orders-drawer-logo-img" />
            <div>
              <h3>الطلبات</h3>
              <p>{totalOrders} طلب</p>
            </div>
          </div>
          <button type="button" className="icon-btn tiny" onClick={onClose} aria-label="إغلاق قائمة الطلبات">
            <Icon name="close" className="icon" />
          </button>
        </div>

        <div className="orders-drawer-list">
          {ordersLoading ? <div className="workspace-empty">جاري تحميل الطلبات...</div> : null}

          {!ordersLoading && ordersError ? <div className="workspace-empty workspace-error">{ordersError}</div> : null}

          {!ordersLoading && !ordersError && !groupedOrders.length ? (
            <div className="workspace-empty">لا توجد نتائج مطابقة.</div>
          ) : null}

          {!ordersLoading && !ordersError
            ? groupedOrders.map((group) => (
                <section key={group.month} className="group-block">
                  <div className="month-chip">
                    <Icon name="calendar" className="icon" />
                    <span>{group.month}</span>
                    <b>({group.orders.length})</b>
                  </div>

                  <div className="group-orders">
                    {group.orders.map((order) => {
                      const selected = String(selectedOrderId) === String(order.id);

                      return (
                        <button
                          key={order.id}
                          type="button"
                          className={`order-row ${selected ? "selected" : ""}`}
                          onClick={() => {
                            onSelectOrder(order.id);
                            if (isRahaf) onForceOrdersTab();
                            onClose?.();
                          }}
                        >
                          <div className="order-main">
                            <strong>{order.name}</strong>
                            <span>#{order.orderNo}</span>
                          </div>

                          <div className="order-meta">
                            <b>{order.amountLabel}</b>
                            <small className={`status ${order.status}`}>{statusLabel(order.status)}</small>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            : null}
        </div>
      </aside>
    </div>
  );
}
