export default function CustomersTab({
  customerSearch,
  setCustomerSearch,
  customers,
  customersLoading,
  customersError,
  filteredCustomers,
  customerForm,
  setCustomerForm,
  customerFormMessage,
  customerFormSaving,
  handleCreateCustomer,
  editingCustomerId,
  editingCustomerForm,
  setEditingCustomerForm,
  beginEditCustomer,
  saveEditCustomer,
  cancelEditCustomer,
  handleDeleteCustomer,
  cityOptions,
  pickupOptions
}) {
  return (
    <>
      <div className="order-detail-header">
        <div>
          <h2>العملاء</h2>
          <p>إدارة بيانات العملاء (إضافة، تعديل، حذف) بنفس منطق النسخة الأصلية.</p>
        </div>
        <div className="order-detail-actions">
          <input
            className="purchase-search"
            value={customerSearch}
            onChange={(event) => setCustomerSearch(event.target.value)}
            placeholder="بحث بالاسم أو الهاتف أو المدينة..."
          />
          <span className="status-chip pending">الإجمالي: {customers.length}</span>
        </div>
      </div>

      <div className="customer-layout">
        <form className="customer-form-card" onSubmit={handleCreateCustomer}>
          <h3>إضافة عميل</h3>

          <label>
            <span>الاسم</span>
            <input
              value={customerForm.name}
              onChange={(event) =>
                setCustomerForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="اسم العميل"
              disabled={customerFormSaving}
            />
          </label>

          <label>
            <span>رقم الهاتف</span>
            <input
              value={customerForm.phone}
              onChange={(event) =>
                setCustomerForm((prev) => ({ ...prev, phone: event.target.value }))
              }
              placeholder="970xxxxxxxxx أو 972xxxxxxxxx"
              disabled={customerFormSaving}
            />
          </label>

          <label>
            <span>المدينة</span>
            <select
              value={customerForm.city}
              onChange={(event) =>
                setCustomerForm((prev) => ({ ...prev, city: event.target.value }))
              }
              disabled={customerFormSaving}
            >
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>نقطة الاستلام المعتادة</span>
            <select
              value={customerForm.pickup}
              onChange={(event) =>
                setCustomerForm((prev) => ({ ...prev, pickup: event.target.value }))
              }
              disabled={customerFormSaving}
            >
              {pickupOptions.map((pickup) => (
                <option key={pickup} value={pickup}>
                  {pickup}
                </option>
              ))}
            </select>
          </label>

          <div className="customer-form-actions">
            <button type="submit" className="btn-primary" disabled={customerFormSaving}>
              {customerFormSaving ? "جاري الحفظ..." : "حفظ العميل"}
            </button>
          </div>
          {customerFormMessage ? <div className="modal-help">{customerFormMessage}</div> : null}
        </form>

        <div className="customer-list-card">
          {customersLoading ? <div className="workspace-empty">جاري تحميل العملاء...</div> : null}
          {customersError ? <div className="workspace-empty workspace-error">{customersError}</div> : null}

          {!customersLoading && !customersError && !filteredCustomers.length ? (
            <div className="workspace-empty">لا يوجد عملاء مطابقون.</div>
          ) : null}

          {!customersLoading && !customersError && filteredCustomers.length ? (
            <div className="customer-list-grid">
              {filteredCustomers.map((customer) => {
                const isEditing = String(editingCustomerId) === String(customer.id);
                const form = isEditing ? editingCustomerForm : null;

                return (
                  <article key={customer.id} className="customer-item-card">
                    {isEditing && form ? (
                      <>
                        <div className="customer-item-head">
                          <h4>تعديل العميل</h4>
                        </div>

                        <div className="customer-edit-grid">
                          <label>
                            <span>الاسم</span>
                            <input
                              value={form.name}
                              onChange={(event) =>
                                setEditingCustomerForm((prev) => ({ ...prev, name: event.target.value }))
                              }
                            />
                          </label>
                          <label>
                            <span>الهاتف</span>
                            <input
                              value={form.phone}
                              onChange={(event) =>
                                setEditingCustomerForm((prev) => ({ ...prev, phone: event.target.value }))
                              }
                            />
                          </label>
                          <label>
                            <span>المدينة</span>
                            <select
                              value={form.city}
                              onChange={(event) =>
                                setEditingCustomerForm((prev) => ({ ...prev, city: event.target.value }))
                              }
                            >
                              {cityOptions.map((city) => (
                                <option key={city} value={city}>
                                  {city}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>نقطة الاستلام</span>
                            <select
                              value={form.pickup}
                              onChange={(event) =>
                                setEditingCustomerForm((prev) => ({ ...prev, pickup: event.target.value }))
                              }
                            >
                              {pickupOptions.map((pickup) => (
                                <option key={pickup} value={pickup}>
                                  {pickup}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div className="customer-item-actions">
                          <button type="button" className="btn-primary" onClick={() => saveEditCustomer(customer.id)}>
                            حفظ
                          </button>
                          <button type="button" className="btn-ghost-light" onClick={cancelEditCustomer}>
                            إلغاء
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="customer-item-head">
                          <div>
                            <h4>{customer.name || "—"}</h4>
                            <p>{customer.phone || "—"}</p>
                          </div>
                          <span className="status-chip completed">{customer.city || "—"}</span>
                        </div>

                        <div className="customer-item-meta">
                          <span>نقطة الاستلام: {customer.usual_pickup_point || "—"}</span>
                        </div>

                        <div className="customer-item-actions">
                          <button
                            type="button"
                            className="btn-ghost-light"
                            onClick={() => beginEditCustomer(customer)}
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            className="btn-ghost-light danger-btn"
                            onClick={() => handleDeleteCustomer(customer)}
                          >
                            حذف
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
