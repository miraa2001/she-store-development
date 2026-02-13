import { sb } from "./supabaseClient";
import { formatILS } from "./orders";

function normalizePhone(value) {
  const converted = String(value || "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

  return converted.replace(/[^\d]/g, "");
}

export function toWhatsappPhone(value) {
  let phone = normalizePhone(value);
  if (!phone) return "";
  if (phone.startsWith("00")) phone = phone.slice(2);
  if (phone.startsWith("970") || phone.startsWith("972")) return phone;

  if (phone.startsWith("0")) {
    const local = phone.slice(1);
    if (local.startsWith("59") || local.startsWith("56")) return `970${local}`;
    if (local.startsWith("5")) return `972${local}`;
  }

  return phone;
}

export function isValidWhatsappPhone(value) {
  const phone = toWhatsappPhone(value);
  return /^(970|972)\d{8,9}$/.test(phone);
}

export function buildArrivalNotifyMessage({ pickupPoint, price, customerName }) {
  const priceText = formatILS(price);
  const name = String(customerName || "").trim();
  const greeting = name ? `مرحبا ${name}💖` : "مرحبا حبيبتي💖";

  if (pickupPoint === "من نقطة الاستلام") {
    return [
      greeting,
      "طلبك جاهز بنقطة الاستلام",
      "📍كافيه la aura سوق الذهب",
      "⏰ بفتحوا من ال٨ صباحاً لل١٠ مساءً",
      `📦 حسابك: ${priceText} شيكل`
    ].join("\n");
  }

  if (pickupPoint === "من البيت") {
    return [
      greeting,
      "طلبك جاهز عندي بالبيت",
      "خبريني قبل بوقت وينتا رح تستلمي💌",
      `📦حسابك: ${priceText} شيكل`
    ].join("\n");
  }

  return [
    greeting,
    `طلبك جاهز للاستلام (${pickupPoint || "—"})`,
    `📦 حسابك: ${priceText} شيكل`
  ].join("\n");
}

export function buildPickupInquiryMessage() {
  return [
    "مرحبا حبيبتي طلبك وصل 📦",
    "بتحبي تستلمي من:",
    "📍بيتي بالحي الجنوبي",
    "أو",
    "📍نقطة الاستلام كافيه la aura سوق الذهب ؟",
    "خبريني لو سمحتي🤍"
  ].join("\n");
}

export async function resolvePurchaseWhatsappTarget(purchase) {
  if (!purchase?.customer_id) {
    throw new Error("لا يوجد رقم هاتف لهذا الزبون.");
  }

  const { data: customer, error } = await sb
    .from("customers")
    .select("phone, name")
    .eq("id", purchase.customer_id)
    .maybeSingle();

  if (error || !customer?.phone) {
    throw new Error("لا يوجد رقم هاتف لهذا الزبون.");
  }

  const phone = toWhatsappPhone(customer.phone);
  if (!isValidWhatsappPhone(phone)) {
    throw new Error("رقم الهاتف غير صالح.");
  }

  return {
    phone,
    customerName: String(customer.name || purchase.customer_name || "").trim()
  };
}
