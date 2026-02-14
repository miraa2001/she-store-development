import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./orders-page.css";
import { fetchOrdersWithSummary, groupOrdersByMonth, parsePrice } from "../lib/orders";
import { useAuthProfile } from "../hooks/useAuthProfile";
import { sb } from "../lib/supabaseClient";
import {
  createPurchaseWithRelations,
  deletePurchaseById,
  fetchPurchasesByOrder,
  markPurchasePaidPrice,
  restoreDeletedPurchase,
  sanitizeLinks,
  updatePurchaseWithRelations
} from "../lib/purchases";
import { searchByName } from "../lib/search";
import {
  CUSTOMER_CITIES,
  CUSTOMER_PICKUP_OPTIONS,
  createCustomer,
  customerFriendlyError,
  deleteCustomer,
  fetchCustomers,
  isValidCustomerPhone,
  normalizePhone,
  updateCustomer
} from "../lib/customers";
import {
  buildArrivalNotifyMessage,
  buildPickupInquiryMessage,
  resolvePurchaseWhatsappTarget
} from "../lib/whatsapp";
import { exportOrderPdf } from "../lib/pdfExport";
import { hasGeminiKey, resolveTotalFromGemini, runGeminiCartAnalysis } from "../lib/gemini";
import { getOrdersNavItems, getRoleLabel } from "../lib/navigation";
import { signOutAndRedirect } from "../lib/session";
import CustomersTab from "../components/tabs/CustomersTab";
import ViewTab from "../components/tabs/ViewTab";
import CommandHeader from "../components/orders/CommandHeader";
import OrdersSidebar from "../components/orders/OrdersSidebar";
import OrdersTab from "../components/orders/OrdersTab";
import PurchaseFormModal from "../components/orders/PurchaseFormModal";
import LightboxModal from "../components/orders/LightboxModal";

const BAG_OPTIONS = ["كيس كبير", "كيس صغير"];
const MAX_IMAGES = 10;

function paymentState(purchase) {
  const priceNum = parsePrice(purchase.price);
  const paidNum = parsePrice(purchase.paid_price || 0);

  if (priceNum > 0 && paidNum >= priceNum) return { key: "completed", label: "مكتمل" };
  if (paidNum <= 0) return { key: "issue", label: "غير مدفوع" };
  return { key: "pending", label: "قيد التحصيل" };
}

function createEmptyForm(orderId, customers) {
  const firstCustomer = Array.isArray(customers) && customers.length ? customers[0] : null;

  return {
    purchaseId: "",
    orderId: orderId || "",
    customerId: firstCustomer?.id || "",
    customerName: firstCustomer?.name || "",
    qty: 1,
    price: "",
    paidPrice: "",
    bagSize: "كيس صغير",
    pickupPoint: firstCustomer?.usual_pickup_point || CUSTOMER_PICKUP_OPTIONS[2],
    note: "",
    links: [""],
    newFiles: [],
    existingImages: [],
    removeImageIds: []
  };
}


