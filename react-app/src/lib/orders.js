import { sb } from "./supabaseClient";

export const IMAGE_BUCKET = "purchase-images";

export function parsePrice(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const cleaned = String(value)
    .replace(/[, ]/g, "")
    .replace(/[₪]/g, "");

  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

export function formatILS(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  const fixed = number.toFixed(2);
  return fixed.endsWith(".00") ? String(Math.round(number)) : fixed;
}

function monthKey(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("ar", {
    month: "long",
    year: "numeric"
  });
}

function shortOrderNo(id) {
  const text = String(id || "").replace(/-/g, "");
  if (!text) return "----";
  return text.slice(-4);
}

export async function fetchOrdersWithSummary() {
  const { data: orders, error } = await sb
    .from("orders")
    .select("id, order_name, created_at, arrived, placed_at_pickup")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const normalizedOrders = (orders || []).map((order) => ({
    id: order.id,
    name: String(order.order_name || "").trim() || "طلب بدون اسم",
    createdAt: order.created_at,
    arrived: !!order.arrived,
    placedAtPickup: !!order.placed_at_pickup,
    orderNo: shortOrderNo(order.id)
  }));

  if (!normalizedOrders.length) {
    return [];
  }

  const ids = normalizedOrders.map((order) => order.id);

  const { data: purchases, error: purchasesError } = await sb
    .from("purchases")
    .select("order_id, price")
    .in("order_id", ids);

  if (purchasesError) throw purchasesError;

  const totals = new Map();
  (purchases || []).forEach((purchase) => {
    const id = purchase.order_id;
    if (!id) return;
    const next = (totals.get(id) || 0) + parsePrice(purchase.price);
    totals.set(id, next);
  });

  return normalizedOrders.map((order) => {
    const total = totals.get(order.id) || 0;
    return {
      ...order,
      amountRaw: total,
      amountLabel: `${formatILS(total)} ر.س`,
      status: order.arrived ? "completed" : "pending"
    };
  });
}

export async function fetchArrivedOrders() {
  const { data, error } = await sb
    .from("orders")
    .select("id, order_name, created_at, arrived, placed_at_pickup, placed_at_pickup_at")
    .eq("arrived", true)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((order) => ({
    id: order.id,
    name: String(order.order_name || "").trim() || "طلب بدون اسم",
    createdAt: order.created_at,
    arrived: !!order.arrived,
    placedAtPickup: !!order.placed_at_pickup,
    placedAtPickupAt: order.placed_at_pickup_at || null,
    orderNo: shortOrderNo(order.id)
  }));
}

export async function updateOrderPlacedAtPickup(orderId, enabled) {
  const payload = enabled
    ? { placed_at_pickup: true, placed_at_pickup_at: new Date().toISOString() }
    : { placed_at_pickup: false, placed_at_pickup_at: null };

  const { error } = await sb.from("orders").update(payload).eq("id", orderId);
  if (error) throw error;
  return payload;
}

export function groupOrdersByMonth(orders, query = "") {
  const needle = String(query || "").trim().toLowerCase();

  const filtered = !needle
    ? orders
    : orders.filter((order) => order.name.toLowerCase().includes(needle));

  const grouped = [];
  const map = new Map();

  filtered.forEach((order) => {
    const key = monthKey(order.createdAt);
    if (!map.has(key)) {
      const item = { month: key, orders: [] };
      map.set(key, item);
      grouped.push(item);
    }
    map.get(key).orders.push(order);
  });

  return grouped;
}
