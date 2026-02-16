import { useEffect, useState } from "react";

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
  activeTab,
  onActiveTabChange,
  search,
  onSearchChange,
  searchCount,
  editMode,
  onEditModeChange,
  onOpenSidebar,
  totalOrders,
  showDesktopOrdersViewToggle = false,
  desktopOrdersView = "list",
  onDesktopOrdersViewChange,
  Icon
}) {
  const [viewport, setViewport] = useState(() => getViewport());
  const [searchExpanded, setSearchExpanded] = useState(false);

  const isMobile = viewport === "mobile";
  const isTablet = viewport === "tablet";

  useEffect(() => {
    const onResize = () => setViewport(getViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isMobile) setSearchExpanded(false);
  }, [isMobile]);

  if (isMobile) {
    return (
      <header className="command-header command-header-mobile">
        <div className="command-mobile-row">
          <div className="command-mobile-title">
            <strong>الطلبات</strong>
            <small>{totalOrders} طلب</small>
          </div>

          <button
            type="button"
            className="icon-btn command-mobile-icon"
            aria-label="بحث"
            aria-expanded={searchExpanded}
            onClick={() => setSearchExpanded((prev) => !prev)}
          >
            <Icon name="search" className="icon" />
          </button>
        </div>

        {searchExpanded ? (
          <div className="command-mobile-search">
            <div className="search-shell">
              <Icon name="search" className="search-icon" />
              <input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="بحث باسم الطلب..."
              />
              {search ? (
                <span className="search-count">
                  <b>{searchCount}</b>
                  <small>نتيجة</small>
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
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

          {isRahaf ? (
            <div className="tabs-shell command-tablet-tabs" role="tablist" aria-label="التبويبات">
              <button type="button" className={`tab ${activeTab === "orders" ? "active" : ""}`} onClick={() => onActiveTabChange("orders")}>
                الطلبات
              </button>
              <button type="button" className={`tab ${activeTab === "view" ? "active" : ""}`} onClick={() => onActiveTabChange("view")}>
                العرض
              </button>
              <button
                type="button"
                className={`tab ${activeTab === "customers" ? "active" : ""}`}
                onClick={() => onActiveTabChange("customers")}
              >
                العملاء
              </button>
            </div>
          ) : (
            <div className="readonly-chip">وضع العرض فقط</div>
          )}

          <div className="search-shell command-tablet-search">
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
      </header>
    );
  }

  return (
    <header className="command-header">
      <div className="command-main command-main-group">
        {isRahaf ? (
          <div className="tabs-shell" role="tablist" aria-label="التبويبات">
            <button type="button" className={`tab ${activeTab === "orders" ? "active" : ""}`} onClick={() => onActiveTabChange("orders")}>
              الطلبات
            </button>
            <button type="button" className={`tab ${activeTab === "view" ? "active" : ""}`} onClick={() => onActiveTabChange("view")}>
              العرض
            </button>
            <button
              type="button"
              className={`tab ${activeTab === "customers" ? "active" : ""}`}
              onClick={() => onActiveTabChange("customers")}
            >
              العملاء
            </button>
          </div>
        ) : (
          <div className="readonly-chip">وضع العرض فقط</div>
        )}

        <div className="search-shell command-search-group">
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

        <button type="button" className="icon-btn" onClick={onOpenSidebar} aria-label="فتح القائمة">
          <Icon name="menu" className="icon" />
        </button>
      </div>
    </header>
  );
}
