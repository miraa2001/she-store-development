const ROLE_LABELS = {
  rahaf: "رهف",
  reem: "ريم",
  rawand: "روند",
  laaura: "لارا"
};

const ORDERS_NAV_ITEMS = [
  { id: "orders", label: "الطلبات", href: "#/orders", icon: "package" },
  { id: "pickup-dashboard", label: "لوحة الاستلام", href: "#/pickup-dashboard", icon: "map" },
  { id: "pickuppoint", label: "نقطة الاستلام", href: "#/pickuppoint", icon: "home" },
  { id: "archive", label: "الأرشيف", href: "#/archive", icon: "archive" },
  { id: "finance", label: "المالية", href: "#/finance", icon: "dollar" },
  { id: "collections", label: "المجموعات", href: "#/collections", icon: "bag" },
  { id: "homepickup", label: "استلام المنزل", href: "#/homepickup", icon: "truck" },
  { id: "customers", label: "العملاء", href: "#/orders?tab=customers", icon: "users" }
];

const ORDERS_NAV_ACCESS = {
  rahaf: ["orders", "pickup-dashboard", "archive", "finance", "customers", "collections"],
  reem: ["orders", "pickup-dashboard", "customers", "homepickup"],
  rawand: ["orders", "pickup-dashboard", "customers", "homepickup"],
  laaura: ["orders", "pickuppoint"]
};

const PICKUP_SIDEBAR_LINKS_BY_ROLE = {
  rahaf: [
    { label: "الطلبيات", href: "#/orders" },
    { label: "الاستلام والتحصيل", href: "#/pickup-dashboard" },
    { label: "الأرشيف", href: "#/archive" },
    { label: "المالية", href: "#/finance" }
  ],
  reem: [
    { label: "الطلبيات", href: "#/orders" },
    { label: "الاستلام والتحصيل", href: "#/pickup-dashboard" }
  ],
  rawand: [
    { label: "الطلبيات", href: "#/orders" },
    { label: "الاستلام والتحصيل", href: "#/pickup-dashboard" }
  ]
};

const PICKUP_TABS_BY_ROLE = {
  rahaf: ["home", "aura", "collections"],
  reem: ["home"],
  rawand: ["home"],
  laaura: ["aura"]
};

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || "مستخدم";
}

export function getOrdersNavItems(role) {
  const allowed = ORDERS_NAV_ACCESS[role] || ["orders"];
  return ORDERS_NAV_ITEMS.filter((item) => allowed.includes(item.id));
}

export function getPickupDashboardTabs(role) {
  return PICKUP_TABS_BY_ROLE[role] || [];
}

export function getPickupSidebarLinks(role) {
  return PICKUP_SIDEBAR_LINKS_BY_ROLE[role] || [];
}

