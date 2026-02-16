import { useEffect } from "react";

export default function MobileActionsSheet({
  open,
  onClose,
  isRahaf,
  showTabsInSheet,
  activeTab,
  onActiveTabChange,
  editMode,
  onEditModeChange,
  showOrderActions,
  arrivedChecked,
  onToggleArrived,
  onOpenAddModal,
  onExportPdf,
  pdfExporting,
  onGeminiAction
}) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <>
      <div className={`mobile-sheet-backdrop ${open ? "open" : ""}`} onClick={onClose} aria-hidden={!open} />

      <aside
        className={`mobile-actions-sheet ${open ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="إجراءات الطلبات"
      >
        <div className="mobile-actions-handle" />

        <div className="mobile-actions-head">
          <strong>إجراءات الطلبات</strong>
          <button type="button" className="icon-btn tiny" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        <div className="mobile-actions-body">
          {showTabsInSheet ? (
            <section className="mobile-actions-group">
              <small className="mobile-actions-label">التبويبات</small>
              <div className="mobile-actions-tabs">
                <button
                  type="button"
                  className={`tab ${activeTab === "orders" ? "active" : ""}`}
                  onClick={() => {
                    onActiveTabChange("orders");
                    onClose();
                  }}
                >
                  الطلبات
                </button>
                {isRahaf ? (
                  <>
                    <button
                      type="button"
                      className={`tab ${activeTab === "view" ? "active" : ""}`}
                      onClick={() => {
                        onActiveTabChange("view");
                        onClose();
                      }}
                    >
                      العرض
                    </button>
                    <button
                      type="button"
                      className={`tab ${activeTab === "customers" ? "active" : ""}`}
                      onClick={() => {
                        onActiveTabChange("customers");
                        onClose();
                      }}
                    >
                      العملاء
                    </button>
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

          {isRahaf ? (
            <section className="mobile-actions-group">
              <small className="mobile-actions-label">الوضع</small>
              <div className="mode-shell mobile-actions-mode">
                <button
                  type="button"
                  className={`mode ${editMode ? "active" : ""}`}
                  onClick={() => onEditModeChange(true)}
                >
                  تعديل / إضافة
                </button>
                <button
                  type="button"
                  className={`mode ${!editMode ? "active" : ""}`}
                  onClick={() => onEditModeChange(false)}
                >
                  عرض فقط
                </button>
              </div>
            </section>
          ) : null}

          {showOrderActions ? (
            <>
              {isRahaf ? (
                <section className="mobile-actions-group">
                  <small className="mobile-actions-label">حالة الطلب</small>
                  <label className="arrived-toggle-chip mobile-arrived-toggle">
                    <input type="checkbox" checked={!!arrivedChecked} onChange={onToggleArrived} />
                    <span>تم وصول الطلب</span>
                  </label>
                </section>
              ) : null}

              <section className="mobile-actions-group">
                <small className="mobile-actions-label">إجراءات</small>
                <div className="mobile-actions-buttons">
                  {isRahaf && editMode ? (
                    <button
                      className="btn-primary"
                      type="button"
                      onClick={() => {
                        onOpenAddModal();
                        onClose();
                      }}
                    >
                      + إضافة مشترى
                    </button>
                  ) : null}

                  <button
                    className="btn-ghost-light"
                    type="button"
                    onClick={() => {
                      onExportPdf();
                      onClose();
                    }}
                    disabled={pdfExporting}
                  >
                    {pdfExporting ? "جاري التصدير..." : "تصدير PDF"}
                  </button>

                  {isRahaf && editMode ? (
                    <button
                      className="btn-ghost-light"
                      type="button"
                      onClick={() => {
                        onGeminiAction();
                        onClose();
                      }}
                    >
                      Gemini
                    </button>
                  ) : null}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </aside>
    </>
  );
}

