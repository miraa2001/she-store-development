import { formatILS } from "../../lib/orders";

export default function OrdersTab({
  selectedOrder,
  purchaseStats,
  purchaseSearch,
  onPurchaseSearchChange,
  isRahaf,
  editMode,
  onToggleArrived,
  onOpenAddModal,
  onExportPdf,
  pdfExporting,
  onGeminiAction,
  customersError,
  purchasesLoading,
  purchasesError,
  filteredPurchases,
  paymentState,
  menuPurchaseId,
  onTogglePurchaseMenu,
  onEditPurchase,
  onMarkPaid,
  onDeletePurchase,
  onOpenLightbox,
  onInquireWhatsapp,
  onNotifyWhatsapp
}) {
  return (
    <>
      <div className="order-detail-header">
        <div>
          <h2>{selectedOrder?.name || "اختاري طلبًا"}</h2>
          <p>
            عدد المشتريات: {purchaseStats.count} — مجموع القطع: {purchaseStats.totalQty} — مجموع الأسعار:{" "}
            {formatILS(purchaseStats.totalPrice)} ₪
          </p>
        </div>

        <div className="order-detail-actions">
          <input
            className="purchase-search"
            value={purchaseSearch}
            onChange={(event) => onPurchaseSearchChange(event.target.value)}
            placeholder="بحث داخل المشتريات..."
          />

          {isRahaf ? (
            <label className="arrived-toggle-chip">
              <input type="checkbox" checked={!!selectedOrder?.arrived} onChange={onToggleArrived} />
              <span>تم وصول الطلب</span>
            </label>
          ) : null}

          {isRahaf && editMode ? (
            <button className="btn-primary" type="button" onClick={onOpenAddModal}>
              + إضافة مشترى
            </button>
          ) : null}

          <button className="btn-ghost-light" type="button" onClick={onExportPdf} disabled={pdfExporting}>
            {pdfExporting ? "جاري التصدير..." : "تصدير PDF"}
          </button>
          {isRahaf && editMode ? (
            <button className="btn-ghost-light" type="button" onClick={onGeminiAction}>
              Gemini
            </button>
          ) : null}
        </div>
      </div>

      {customersError ? <div className="workspace-empty workspace-error">{customersError}</div> : null}
      {purchasesLoading ? <div className="workspace-empty">جاري تحميل المشتريات...</div> : null}
      {purchasesError ? <div className="workspace-empty workspace-error">{purchasesError}</div> : null}

      {!purchasesLoading && !purchasesError && !filteredPurchases.length ? (
        <div className="workspace-empty">لا توجد مشتريات مطابقة.</div>
      ) : null}

      {!purchasesLoading && !purchasesError && filteredPurchases.length ? (
        <div className="purchase-cards-grid">
          {filteredPurchases.map((purchase) => {
            const state = paymentState(purchase);
            const canShowWhatsapp = isRahaf && !!selectedOrder?.arrived;

            return (
              <article key={purchase.id} className="purchase-card" data-menu-root>
                <div className="purchase-card-head">
                  <div>
                    <h3>{purchase.customer_name || "—"}</h3>
                    <p>
                      {purchase.qty || 0} قطع • {formatILS(purchase.price)} ₪
                    </p>
                  </div>

                  <div className="purchase-head-actions">
                    <span className={`status-chip ${state.key}`}>{state.label}</span>

                    {isRahaf && editMode ? (
                      <div className="purchase-menu-wrap" data-menu-root>
                        <button
                          type="button"
                          className="icon-btn menu-dots"
                          onClick={(event) => {
                            event.stopPropagation();
                            onTogglePurchaseMenu(purchase.id);
                          }}
                          aria-label="إجراءات"
                        >
                          ⋯
                        </button>

                        {String(menuPurchaseId) === String(purchase.id) ? (
                          <div className="purchase-menu-pop">
                            <button type="button" onClick={() => onEditPurchase(purchase)}>
                              تعديل
                            </button>
                            <button type="button" onClick={() => onMarkPaid(purchase)}>
                              تعديل المدفوع
                            </button>
                            <button type="button" className="danger" onClick={() => onDeletePurchase(purchase)}>
                              حذف
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="purchase-meta-list">
                  <span>المدفوع: {formatILS(purchase.paid_price)} ₪</span>
                  <span>مكان الاستلام: {purchase.pickup_point || "—"}</span>
                  <span>حجم الكيس: {purchase.bag_size || "—"}</span>
                  <span>ملاحظة: {purchase.note || "—"}</span>
                </div>

                {purchase.links?.length ? (
                  <div className="purchase-links-wrap">
                    {purchase.links.map((link, index) => (
                      <a key={`${purchase.id}-link-${index}`} href={link} target="_blank" rel="noreferrer">
                        رابط {index + 1}
                      </a>
                    ))}
                  </div>
                ) : null}

                {purchase.images?.length ? (
                  <div className="purchase-image-strip">
                    {purchase.images.map((img, imageIndex) => (
                      <button
                        key={img.id || `${purchase.id}-img-${imageIndex}`}
                        type="button"
                        className="purchase-image-thumb"
                        onClick={() => onOpenLightbox(purchase.images, imageIndex, purchase.customer_name || "صورة")}
                      >
                        <img src={img.url} alt="صورة المشترى" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="purchase-empty-images">لا توجد صور</div>
                )}

                {canShowWhatsapp ? (
                  <div className="wa-actions-row">
                    <button type="button" className="wa-btn wa-btn-inquiry" onClick={() => onInquireWhatsapp(purchase)}>
                      استعلام عن نقطة الاستلام❓
                    </button>
                    <button type="button" className="wa-btn wa-btn-notify" onClick={() => onNotifyWhatsapp(purchase)}>
                      اعلام بوصول الطلب🔔
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
