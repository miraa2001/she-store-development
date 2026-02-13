import { sb } from "./supabaseClient";

const EMAIL_ROLE_FALLBACK = {
  "rahaf@she-store.com": "rahaf",
  "reem@she-store.com": "reem",
  "rawand@she-store.com": "rawand",
  "laaura@she-store.com": "laaura"
};

export async function getCurrentUserProfile() {
  const {
    data: { session }
  } = await sb.auth.getSession();

  if (!session) {
    return { authenticated: false, role: "viewer", user: null, email: "" };
  }

  const {
    data: { user }
  } = await sb.auth.getUser();

  const email = String(user?.email || "").toLowerCase();
  const userId = String(user?.id || "");

  if (!userId) {
    return {
      authenticated: true,
      role: EMAIL_ROLE_FALLBACK[email] || "viewer",
      user,
      email
    };
  }

  const { data, error } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("role read error", error);
  }

  const role = String(data?.role || EMAIL_ROLE_FALLBACK[email] || "viewer").toLowerCase();

  return {
    authenticated: true,
    role,
    user,
    email
  };
}
