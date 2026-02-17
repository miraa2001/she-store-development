import { useEffect, useRef, useState } from "react";

const MOBILE_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;

function getViewport() {
  if (typeof window === "undefined") return "desktop";
  if (window.innerWidth < MOBILE_BREAKPOINT) return "mobile";
  if (window.innerWidth < DESKTOP_BREAKPOINT) return "tablet";
  return "desktop";
}

export default function CommandHeader({
  isRahaf,
  canAccessCustomers = false,
  activeTab,
  onActiveTabChange,
  search,
  onSearchChange,
  searchCount,
  editMode,
  onEditModeChange,
  onOpenSidebar,
  showOrdersMenuTrigger = false,
  onOpenOrdersMenu,
  totalOrders,
  showDesktopOrdersViewToggle = false,
  desktopOrdersView = "list",
  onDesktopOrdersViewChange,
  Icon
}) {
  const [viewport, setViewport] = useState(() => getViewport());
  const [searchExpanded, setSearchExpanded] = useState(false);
  const mobileSearchInputRef = useRef(null);

  const isMobile = viewport === "mobile";
  const isTablet = viewport === "tablet";
  const showOrdersCustomersTabs = isRahaf || canAccessCustomers;

  useEffect(() => {
    const onResize = () => setViewport(getViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isMobile) setSearchExpanded(false);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || !searchExpanded) return;
    mobileSearchInputRef.current?.focus();
  }, [isMobile, searchExpanded]);

  const renderTabs = (className = "") => {
    if (!showOrdersCustomersTabs) {
      return <div className="readonly-chip">وضع العرض فقط</div>;
    }

    return (
      <div className={`tabs-shell ${className}`.trim()} role="tablist" aria-label="التبويبات">
        <button
          type="button"
          className={`tab ${activeTab === "orders" ? "active" : ""}`}
          onClick={() => onActiveTabChange("orders")}
        >
          الطلبات
        </button>

        {canAccessCustomers ? (
          <button
            type="button"
            className={`tab ${activeTab === "customers" ? "active" : ""}`}
            onClick={() => onActiveTabChange("customers")}
          >
            العملاء
          </button>
        ) : null}
      </div>
    );
  };

  if (isMobile) {
    return (
      <header className="command-header command-header-mobile">
        <div className={`command-mobile-row command-mobile-row-animated ${searchExpanded ? "is-open" : ""}`}>
          <button
            type="button"
            className="icon-btn command-mobile-icon"
            onClick={onOpenSidebar}
            aria-label="فتح القائمة"
          >
            <Icon name="menu" className="icon" />
          </button>

          <div className="command-mobile-title">
            <strong>الطلبات</strong>
            <small>{totalOrders} طلب</small>
          </div>

          <div className="command-mobile-search-inline">
            <form className={`search-expand-form search-expand-inline ${searchExpanded ? "open" : ""}`} onSubmit={(event) => event.preventDefault()}>
              <label htmlFor="ordersMobileSearch">Search</label>
              <input
                ref={mobileSearchInputRef}
                id="ordersMobileSearch"
                className="search-expand-input"
                type="search"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="بحث باسم المشترية..."
              />
              <span className="search-expand-caret" />
              {search ? (
                <span className="search-count search-expand-count">
                  <b>{searchCount}</b>
                  <small>نتيجة</small>
                </span>
              ) : null}
            </form>

            {showOrdersMenuTrigger ? (
              <button
                type="button"
                className="icon-btn command-mobile-icon orders-menu-trigger-btn"
                aria-label="فتح قائمة الطلبات"
                onClick={onOpenOrdersMenu}
              >
                <Icon name="package" className="icon" />
              </button>
            ) : null}

            <button
              type="button"
              className="icon-btn command-mobile-icon"
              aria-label={searchExpanded ? "إغلاق البحث" : "بحث"}
              aria-expanded={searchExpanded}
              onClick={() => setSearchExpanded((prev) => !prev)}
            >
              <Icon name={searchExpanded ? "close" : "search"} className="icon" />
            </button>
          </div>
        </div>
      </header>
    );
  }

  if (isTablet) {
    return (
      <header className="command-header command-header-tablet">
        <div className="command-tablet-row">
          <button type="button" className="icon-btn command-mobile-icon" onClick={onOpenSidebar} aria-label="فتح القائمة">
            <Icon name="menu" className="icon" />
          </button>

          {renderTabs("command-tablet-tabs")}

          <div className="search-shell command-tablet-search">
            <Icon name="search" className="search-icon" />
            <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="بحث باسم المشترية..." />
            {search ? (
              <span className="search-count">
                <b>{searchCount}</b>
                <small>نتيجة</small>
              </span>
            ) : null}
          </div>

          {showOrdersMenuTrigger ? (
            <button type="button" className="icon-btn orders-menu-trigger-btn" onClick={onOpenOrdersMenu} aria-label="فتح قائمة الطلبات">
              <Icon name="package" className="icon" />
            </button>
          ) : null}
        </div>
      </header>
    );
  }

  return (
    <header className="command-header">
      <div className="command-main command-main-group">
        {renderTabs()}

        <div className="search-shell command-search-group">
          <Icon name="search" className="search-icon" />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="بحث باسم المشترية..." />
          {search ? (
            <span className="search-count">
              <b>{searchCount}</b>
              <small>نتيجة</small>
            </span>
          ) : null}
        </div>
      </div>

      <div className="command-actions command-action-group">
        {isRahaf ? (
          <div className="mode-shell">
            <button type="button" className={`mode ${editMode ? "active" : ""}`} onClick={() => onEditModeChange(true)}>
              تعديل / إضافة
            </button>
            <button type="button" className={`mode ${!editMode ? "active" : ""}`} onClick={() => onEditModeChange(false)}>
              عرض فقط
            </button>
          </div>
        ) : null}

        {showDesktopOrdersViewToggle ? (
          <div className="orders-view-toggle" role="tablist" aria-label="طريقة عرض المشتريات">
            <button
              type="button"
              className={`orders-view-btn ${desktopOrdersView === "list" ? "active" : ""}`}
              onClick={() => onDesktopOrdersViewChange?.("list")}
            >
              List
            </button>
            <button
              type="button"
              className={`orders-view-btn ${desktopOrdersView === "kanban" ? "active" : ""}`}
              onClick={() => onDesktopOrdersViewChange?.("kanban")}
            >
              Kanban
            </button>
          </div>
        ) : null}

        {showOrdersMenuTrigger ? (
          <button type="button" className="icon-btn orders-menu-trigger-btn" onClick={onOpenOrdersMenu} aria-label="فتح قائمة الطلبات">
            <Icon name="package" className="icon" />
          </button>
        ) : null}

        <button type="button" className="icon-btn" onClick={onOpenSidebar} aria-label="فتح القائمة">
          <Icon name="menu" className="icon" />
        </button>
      </div>
    </header>
  );
}
