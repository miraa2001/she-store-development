export default function CommandHeader({
  isRahaf,
  activeTab,
  onActiveTabChange,
  search,
  onSearchChange,
  searchCount,
  editMode,
  onEditModeChange,
  onOpenSidebar,
  Icon
}) {
  return (
    <header className="command-header">
      <div className="command-main">
        {isRahaf ? (
          <div className="tabs-shell" role="tablist" aria-label="التبويبات">
            <button className={`tab ${activeTab === "orders" ? "active" : ""}`} onClick={() => onActiveTabChange("orders")}>
              الطلبات
            </button>
            <button className={`tab ${activeTab === "view" ? "active" : ""}`} onClick={() => onActiveTabChange("view")}>
              العرض
            </button>
            <button className={`tab ${activeTab === "customers" ? "active" : ""}`} onClick={() => onActiveTabChange("customers")}>
              العملاء
            </button>
          </div>
        ) : (
          <div className="readonly-chip">وضع العرض فقط</div>
        )}

        <div className="search-shell">
          <Icon name="search" className="search-icon" />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="بحث باسم الطلب..." />
          {search ? (
            <span className="search-count">
              <b>{searchCount}</b>
              <small>نتيجة</small>
            </span>
          ) : null}
        </div>
      </div>

      <div className="command-actions">
        {isRahaf ? (
          <div className="mode-shell">
            <button className={`mode ${editMode ? "active" : ""}`} onClick={() => onEditModeChange(true)}>
              تعديل / إضافة
            </button>
            <button className={`mode ${!editMode ? "active" : ""}`} onClick={() => onEditModeChange(false)}>
              عرض فقط
            </button>
          </div>
        ) : null}

        <button type="button" className="icon-btn" onClick={onOpenSidebar}>
          <Icon name="menu" className="icon" />
        </button>
      </div>
    </header>
  );
}
