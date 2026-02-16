import { useEffect, useState } from "react";
import MobileActionsSheet from "./MobileActionsSheet";

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
  showOrderActions,
  arrivedChecked,
  onToggleArrived,
  onOpenAddModal,
  onExportPdf,
  pdfExporting,
  onGeminiAction,
  Icon
}) {
  const [viewport, setViewport] = useState(() => getViewport());
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false);

  const isMobile = viewport === "mobile";
  const isTablet = viewport === "tablet";

  useEffect(() => {
    const onResize = () => setViewport(getViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isMobile) setSearchExpanded(false);
    if (viewport === "desktop") setActionsSheetOpen(false);
  }, [isMobile, viewport]);

  if (isMobile) {
    return (
      <header className="command-header command-header-mobile">
        <div className="command-mobile-row">
          <button type="button" className="icon-btn command-mobile-icon" onClick={onOpenSidebar} aria-label="فتح القائمة">
            <Icon name="menu" className="icon" />
          </button>

          <div className="command-mobile-title">
            <strong>الطلبات</strong>
            <small>{totalOrders} طلب</small>
          </div>

          <div className="command-mobile-tools">
            <button
              type="button"
              className="icon-btn command-mobile-icon"
              aria-label="بحث"
              aria-expanded={searchExpanded}
              onClick={() => setSearchExpanded((prev) => !prev)}
            >
              <Icon name="search" className="icon" />
            </button>
            <button
              type="button"
              className="icon-btn command-mobile-icon command-overflow-btn"
              aria-label="إجراءات إضافية"
              aria-haspopup="dialog"
              aria-expanded={actionsSheetOpen}
              onClick={() => setActionsSheetOpen(true)}
            >
              ⋮
            </button>
          </div>
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

        <MobileActionsSheet
          open={actionsSheetOpen}
          onClose={() => setActionsSheetOpen(false)}
          isRahaf={isRahaf}
          showTabsInSheet
          activeTab={activeTab}
          onActiveTabChange={onActiveTabChange}
          editMode={editMode}
          onEditModeChange={onEditModeChange}
          showOrderActions={showOrderActions}
          arrivedChecked={arrivedChecked}
          onToggleArrived={onToggleArrived}
          onOpenAddModal={onOpenAddModal}
          onExportPdf={onExportPdf}
          pdfExporting={pdfExporting}
          onGeminiAction={onGeminiAction}
        />
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
              <button type="button" className={`tab ${activeTab === "customers" ? "active" : ""}`} onClick={() => onActiveTabChange("customers")}>
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

          <button
            type="button"
            className="icon-btn command-mobile-icon command-overflow-btn"
            aria-label="إجراءات إضافية"
            aria-haspopup="dialog"
            aria-expanded={actionsSheetOpen}
            onClick={() => setActionsSheetOpen(true)}
          >
            ⋮
          </button>
        </div>

        <MobileActionsSheet
          open={actionsSheetOpen}
          onClose={() => setActionsSheetOpen(false)}
          isRahaf={isRahaf}
          showTabsInSheet={false}
          activeTab={activeTab}
          onActiveTabChange={onActiveTabChange}
          editMode={editMode}
          onEditModeChange={onEditModeChange}
          showOrderActions={showOrderActions}
          arrivedChecked={arrivedChecked}
          onToggleArrived={onToggleArrived}
          onOpenAddModal={onOpenAddModal}
          onExportPdf={onExportPdf}
          pdfExporting={pdfExporting}
          onGeminiAction={onGeminiAction}
        />
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
            <button type="button" className={`tab ${activeTab === "customers" ? "active" : ""}`} onClick={() => onActiveTabChange("customers")}>
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

        <button type="button" className="icon-btn" onClick={onOpenSidebar} aria-label="فتح القائمة">
          <Icon name="menu" className="icon" />
        </button>
      </div>
    </header>
  );
}

