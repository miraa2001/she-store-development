import { useState } from "react";
import { formatILS } from "../../lib/orders";
import SessionLoader from "../common/SessionLoader";

function normalizeSlideIndex(index, total) {
  if (!total) return 0;
  return ((Number(index) || 0) % total + total) % total;
}

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
  const [cardSlideIndexes, setCardSlideIndexes] = useState({});

  const setSlideIndex = (purchaseId, total, nextIndex) => {
    const normalized = normalizeSlideIndex(nextIndex, total);
    setCardSlideIndexes((prev) => {
      if (prev[purchaseId] === normalized) return prev;
      return { ...prev, [purchaseId]: normalized };
    });
  };

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
      {purchasesLoading ? (
        <div className="workspace-empty workspace-loader">
          <SessionLoader />
        </div>
      ) : null}
      {purchasesError ? <div className="workspace-empty workspace-error">{purchasesError}</div> : null}

      {!purchasesLoading && !purchasesError && !filteredPurchases.length ? (
        <div className="workspace-empty">لا توجد مشتريات مطابقة.</div>
      ) : null}

      {!purchasesLoading && !purchasesError && filteredPurchases.length ? (
        <div className="purchase-cards-grid">
          {filteredPurchases.map((purchase) => {
            const state = paymentState(purchase);
            const canShowWhatsapp = isRahaf && !!selectedOrder?.arrived;
            const imageList = Array.isArray(purchase.images)
              ? purchase.images.filter((img) => img?.url)
              : [];
            const totalImages = imageList.length;
            const currentSlide = normalizeSlideIndex(cardSlideIndexes[purchase.id] || 0, totalImages);

            const actionsNode = (
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
                      <div className="purchase-menu-pop" role="menu">
                        <button type="button" className="value" role="menuitem" onClick={() => onEditPurchase(purchase)}>
                          تعديل
                        </button>
                        <button type="button" className="value" role="menuitem" onClick={() => onMarkPaid(purchase)}>
                          تعديل المدفوع
                        </button>
                        <button
                          type="button"
                          className="value danger"
                          role="menuitem"
                          onClick={() => onDeletePurchase(purchase)}
                        >
                          حذف
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );

            return (
              <article key={purchase.id} className="purchase-card" data-menu-root>
                <div className="purchase-desktop-shell">
                  <article className="purchaseVCard">
                    <div className="purchaseVMedia" dir="ltr">
                      {totalImages ? (
                        <>
                          <div className="purchaseVTrack" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                            {imageList.map((img, index) => (
                              <button
                                key={img.id || `${purchase.id}-slide-${index}`}
                                type="button"
                                className="purchaseVSlide"
                                onClick={() =>
                                  onOpenLightbox(imageList, index, purchase.customer_name || "صورة المشترى")
                                }
                                aria-label={`عرض الصورة ${index + 1}`}
                              >
                                <img src={img.url} alt={`صورة ${index + 1}`} loading="lazy" />
                              </button>
                            ))}
                          </div>

                          {totalImages > 1 ? (
                            <>
                              <button
                                className="purchaseVNav prev"
                                type="button"
                                aria-label="الصورة السابقة"
                                onClick={() => setSlideIndex(purchase.id, totalImages, currentSlide - 1)}
                              >
                                ‹
                              </button>
                              <button
                                className="purchaseVNav next"
                                type="button"
                                aria-label="الصورة التالية"
                                onClick={() => setSlideIndex(purchase.id, totalImages, currentSlide + 1)}
                              >
                                ›
                              </button>
                              <div className="purchaseVDots">
                                {imageList.map((img, index) => (
                                  <button
                                    key={img.id || `${purchase.id}-dot-${index}`}
                                    type="button"
                                    className={`purchaseVDot ${index === currentSlide ? "is-active" : ""}`}
                                    aria-label={`الانتقال للصورة ${index + 1}`}
                                    onClick={() => setSlideIndex(purchase.id, totalImages, index)}
                                  />
                                ))}
                              </div>
                            </>
                          ) : null}

                          <span className="purchaseVCount">
                            {currentSlide + 1}/{totalImages}
                          </span>
                        </>
                      ) : (
                        <div className="purchaseVPlaceholder">لا توجد صور</div>
                      )}

                      <div className="purchaseVOverlay">{actionsNode}</div>
                    </div>

                    <div className="purchaseVBody" dir="rtl">
                      <div className="purchaseVField">
                        <p className="purchaseVLabel">الاسم</p>
                        <p className="purchaseVValue">{purchase.customer_name || "—"}</p>
                      </div>
                      <div className="purchaseVField">
                        <p className="purchaseVLabel">عدد القطع</p>
                        <p className="purchaseVValue">{purchase.qty || 0}</p>
                      </div>
                      <div className="purchaseVField">
                        <p className="purchaseVLabel">السعر</p>
                        <p className="purchaseVValue">{formatILS(purchase.price)} ₪</p>
                      </div>
                      <div className="purchaseVField">
                        <p className="purchaseVLabel">مكان الاستلام</p>
                        <p className="purchaseVValue">{purchase.pickup_point || "—"}</p>
                      </div>
                    </div>

                    {purchase.links?.length ? (
                      <div className="purchaseVLinks">
                        {purchase.links.map((link, index) => (
                          <a key={`${purchase.id}-v-link-${index}`} href={link} target="_blank" rel="noreferrer">
                            رابط {index + 1}
                          </a>
                        ))}
                      </div>
                    ) : null}

                    {canShowWhatsapp ? (
                      <div className="wa-actions-row purchaseVWa">
                        <button type="button" className="wa-btn wa-btn-inquiry" onClick={() => onInquireWhatsapp(purchase)}>
                          استعلام عن نقطة الاستلام❓
                        </button>
                        <button type="button" className="wa-btn wa-btn-notify" onClick={() => onNotifyWhatsapp(purchase)}>
                          اعلام بوصول الطلب🔔
                        </button>
                      </div>
                    ) : null}
                  </article>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
