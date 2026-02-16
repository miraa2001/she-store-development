export default function OrdersSidebar({
  collapsed,
  sidebarWidth,
  onStartResize,
  groupedOrders,
  ordersLoading,
  ordersError,
  selectedOrderId,
  onSelectOrder,
  isRahaf,
  onForceOrdersTab,
  totalOrders,
  statusLabel,
  onExpand,
  onCollapse,
  Icon
}) {
  const collapsedOrders = groupedOrders.flatMap((group) => group.orders).slice(0, 8);

  const orderInitial = (name) => {
    const text = String(name || "").trim();
    return text ? text.charAt(0) : "؟";
  };

  const orderTooltip = (order) =>
    `${order.name}\n#${order.orderNo} • ${order.purchaseCount || 0} ق\n${order.amountLabel} • ${statusLabel(order.status)}`;

  if (collapsed) {
    return (
      <aside className="workspace-collapsed">
        <button className="icon-btn collapsed-expand" onClick={onExpand} aria-label="توسيع القائمة">
          <Icon name="chevron-left" className="icon" />
        </button>

        <div className="collapsed-orders-list">
          {ordersLoading ? <div className="collapsed-empty">...</div> : null}

          {!ordersLoading && ordersError ? <div className="collapsed-empty">!</div> : null}

          {!ordersLoading && !ordersError && !collapsedOrders.length ? (
            <div className="collapsed-empty">0</div>
          ) : null}

          {!ordersLoading && !ordersError
            ? collapsedOrders.map((order) => {
                const selected = String(selectedOrderId) === String(order.id);
                return (
                  <button
                    key={order.id}
                    type="button"
                    className={`collapsed-order-card ${selected ? "selected" : ""}`}
                    data-tooltip={orderTooltip(order)}
                    title={orderTooltip(order)}
                    onClick={() => {
                      onSelectOrder(order.id);
                      if (isRahaf) onForceOrdersTab();
                    }}
                  >
                    <span className={`collapsed-order-dot ${selected ? "selected" : ""}`} />
                    <span className="collapsed-order-initial">{orderInitial(order.name)}</span>
                    <span className="collapsed-order-no">#{order.orderNo}</span>
                    <span className="collapsed-order-count">{order.purchaseCount || 0} ق</span>
                  </button>
                );
              })
            : null}
        </div>
      </aside>
    );
  }

  return (
    <aside className="workspace-sidebar" style={{ width: sidebarWidth }}>
      <button
        className="resize-handle"
        type="button"
        onMouseDown={(event) => {
          event.preventDefault();
          onStartResize();
        }}
        aria-label="تغيير عرض القائمة"
      />

      <div className="workspace-head">
        <div className="workspace-brand">
          <span className="cube-wrap">
            <Icon name="package" className="icon" />
          </span>
          <div>
            <h3>الطلبات</h3>
            <p>{totalOrders} طلب</p>
          </div>
        </div>

        <button className="icon-btn tiny" onClick={onCollapse}>
          <Icon name="chevron-right" className="icon" />
        </button>
      </div>

      <div className="workspace-list">
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
  );
}
