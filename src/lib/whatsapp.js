import { sb } from "./supabaseClient";
import { formatILS } from "./orders";
import { PICKUP_HOME, PICKUP_POINT } from "./pickup";

const EMOJI = {
  sparkleHeart: "\u{1F496}",
  package: "\u{1F4E6}",
  pin: "\u{1F4CD}",
  alarm: "\u23F0",
  kiss: "\u{1F48C}",
  heart: "\u2764\uFE0F"
};

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
  const greeting = name ? `مرحبا ${name}${EMOJI.sparkleHeart}` : `مرحبا حبيبتي${EMOJI.sparkleHeart}`;

  if (pickupPoint === PICKUP_POINT) {
    return [
      greeting,
      "طلبك جاهز بنقطة الاستلام",
      `${EMOJI.pin}كافيه la aura سوق الذهب`,
      `${EMOJI.alarm} بفتحو من ال٨ صباحًا لل١٠ مساءً`,
      `${EMOJI.package} حسابك: ${priceText} شيكل`
    ].join("\n");
  }

  if (pickupPoint === PICKUP_HOME) {
    return [
      greeting,
      "طلبك جاهز عندي بالبيت",
      `خبريني قبل بوقت وينتا رح تستلمي${EMOJI.kiss}`,
      `${EMOJI.package} حسابك: ${priceText} شيكل`
    ].join("\n");
  }

  return [
    greeting,
    `طلبك جاهز للاستلام (${pickupPoint || "—"})`,
    `${EMOJI.package} حسابك: ${priceText} شيكل`
  ].join("\n");
}

export function buildPickupInquiryMessage() {
  return [
    `مرحبا حبيبتي طلبك وصل ${EMOJI.package}`,
    "بتحبي تستلمي من:",
    `${EMOJI.pin}بيتي بالحي الجنوبي`,
    "أو",
    `${EMOJI.pin}نقطة الاستلام كافيه la aura سوق الذهب ؟`,
    `خبريني لو سمحتي${EMOJI.heart}`
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