function Icon({ name, className = "" }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    viewBox: "0 0 24 24"
  };

  if (name === "menu") {
    return (
      <svg className={className} {...common}>
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="18" x2="20" y2="18" />
      </svg>
    );
  }

  if (name === "close") {
    return (
      <svg className={className} {...common}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg className={className} {...common}>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    );
  }

  if (name === "package") {
    return (
      <svg className={className} {...common}>
        <path d="M16.5 9.4 7.55 4.24" />
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    );
  }

  if (name === "map") {
    return (
      <svg className={className} {...common}>
        <path d="M12 22s7-5.7 7-12a7 7 0 1 0-14 0c0 6.3 7 12 7 12z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  }

  if (name === "home") {
    return (
      <svg className={className} {...common}>
        <path d="m3 10 9-7 9 7" />
        <path d="M9 22V12h6v10" />
        <path d="M3 10v12h18V10" />
      </svg>
    );
  }

  if (name === "archive") {
    return (
      <svg className={className} {...common}>
        <rect x="3" y="4" width="18" height="4" rx="1" />
        <path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
        <path d="M10 12h4" />
      </svg>
    );
  }

  if (name === "dollar") {
    return (
      <svg className={className} {...common}>
        <line x1="12" y1="2" x2="12" y2="22" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H7" />
      </svg>
    );
  }

  if (name === "users") {
    return (
      <svg className={className} {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <path d="M20 8v6" />
        <path d="M23 11h-6" />
      </svg>
    );
  }

  if (name === "bag") {
    return (
      <svg className={className} {...common}>
        <path d="M6 8h12l-1 12H7L6 8Z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
      </svg>
    );
  }

  if (name === "truck") {
    return (
      <svg className={className} {...common}>
        <path d="M10 17h4V5H2v12h3" />
        <path d="M14 9h4l4 4v4h-3" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    );
  }

  if (name === "logout") {
    return (
      <svg className={className} {...common}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg className={className} {...common}>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 10h18" />
      </svg>
    );
  }

  if (name === "chevron-left") {
    return (
      <svg className={className} {...common}>
        <path d="m15 18-6-6 6-6" />
      </svg>
    );
  }

  if (name === "chevron-right") {
    return (
      <svg className={className} {...common}>
        <path d="m9 18 6-6-6-6" />
      </svg>
    );
  }

  return null;
}

function statusLabel(status) {
  if (status === "completed") return "مكتمل";
  if (status === "processing") return "قيد التنفيذ";
  return "قيد الانتظار";
}

export default function OrdersPage() {
  const [globalOpen, setGlobalOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [resizing, setResizing] = useState(false);
  const [activeTab, setActiveTab] = useState("orders");
  const [search, setSearch] = useState("");
  const [editMode, setEditMode] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const { profile } = useAuthProfile();

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [purchaseSearch, setPurchaseSearch] = useState("");

  const [purchases, setPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchasesError, setPurchasesError] = useState("");

  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    city: CUSTOMER_CITIES[0],
    pickup: CUSTOMER_PICKUP_OPTIONS[2]
  });
  const [customerFormMessage, setCustomerFormMessage] = useState("");
  const [customerFormSaving, setCustomerFormSaving] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState("");
  const [editingCustomerForm, setEditingCustomerForm] = useState(null);

  const [menuPurchaseId, setMenuPurchaseId] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("add");
  const [formState, setFormState] = useState(() => createEmptyForm("", []));
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formUploadProgress, setFormUploadProgress] = useState("");
  const [formAiStatus, setFormAiStatus] = useState({ text: "", isError: false });
  const [formAiRunning, setFormAiRunning] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [newFilePreviews, setNewFilePreviews] = useState([]);

  const [toast, setToast] = useState(null);
  const [deleteSnapshot, setDeleteSnapshot] = useState(null);
  const [lightbox, setLightbox] = useState({ open: false, images: [], index: 0, title: "" });

  const location = useLocation();
  const navigate = useNavigate();

  const groupedOrders = useMemo(() => groupOrdersByMonth(orders, search), [orders, search]);
  const searchCount = useMemo(
    () => groupedOrders.reduce((sum, group) => sum + group.orders.length, 0),
    [groupedOrders]
  );

  const totalOrders = orders.length;
  const isRahaf = profile.role === "rahaf";
  const isViewOnlyRole = profile.role === "reem" || profile.role === "rawand";
  const canUseOrdersWorkbench = isRahaf || isViewOnlyRole;
  const allowedTabs = isRahaf ? ["orders", "view", "customers"] : ["orders"];

  const visibleNavItems = useMemo(() => getOrdersNavItems(profile.role), [profile.role]);

  const selectedOrder = useMemo(
    () => orders.find((order) => String(order.id) === String(selectedOrderId)) || null,
    [orders, selectedOrderId]
  );

  const filteredPurchases = useMemo(() => {
    return searchByName(purchases, purchaseSearch, (item) => [item.customer_name, item.note]);
  }, [purchaseSearch, purchases]);

  const purchaseStats = useMemo(() => {
    const count = purchases.length;
    const totalQty = purchases.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const totalPrice = purchases.reduce((sum, item) => sum + parsePrice(item.price), 0);
    return { count, totalQty, totalPrice };
  }, [purchases]);

  const filteredCustomers = useMemo(() => {
    return searchByName(customers, customerSearch, (customer) => [
      customer.name,
      customer.phone,
      customer.city
    ]);
  }, [customerSearch, customers]);

  const refreshOrders = useCallback(async (preferredId = "") => {
    setOrdersLoading(true);
    setOrdersError("");

    try {
      const data = await fetchOrdersWithSummary();
      setOrders(data);
      setSelectedOrderId((prev) => {
        const candidate = preferredId || prev;
        if (candidate && data.some((order) => String(order.id) === String(candidate))) {
          return candidate;
        }
        return data[0]?.id || "";
      });
    } catch (error) {
      console.error(error);
      setOrdersError("فشل تحميل الطلبات من قاعدة البيانات.");
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const refreshCustomers = useCallback(async () => {
    setCustomersLoading(true);
    setCustomersError("");

    try {
      const list = await fetchCustomers();
      setCustomers(list || []);
      setEditingCustomerId((prev) =>
        prev && (list || []).some((customer) => String(customer.id) === String(prev)) ? prev : ""
      );
    } catch (error) {
      console.error(error);
      setCustomersError("فشل تحميل بيانات العملاء.");
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  const refreshPurchases = useCallback(async (orderId) => {
    if (!orderId) {
      setPurchases([]);
      setPurchasesLoading(false);
      return;
    }

    setPurchasesLoading(true);
    setPurchasesError("");

    try {
      const list = await fetchPurchasesByOrder(orderId);
      setPurchases(list || []);
    } catch (error) {
      console.error(error);
      setPurchasesError("فشل تحميل المشتريات.");
    } finally {
      setPurchasesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profile.authenticated) {
      setOrdersLoading(false);
      setCustomersLoading(false);
      return;
    }

    if (!canUseOrdersWorkbench) {
      setOrders([]);
      setOrdersLoading(false);
      setCustomers([]);
      setCustomersLoading(false);
      setOrdersError("هذا الحساب لا يملك صلاحية صفحة الطلبات.");
      return;
    }

    refreshOrders();
    refreshCustomers();
  }, [canUseOrdersWorkbench, profile.authenticated, refreshCustomers, refreshOrders]);

  useEffect(() => {
    if (!profile.authenticated) return;
    if (!isViewOnlyRole) return;
    setEditMode(false);
    setActiveTab("orders");
  }, [isViewOnlyRole, profile.authenticated]);


  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabFromUrl = params.get("tab");
    const modeFromUrl = params.get("mode");

    if (tabFromUrl && allowedTabs.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }

    if (isRahaf && modeFromUrl) {
      if (modeFromUrl === "edit" && !editMode) setEditMode(true);
      if (modeFromUrl === "view" && editMode) setEditMode(false);
    }
  }, [activeTab, allowedTabs, editMode, isRahaf, location.search]);

  useEffect(() => {
    if (!profile.authenticated) return;

    const params = new URLSearchParams(location.search);
    let changed = false;

    if (params.get("tab") !== activeTab) {
      params.set("tab", activeTab);
      changed = true;
    }

    if (isRahaf) {
      const modeValue = editMode ? "edit" : "view";
      if (params.get("mode") !== modeValue) {
        params.set("mode", modeValue);
        changed = true;
      }
    } else if (params.has("mode")) {
      params.delete("mode");
      changed = true;
    }

    if (!changed) return;
    const query = params.toString();
    navigate(query ? `${location.pathname}?${query}` : location.pathname, { replace: true });
  }, [activeTab, editMode, isRahaf, location.pathname, location.search, navigate, profile.authenticated]);

  useEffect(() => {
    if (allowedTabs.includes(activeTab)) return;
    setActiveTab("orders");
  }, [activeTab, allowedTabs]);

  useEffect(() => {
    if (!profile.authenticated) return;
    if (profile.role !== "laaura") return;
    window.location.hash = "#/pickuppoint";
  }, [profile.authenticated, profile.role]);

  useEffect(() => {
    if (activeTab !== "orders") return;
    refreshPurchases(selectedOrderId);
  }, [activeTab, refreshPurchases, selectedOrderId]);

  useEffect(() => {
    if (!resizing) return;

    const onMove = (event) => {
      const next = window.innerWidth - event.clientX;
      if (next >= 280 && next <= 500) {
        setSidebarWidth(next);
      }
    };

    const onUp = () => setResizing(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onDocClick = (event) => {
      if (!event.target.closest("[data-menu-root]")) {
        setMenuPurchaseId("");
      }
    };

    document.addEventListener("click", onDocClick);
    return () => {
      document.removeEventListener("click", onDocClick);
    };
  }, []);

  useEffect(() => {
    const previews = formState.newFiles.map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}`,
      url: URL.createObjectURL(file)
    }));

    setNewFilePreviews(previews);

    return () => {
      previews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [formState.newFiles]);

  const handleCreateCustomer = async (event) => {
    event.preventDefault();
    setCustomerFormMessage("");

    const name = String(customerForm.name || "").trim();
    const phone = normalizePhone(customerForm.phone);
    const city = String(customerForm.city || "").trim();
    const pickup = String(customerForm.pickup || "").trim();

    if (!name) {
      setCustomerFormMessage("الاسم مطلوب.");
      return;
    }
    if (!phone) {
      setCustomerFormMessage("رقم الهاتف مطلوب.");
      return;
    }
    if (!isValidCustomerPhone(phone)) {
      setCustomerFormMessage("رقم الهاتف يجب أن يبدأ بـ 970 أو 972.");
      return;
    }
    if (!city) {
      setCustomerFormMessage("اختاري المدينة.");
      return;
    }

    setCustomerFormSaving(true);
    setCustomerFormMessage("جاري الحفظ...");

    try {
      await createCustomer({
        name,
        phone,
        city,
        usual_pickup_point: pickup
      });

      setCustomerForm({
        name: "",
        phone: "",
        city: CUSTOMER_CITIES[0],
        pickup: CUSTOMER_PICKUP_OPTIONS[2]
      });
      setCustomerFormMessage("تم ✅");
      await refreshCustomers();
      setToast({ type: "success", text: "تم حفظ العميل." });
    } catch (error) {
      console.error(error);
      setCustomerFormMessage(customerFriendlyError(error, "فشل إضافة العميل."));
    } finally {
      setCustomerFormSaving(false);
    }
  };

  const beginEditCustomer = (customer) => {
    setEditingCustomerId(customer.id);
    setEditingCustomerForm({
      name: customer.name || "",
      phone: customer.phone || "",
      city: customer.city || CUSTOMER_CITIES[0],
      pickup: customer.usual_pickup_point || CUSTOMER_PICKUP_OPTIONS[2]
    });
  };

  const cancelEditCustomer = () => {
    setEditingCustomerId("");
    setEditingCustomerForm(null);
  };

  const saveEditCustomer = async (customerId) => {
    if (!editingCustomerForm) return;

    const name = String(editingCustomerForm.name || "").trim();
    const phone = normalizePhone(editingCustomerForm.phone);
    const city = String(editingCustomerForm.city || "").trim();
    const pickup = String(editingCustomerForm.pickup || "").trim();

    if (!name) {
      setToast({ type: "warn", text: "الاسم مطلوب." });
      return;
    }
    if (!phone) {
      setToast({ type: "warn", text: "رقم الهاتف مطلوب." });
      return;
    }
    if (!isValidCustomerPhone(phone)) {
      setToast({ type: "warn", text: "رقم الهاتف يجب أن يبدأ بـ 970 أو 972." });
      return;
    }
    if (!city) {
      setToast({ type: "warn", text: "اختاري المدينة." });
      return;
    }

    try {
      await updateCustomer(customerId, {
        name,
        phone,
        city,
        usual_pickup_point: pickup
      });

      setToast({ type: "success", text: "تم تحديث العميل." });
      cancelEditCustomer();
      await refreshCustomers();
    } catch (error) {
      console.error(error);
      setToast({ type: "danger", text: customerFriendlyError(error, "فشل تحديث العميل.") });
    }
  };

  const handleDeleteCustomer = async (customer) => {
    const ok = window.confirm(`هل تريدين حذف العميل${customer?.name ? ` (${customer.name})` : ""}؟`);
    if (!ok) return;

    try {
      await deleteCustomer(customer.id);
      setToast({ type: "success", text: "تم حذف العميل." });
      if (String(editingCustomerId) === String(customer.id)) {
        cancelEditCustomer();
      }
      await refreshCustomers();
    } catch (error) {
      console.error(error);
      setToast({ type: "danger", text: customerFriendlyError(error, "فشل حذف العميل.") });
    }
  };

  const signOut = async () => {
    await signOutAndRedirect();
  };

  const clearFormAiStatus = useCallback(() => {
    setFormAiStatus({ text: "", isError: false });
  }, []);

  const openAddModal = () => {
    if (!selectedOrder) return;
    setFormMode("add");
    setFormState(createEmptyForm(selectedOrder.id, customers));
    setFormError("");
    setFormUploadProgress("");
    clearFormAiStatus();
    setFormOpen(true);
  };

  const openEditModal = (purchase) => {
    setFormMode("edit");
    setFormState({
      purchaseId: purchase.id,
      orderId: purchase.order_id,
      customerId: purchase.customer_id || "",
      customerName: purchase.customer_name || "",
      qty: purchase.qty ?? 1,
      price: purchase.price ?? "",
      paidPrice: purchase.paid_price ?? purchase.price ?? "",
      bagSize: purchase.bag_size || "كيس صغير",
      pickupPoint: purchase.pickup_point || CUSTOMER_PICKUP_OPTIONS[2],
      note: purchase.note || "",
      links: purchase.links?.length ? purchase.links : [""],
      newFiles: [],
      existingImages: purchase.images || [],
      removeImageIds: []
    });
    setFormError("");
    setFormUploadProgress("");
    clearFormAiStatus();
    setFormOpen(true);
    setMenuPurchaseId("");
  };

  const closeFormModal = () => {
    if (formSaving || formAiRunning) return;
    setFormOpen(false);
    setFormError("");
    setFormUploadProgress("");
    clearFormAiStatus();
  };

  const updateForm = (patch) => {
    setFormState((prev) => ({ ...prev, ...patch }));
  };

  const updateLinkValue = (index, value) => {
    setFormState((prev) => {
      const links = [...prev.links];
      links[index] = value;
      return { ...prev, links };
    });
  };

  const addLinkInput = () => {
    setFormState((prev) => ({ ...prev, links: [...prev.links, ""] }));
    clearFormAiStatus();
  };

  const removeLinkInput = () => {
    setFormState((prev) => {
      if (prev.links.length <= 1) return prev;
      return { ...prev, links: prev.links.slice(0, -1) };
    });
    clearFormAiStatus();
  };

  const addNewImages = (files) => {
    const picked = Array.from(files || []).filter(
      (file) => file && file.type && file.type.startsWith("image/")
    );
    if (!picked.length) return;

    setFormState((prev) => {
      const remainingExisting =
        prev.existingImages.filter((img) => !prev.removeImageIds.includes(img.id)).length;
      const allowed = Math.max(0, MAX_IMAGES - remainingExisting - prev.newFiles.length);
      const toAdd = picked.slice(0, allowed);

      if (!toAdd.length) {
        setFormError(`الحد الأقصى للصور هو ${MAX_IMAGES}.`);
        return prev;
      }

      return { ...prev, newFiles: [...prev.newFiles, ...toAdd] };
    });
    clearFormAiStatus();
  };

  const removeNewImage = (index) => {
    setFormState((prev) => ({
      ...prev,
      newFiles: prev.newFiles.filter((_, i) => i !== index)
    }));
    clearFormAiStatus();
  };

  const toggleExistingImageRemoval = (imageId) => {
    setFormState((prev) => {
      const ids = prev.removeImageIds.includes(imageId)
        ? prev.removeImageIds.filter((id) => id !== imageId)
        : [...prev.removeImageIds, imageId];
      return { ...prev, removeImageIds: ids };
    });
    clearFormAiStatus();
  };

  const onCustomerChange = (customerId) => {
    const customer = customers.find((item) => String(item.id) === String(customerId));
    setFormState((prev) => ({
      ...prev,
      customerId,
      customerName: customer?.name || "",
      pickupPoint: customer?.usual_pickup_point || prev.pickupPoint
    }));
  };

  const submitPurchaseForm = async (event) => {
    event.preventDefault();

    if (!selectedOrder) {
      setFormError("اختاري طلبًا أولًا.");
      return;
    }

    const qty = Number(formState.qty);
    const price = Number(formState.price);
    const paidPrice = Number(formState.paidPrice);

    if (!formState.customerId) {
      setFormError("اختاري الزبون.");
      return;
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 200) {
      setFormError("عدد القطع يجب أن يكون بين 1 و 200.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setFormError("السعر غير صالح.");
      return;
    }
    if (!Number.isFinite(paidPrice) || paidPrice < 0) {
      setFormError("السعر المدفوع غير صالح.");
      return;
    }

    const normalizedLinks = sanitizeLinks(formState.links);
    setFormSaving(true);
    setFormError("");
    setFormUploadProgress("");

    try {
      if (formMode === "add") {
        const result = await createPurchaseWithRelations({
          purchase: {
            order_id: selectedOrder.id,
            customer_id: formState.customerId,
            customer_name: formState.customerName,
            qty,
            price,
            paid_price: paidPrice,
            bag_size: formState.bagSize,
            pickup_point: formState.pickupPoint,
            note: formState.note.trim()
          },
          links: normalizedLinks,
          files: formState.newFiles,
          onUploadProgress: (done, total) => {
            setFormUploadProgress(`جاري رفع الصور ${done}/${total}...`);
          }
        });

        if (result.uploadErrors.length) {
          setToast({ type: "warn", text: "تمت الإضافة مع أخطاء في بعض الصور." });
        } else {
          setToast({ type: "success", text: "تمت إضافة المشترى." });
        }
      } else {
        const removeImages = formState.existingImages.filter((img) =>
          formState.removeImageIds.includes(img.id)
        );

        await updatePurchaseWithRelations({
          purchaseId: formState.purchaseId,
          purchasePatch: {
            order_id: selectedOrder.id,
            customer_id: formState.customerId,
            customer_name: formState.customerName,
            qty,
            price,
            paid_price: paidPrice,
            bag_size: formState.bagSize,
            pickup_point: formState.pickupPoint,
            note: formState.note.trim()
          },
          links: normalizedLinks,
          removeImages,
          newFiles: formState.newFiles,
          onUploadProgress: (done, total) => {
            setFormUploadProgress(`جاري رفع الصور ${done}/${total}...`);
          }
        });

        setToast({ type: "success", text: "تم تحديث المشترى." });
      }

      await refreshPurchases(selectedOrder.id);
      await refreshOrders(selectedOrder.id);
      setFormOpen(false);
      setFormUploadProgress("");
      clearFormAiStatus();
    } catch (error) {
      console.error(error);
      setFormError(error?.message || "تعذر حفظ البيانات.");
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeletePurchase = async (purchase) => {
    const ok = window.confirm("هل تريدين حذف هذا المشترى؟");
    if (!ok) return;

    setMenuPurchaseId("");

    try {
      await deletePurchaseById(purchase.id);

      setDeleteSnapshot({
        purchase: {
          id: purchase.id,
          order_id: purchase.order_id,
          customer_id: purchase.customer_id,
          customer_name: purchase.customer_name,
          qty: purchase.qty,
          price: purchase.price,
          paid_price: purchase.paid_price,
          bag_size: purchase.bag_size,
          pickup_point: purchase.pickup_point,
          note: purchase.note,
          created_at: purchase.created_at
        },
        links: purchase.links || [],
        images: (purchase.images || []).map((img) => ({
          id: img.id,
          storage_path: img.storage_path
        }))
      });

      setToast({ type: "info", text: "تم حذف المشترى.", action: "تراجع" });
      await refreshPurchases(selectedOrder.id);
      await refreshOrders(selectedOrder.id);
    } catch (error) {
      console.error(error);
      setToast({ type: "danger", text: "فشل حذف المشترى." });
    }
  };

  const undoDeletePurchase = async () => {
    if (!deleteSnapshot || !selectedOrder) return;

    try {
      await restoreDeletedPurchase(deleteSnapshot);
      setDeleteSnapshot(null);
      setToast({ type: "success", text: "تم التراجع عن الحذف." });
      await refreshPurchases(selectedOrder.id);
      await refreshOrders(selectedOrder.id);
    } catch (error) {
      console.error(error);
      setToast({ type: "danger", text: "فشل التراجع عن الحذف." });
    }
  };

  const handleMarkPaid = async (purchase) => {
    try {
      await markPurchasePaidPrice(purchase.id, parsePrice(purchase.price));
      setToast({ type: "success", text: "تم تحديث المدفوع." });
      setMenuPurchaseId("");
      await refreshPurchases(selectedOrder.id);
    } catch (error) {
      console.error(error);
      setToast({ type: "danger", text: "فشل تحديث المدفوع." });
    }
  };

  const handleToggleArrived = async () => {
    if (!selectedOrder || !isRahaf) return;

    const next = !selectedOrder.arrived;

    try {
      const { error } = await sb.from("orders").update({ arrived: next }).eq("id", selectedOrder.id);
      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          String(order.id) === String(selectedOrder.id)
            ? { ...order, arrived: next, status: next ? "completed" : "pending" }
            : order
        )
      );
      setToast({ type: "success", text: next ? "تم تعليم الطلب كواصل." : "تمت إزالة حالة الوصول." });
    } catch (error) {
      console.error(error);
      setToast({ type: "danger", text: "فشل تحديث حالة الوصول." });
    }
  };

  const notifyViaWhatsapp = async (purchase) => {
    if (!selectedOrder?.arrived || !isRahaf) {
      setToast({ type: "warn", text: "يجب أن تكون الطلبية واصلة أولًا." });
      return;
    }

    try {
      const target = await resolvePurchaseWhatsappTarget(purchase);
      const message = buildArrivalNotifyMessage({
        pickupPoint: purchase.pickup_point,
        price: purchase.price,
        customerName: target.customerName
      });
      const url = `https://wa.me/${target.phone}?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(error);
      setToast({ type: "danger", text: error?.message || "تعذر فتح واتساب." });
    }
  };

  const inquirePickupViaWhatsapp = async (purchase) => {
    if (!selectedOrder?.arrived || !isRahaf) {
      setToast({ type: "warn", text: "يجب أن تكون الطلبية واصلة أولًا." });
      return;
    }

    try {
      const target = await resolvePurchaseWhatsappTarget(purchase);
      const message = buildPickupInquiryMessage();
      const url = `https://wa.me/${target.phone}?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(error);
      setToast({ type: "danger", text: error?.message || "تعذر فتح واتساب." });
    }
  };

  const analyzeFormImagesWithGemini = async () => {
    if (!formOpen) {
      setToast({ type: "warn", text: "افتحي نموذج الإضافة/التعديل أولًا." });
      return;
    }
    if (!hasGeminiKey()) {
      setFormAiStatus({ text: "مفتاح Gemini غير مضبوط.", isError: true });
      return;
    }

    const files = formState.newFiles || [];
    const existingUrls =
      formMode === "edit"
        ? (formState.existingImages || [])
            .filter((img) => !formState.removeImageIds.includes(img.id))
            .map((img) => img.url)
            .filter(Boolean)
        : [];

    if (!files.length && !existingUrls.length) {
      setFormAiStatus({ text: "أضيفي صورًا أولًا.", isError: true });
      return;
    }

    setFormAiRunning(true);
    setFormAiStatus({ text: "جاري التحليل...", isError: false });
    setFormError("");

    try {
      const result = await runGeminiCartAnalysis({
        files,
        urls: existingUrls,
        onProgress: (text) => setFormAiStatus({ text, isError: false })
      });

      const total = resolveTotalFromGemini(result);
      if (!Number.isFinite(total) || total <= 0) {
        throw new Error("لم يتم العثور على أسعار واضحة. جربي صورًا أوضح.");
      }

      const rounded = Math.round(total);
      setFormState((prev) => ({
        ...prev,
        price: String(rounded),
        paidPrice: String(rounded)
      }));
      setFormAiStatus({ text: `تم احتساب السعر: ${rounded}`, isError: false });
    } catch (error) {
      setFormAiStatus({ text: error?.message || "فشل التحليل.", isError: true });
    } finally {
      setFormAiRunning(false);
    }
  };

  const handleGeminiToolbarAction = () => {
    if (!isRahaf || !editMode) return;
    if (!selectedOrder) {
      setToast({ type: "warn", text: "اختاري طلبًا أولًا." });
      return;
    }
    if (!formOpen) {
      openAddModal();
      setFormAiStatus({ text: "أضيفي صورًا ثم اضغطي «تحليل Gemini».", isError: false });
      return;
    }
    analyzeFormImagesWithGemini();
  };

  const exportPdfNative = async () => {
    if (!selectedOrder) return;
    if (pdfExporting) return;

    setPdfExporting(true);
    try {
      await exportOrderPdf({
        order: selectedOrder,
        purchases
      });
      setToast({ type: "success", text: "تم تصدير ملف PDF." });
    } catch (error) {
      console.error(error);
      setToast({ type: "danger", text: error?.message || "فشل تصدير PDF." });
    } finally {
      setPdfExporting(false);
    }
  };

  if (profile.loading) {
    return (
      <div className="orders-page orders-loading-screen" dir="rtl">
        <div className="legacy-note">
          <h2>جاري التحقق من الجلسة...</h2>
        </div>
      </div>
    );
  }

  if (!profile.authenticated) {
    return (
      <div className="orders-page orders-loading-screen" dir="rtl">
        <div className="legacy-note legacy-note-danger">
          <h2>لا توجد جلسة نشطة</h2>
          <p>يلزم تسجيل الدخول قبل استخدام واجهة React.</p>
          <a href="#/login" className="mode auth-link">
            فتح تسجيل الدخول
          </a>
        </div>
      </div>
    );
  }

  if (!canUseOrdersWorkbench) {
    return (
      <div className="orders-page orders-loading-screen" dir="rtl">
        <div className="legacy-note legacy-note-danger">
          <h2>لا يمكن فتح صفحة الطلبات</h2>
          <p>
            هذا الحساب لا يملك صلاحية صفحة الطلبات. سيتم تحويلك للصفحة المناسبة حسب الدور.
          </p>
          <a
            href={profile.role === "laaura" ? "#/pickuppoint" : "#/login"}
            className="mode auth-link"
          >
            متابعة
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-page" dir="rtl">
      <div
        className={`global-overlay ${globalOpen ? "open" : ""}`}
        onClick={() => setGlobalOpen(false)}
      />

      <aside className={`global-sidebar ${globalOpen ? "open" : ""}`}>
        <div className="global-sidebar-head">
          <div className="brand-chip">
            <span className="brand-icon">SS</span>
            <div>
              <h2>She-Store</h2>
              <p>{getRoleLabel(profile.role)}</p>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={() => setGlobalOpen(false)}>
            <Icon name="close" className="icon" />
          </button>
        </div>

        <nav className="global-sidebar-nav">
          {visibleNavItems.map((item) => (
            <a
              key={item.id}
              className={`nav-item ${item.id === "orders" ? "active" : ""}`}
              href={item.href}
            >
              <span className="icon-wrap">
                <Icon name={item.icon} className="icon" />
              </span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <button type="button" className="logout-btn" onClick={signOut}>
          <Icon name="logout" className="icon" />
          <span>تسجيل الخروج</span>
        </button>
      </aside>

      <CommandHeader
        isRahaf={isRahaf}
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        search={search}
        onSearchChange={setSearch}
        searchCount={searchCount}
        editMode={editMode}
        onEditModeChange={setEditMode}
        onOpenSidebar={() => setGlobalOpen(true)}
        Icon={Icon}
      />

      <div className="workspace">
        <OrdersSidebar
          collapsed={collapsed}
          sidebarWidth={sidebarWidth}
          onStartResize={() => setResizing(true)}
          groupedOrders={groupedOrders}
          ordersLoading={ordersLoading}
          ordersError={ordersError}
          selectedOrderId={selectedOrderId}
          onSelectOrder={setSelectedOrderId}
          isRahaf={isRahaf}
          onForceOrdersTab={() => setActiveTab("orders")}
          totalOrders={totalOrders}
          statusLabel={statusLabel}
          onExpand={() => setCollapsed(false)}
          onCollapse={() => setCollapsed(true)}
          Icon={Icon}
        />

        <section className="workspace-main">
          {activeTab === "orders" ? (
            <OrdersTab
              selectedOrder={selectedOrder}
              purchaseStats={purchaseStats}
              purchaseSearch={purchaseSearch}
              onPurchaseSearchChange={setPurchaseSearch}
              isRahaf={isRahaf}
              editMode={editMode}
              onToggleArrived={handleToggleArrived}
              onOpenAddModal={openAddModal}
              onExportPdf={exportPdfNative}
              pdfExporting={pdfExporting}
              onGeminiAction={handleGeminiToolbarAction}
              customersError={customersError}
              purchasesLoading={purchasesLoading}
              purchasesError={purchasesError}
              filteredPurchases={filteredPurchases}
              paymentState={paymentState}
              menuPurchaseId={menuPurchaseId}
              onTogglePurchaseMenu={(purchaseId) =>
                setMenuPurchaseId((prev) => (String(prev) === String(purchaseId) ? "" : purchaseId))
              }
              onEditPurchase={openEditModal}
              onMarkPaid={handleMarkPaid}
              onDeletePurchase={handleDeletePurchase}
              onOpenLightbox={(images, index, title) => setLightbox({ open: true, images, index, title })}
              onInquireWhatsapp={inquirePickupViaWhatsapp}
              onNotifyWhatsapp={notifyViaWhatsapp}
            />
          ) : activeTab === "customers" ? (
            <CustomersTab
              customerSearch={customerSearch}
              setCustomerSearch={setCustomerSearch}
              customers={customers}
              customersLoading={customersLoading}
              customersError={customersError}
              filteredCustomers={filteredCustomers}
              customerForm={customerForm}
              setCustomerForm={setCustomerForm}
              customerFormMessage={customerFormMessage}
              customerFormSaving={customerFormSaving}
              handleCreateCustomer={handleCreateCustomer}
              editingCustomerId={editingCustomerId}
              editingCustomerForm={editingCustomerForm}
              setEditingCustomerForm={setEditingCustomerForm}
              beginEditCustomer={beginEditCustomer}
              saveEditCustomer={saveEditCustomer}
              cancelEditCustomer={cancelEditCustomer}
              handleDeleteCustomer={handleDeleteCustomer}
              cityOptions={CUSTOMER_CITIES}
              pickupOptions={CUSTOMER_PICKUP_OPTIONS}
            />
          ) : activeTab === "view" ? (
            <ViewTab
              role={profile.role}
              onOpenLightbox={(images, index, title) =>
                setLightbox({ open: true, images, index, title: title || "صورة" })
              }
              onToast={setToast}
            />
          ) : null}
        </section>
      </div>

      <PurchaseFormModal
        open={formOpen}
        formMode={formMode}
        formState={formState}
        customers={customers}
        customersLoading={customersLoading}
        formSaving={formSaving}
        formAiRunning={formAiRunning}
        formAiStatus={formAiStatus}
        formUploadProgress={formUploadProgress}
        formError={formError}
        newFilePreviews={newFilePreviews}
        maxImages={MAX_IMAGES}
        bagOptions={BAG_OPTIONS}
        pickupOptions={CUSTOMER_PICKUP_OPTIONS}
        onClose={closeFormModal}
        onSubmit={submitPurchaseForm}
        onCustomerChange={onCustomerChange}
        onUpdateForm={updateForm}
        onAddLinkInput={addLinkInput}
        onRemoveLinkInput={removeLinkInput}
        onUpdateLinkValue={updateLinkValue}
        onAddNewImages={addNewImages}
        onAnalyzeWithGemini={analyzeFormImagesWithGemini}
        onToggleExistingImageRemoval={toggleExistingImageRemoval}
        onRemoveNewImage={removeNewImage}
        Icon={Icon}
      />

      <LightboxModal
        lightbox={lightbox}
        onClose={() => setLightbox({ open: false, images: [], index: 0, title: "" })}
        onPrev={() =>
          setLightbox((prev) => ({
            ...prev,
            index: (prev.index - 1 + prev.images.length) % prev.images.length
          }))
        }
        onNext={() =>
          setLightbox((prev) => ({
            ...prev,
            index: (prev.index + 1) % prev.images.length
          }))
        }
        Icon={Icon}
      />

      {toast ? (
        <div className={`toast toast-${toast.type || "info"}`}>
          <span>{toast.text}</span>
          {toast.action === "تراجع" ? (
            <button type="button" onClick={undoDeletePurchase}>
              تراجع
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
