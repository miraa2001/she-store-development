export default function HorizontalOrderPicker({
  groupedOrders,
  ordersLoading,
  ordersError,
  selectedOrderId,
  onSelectOrder,
  isRahaf,
  onForceOrdersTab
}) {
  const orders = (groupedOrders || []).flatMap((group) => group.orders || []);

  const orderInitial = (name) => {
    const text = String(name || "").trim();
    return text ? text.charAt(0) : "؟";
  };

  if (ordersLoading) {
    return (
      <div className="orders-horizontal-scroll-wrap">
        <div className="orders-horizontal-empty">جاري تحميل الطلبات...</div>
      </div>
    );
  }

  if (ordersError) {
    return (
      <div className="orders-horizontal-scroll-wrap">
        <div className="orders-horizontal-empty orders-horizontal-error">{ordersError}</div>
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="orders-horizontal-scroll-wrap">
        <div className="orders-horizontal-empty">لا توجد طلبات مطابقة.</div>
      </div>
    );
  }

  return (
    <div className="orders-horizontal-scroll-wrap">
      <div className="orders-horizontal-scroll" role="listbox" aria-label="اختيار الطلب">
        {orders.map((order) => {
          const selected = String(selectedOrderId) === String(order.id);
          return (
            <button
              key={order.id}
              type="button"
              role="option"
              aria-selected={selected}
              className={`orders-horizontal-pill ${selected ? "selected" : ""}`}
              onClick={() => {
                onSelectOrder(order.id);
                if (isRahaf) onForceOrdersTab();
              }}
              title={order.name}
            >
              <span className="initial">{orderInitial(order.name)}</span>
              <span className="order-id">#{order.orderNo}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
