import { useEffect, useMemo, useState } from "react";
import Stepper, { Step } from "../common/Stepper";

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
  const [customerSearch, setCustomerSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setCustomerSearch(formState.customerName || "");
  }, [open, formState.customerId, formState.customerName]);

  const filteredCustomers = useMemo(() => {
    const needle = String(customerSearch || "").trim().toLowerCase();
    if (!needle) return [];
    return customers
      .filter((customer) => String(customer.name || "").toLowerCase().includes(needle))
      .slice(0, 8);
  }, [customerSearch, customers]);

  if (!open) return null;

  const isAddMode = formMode === "add";

  const handleStepperSubmit = async () => {
    const ok = await onSubmit({ preventDefault: () => {} });
    return ok;
  };

  const detailsFields = (
    <div className="modal-grid-two">
      <label className="customer-field-full">
        <span>اسم الزبون (بحث)</span>
        <input
          type="text"
          value={customerSearch}
          onChange={(event) => setCustomerSearch(event.target.value)}
          placeholder="اكتبي اسم الزبون..."
          disabled={customersLoading || formSaving}
        />
      </label>

      {String(customerSearch || "").trim() ? (
        <div className="customer-search-results customer-field-full">
          {filteredCustomers.length ? (
            filteredCustomers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                className={`customer-search-item ${String(formState.customerId) === String(customer.id) ? "active" : ""}`}
                onClick={() => {
                  onCustomerChange(customer.id);
                  setCustomerSearch(customer.name || "");
                }}
                disabled={formSaving}
              >
                {customer.name}
              </button>
            ))
          ) : (
            <div className="customer-search-empty">لا توجد نتائج مطابقة.</div>
          )}
        </div>
      ) : null}

      <label>
        <span>الزبون</span>
        <select
          value={formState.customerId}
          onChange={(event) => {
            const customerId = event.target.value;
            onCustomerChange(customerId);
            const selected = customers.find((customer) => String(customer.id) === String(customerId));
            setCustomerSearch(selected?.name || "");
          }}
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
          <option value="">اختاري حجم الكيس</option>
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
          <option value="">اختاري مكان الاستلام</option>
          {pickupOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  const noteField = (
    <label>
      <span>ملاحظة</span>
      <textarea
        value={formState.note}
        onChange={(event) => onUpdateForm({ note: event.target.value })}
        placeholder="اكتبي أي ملاحظة..."
        disabled={formSaving}
      />
    </label>
  );

  const linksSection = (
    <>
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
    </>
  );

  const imagesSection = (
    <div className="modal-images-wrap">
      <div className="modal-images-head">
        <strong>
          الصور ({formState.newFiles.length}/{maxImages})
        </strong>
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
            {formAiRunning ? "جاري التحليل..." : "تحليل المجموع"}
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
  );

  return (
    <div className="purchase-modal-backdrop" onClick={onClose}>
      <div className="purchase-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="purchase-modal-head">
          <h3>{isAddMode ? "إضافة مشترى" : "تعديل المشترى"}</h3>
          <button type="button" className="icon-btn tiny" onClick={onClose}>
            <Icon name="close" className="icon" />
          </button>
        </div>

        {isAddMode ? (
          <div className="purchase-modal-body purchase-modal-body-stepper">
            <Stepper
              initialStep={1}
              onStepChange={() => {}}
              onFinalStepCompleted={handleStepperSubmit}
              backButtonText="السابق"
              nextButtonText="التالي"
              completeButtonText={formSaving ? "جاري الحفظ..." : "حفظ"}
              nextButtonProps={{ disabled: formSaving || formAiRunning }}
              backButtonProps={{ disabled: formSaving || formAiRunning }}
            >
              <Step>
                <h4 className="step-section-title">معلومات الطلب</h4>
                {detailsFields}
              </Step>
              <Step>
                <h4 className="step-section-title">ملاحظات وروابط</h4>
                {noteField}
                {linksSection}
              </Step>
              <Step>
                <h4 className="step-section-title">الصور</h4>
                {imagesSection}
              </Step>
              <Step>
                <h4 className="step-section-title">مراجعة وحفظ</h4>
                <div className="modal-help">راجعي البيانات ثم اضغطي حفظ.</div>
                {formAiStatus.text ? (
                  <div className={`modal-help ${formAiStatus.isError ? "modal-help-error" : ""}`}>{formAiStatus.text}</div>
                ) : null}
                {formUploadProgress ? <div className="modal-help">{formUploadProgress}</div> : null}
                {formError ? <div className="modal-error">{formError}</div> : null}
              </Step>
            </Stepper>
          </div>
        ) : (
          <form className="purchase-modal-body" onSubmit={onSubmit}>
            {detailsFields}
            {noteField}
            {linksSection}
            {imagesSection}

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
        )}
      </div>
    </div>
  );
}
