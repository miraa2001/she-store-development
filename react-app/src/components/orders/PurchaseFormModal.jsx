export default function PurchaseFormModal({
  open,
  formMode,
  formState,
  customers,
  customersLoading,
  formSaving,
  formAiRunning,
  formAiStatus,
  formUploadProgress,
  formError,
  newFilePreviews,
  maxImages,
  bagOptions,
  pickupOptions,
  onClose,
  onSubmit,
  onCustomerChange,
  onUpdateForm,
  onAddLinkInput,
  onRemoveLinkInput,
  onUpdateLinkValue,
  onAddNewImages,
  onAnalyzeWithGemini,
  onToggleExistingImageRemoval,
  onRemoveNewImage,
  Icon
}) {
  if (!open) return null;

  return (
    <div className="purchase-modal-backdrop" onClick={onClose}>
      <div className="purchase-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="purchase-modal-head">
          <h3>{formMode === "add" ? "إضافة مشترى" : "تعديل المشترى"}</h3>
          <button type="button" className="icon-btn tiny" onClick={onClose}>
            <Icon name="close" className="icon" />
          </button>
        </div>

        <form className="purchase-modal-body" onSubmit={onSubmit}>
          <div className="modal-grid-two">
            <label>
              <span>الزبون</span>
              <select
                value={formState.customerId}
                onChange={(event) => onCustomerChange(event.target.value)}
                disabled={customersLoading || formSaving}
              >
                <option value="">اختاري الزبون</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>عدد القطع</span>
              <input
                type="number"
                min="1"
                max="200"
                value={formState.qty}
                onChange={(event) => onUpdateForm({ qty: event.target.value })}
                disabled={formSaving}
              />
            </label>

            <label>
              <span>السعر</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formState.price}
                onChange={(event) => onUpdateForm({ price: event.target.value })}
                disabled={formSaving}
              />
            </label>

            <label>
              <span>المدفوع</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formState.paidPrice}
                onChange={(event) => onUpdateForm({ paidPrice: event.target.value })}
                disabled={formSaving}
              />
            </label>

            <label>
              <span>حجم الكيس</span>
              <select
                value={formState.bagSize}
                onChange={(event) => onUpdateForm({ bagSize: event.target.value })}
                disabled={formSaving}
              >
                {bagOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>مكان الاستلام</span>
              <select
                value={formState.pickupPoint}
                onChange={(event) => onUpdateForm({ pickupPoint: event.target.value })}
                disabled={formSaving}
              >
                {pickupOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            <span>ملاحظة</span>
            <textarea
              value={formState.note}
              onChange={(event) => onUpdateForm({ note: event.target.value })}
              placeholder="اكتبي أي ملاحظة..."
              disabled={formSaving}
            />
          </label>

          <div className="modal-links-head">
            <strong>روابط السلة</strong>
            <div className="row-inline">
              <button type="button" className="btn-ghost-light" onClick={onAddLinkInput} disabled={formSaving}>
                + رابط
              </button>
              <button
                type="button"
                className="btn-ghost-light"
                onClick={onRemoveLinkInput}
                disabled={formSaving || formState.links.length <= 1}
              >
                − رابط
              </button>
            </div>
          </div>

          <div className="modal-links-grid">
            {formState.links.map((link, index) => (
              <input
                key={`form-link-${index}`}
                value={link}
                onChange={(event) => onUpdateLinkValue(index, event.target.value)}
                placeholder={`رابط ${index + 1}`}
                disabled={formSaving}
              />
            ))}
          </div>

          <div className="modal-images-wrap">
            <div className="modal-images-head">
              <strong>الصور ({formState.newFiles.length}/{maxImages})</strong>
              <div className="modal-images-actions">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    onAddNewImages(event.target.files);
                    event.target.value = "";
                  }}
                  disabled={formSaving || formAiRunning}
                />
                <button
                  type="button"
                  className="btn-ghost-light"
                  onClick={onAnalyzeWithGemini}
                  disabled={formSaving || formAiRunning}
                >
                  {formAiRunning ? "جاري التحليل..." : "تحليل Gemini"}
                </button>
              </div>
            </div>

            {formMode === "edit" && formState.existingImages.length ? (
              <div className="modal-existing-images">
                {formState.existingImages.map((img) => {
                  const removed = formState.removeImageIds.includes(img.id);
                  return (
                    <button
                      key={img.id}
                      type="button"
                      className={`modal-existing-image ${removed ? "removed" : ""}`}
                      onClick={() => onToggleExistingImageRemoval(img.id)}
                      disabled={formSaving || formAiRunning}
                    >
                      <img src={img.url} alt="صورة موجودة" />
                      <span>{removed ? "سيتم الحذف" : "موجودة"}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {formState.newFiles.length ? (
              <div className="modal-new-images">
                {newFilePreviews.map((item, index) => (
                  <div key={item.key} className="modal-new-image">
                    <img src={item.url} alt="صورة جديدة" />
                    <button type="button" onClick={() => onRemoveNewImage(index)} disabled={formSaving || formAiRunning}>
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {formAiStatus.text ? (
            <div className={`modal-help ${formAiStatus.isError ? "modal-help-error" : ""}`}>{formAiStatus.text}</div>
          ) : null}
          {formUploadProgress ? <div className="modal-help">{formUploadProgress}</div> : null}
          {formError ? <div className="modal-error">{formError}</div> : null}

          <div className="purchase-modal-foot">
            <button type="submit" className="btn-primary" disabled={formSaving || formAiRunning}>
              {formSaving ? "جاري الحفظ..." : "حفظ"}
            </button>
            <button type="button" className="btn-ghost-light" onClick={onClose} disabled={formSaving || formAiRunning}>
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
