import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { sb } from "../lib/supabaseClient";
import "./login-page.css";

const EMAIL_DOMAIN = "she-store.com";

const LEGACY_ROUTE_MAP = {
  "index.html": "/orders",
  "pickup-dashboard.html": "/pickup-dashboard",
  "pickuppoint.html": "/pickuppoint",
  "archive.html": "/archive",
  "finance.html": "/finance",
  "collections.html": "/collections",
  "homepickup.html": "/homepickup",
  "login.html": "/login",
  "home.html": "/legacy/home"
};

function usernameToEmail(username) {
  const value = String(username || "").trim().toLowerCase();
  if (value.includes("@")) return value;
  const safe = value.replace(/[^a-z0-9._-]/g, "");
  return `${safe}@${EMAIL_DOMAIN}`;
}

function normalizeNextRoute(rawNext) {
  const fallback = "/orders";
  if (!rawNext) return fallback;

  let target = String(rawNext).trim();
  if (!target) return fallback;

  if (target.startsWith("#/")) {
    target = target.slice(1);
  }

  if (!target.startsWith("/")) {
    const filePart = target.split(/[?#]/)[0].split("/").pop()?.toLowerCase();
    if (filePart && LEGACY_ROUTE_MAP[filePart]) {
      return LEGACY_ROUTE_MAP[filePart];
    }
    return fallback;
  }

  if (target.startsWith("/legacy/")) {
    return target;
  }

  const allowedRoutes = [
    "/",
    "/orders",
    "/pickup-dashboard",
    "/pickuppoint",
    "/archive",
    "/finance",
    "/collections",
    "/homepickup",
    "/login"
  ];

  if (allowedRoutes.some((route) => target === route || target.startsWith(`${route}?`))) {
    return target;
  }

  return fallback;
}

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const nextRoute = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    return normalizeNextRoute(params.get("next"));
  }, [location.search]);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const {
          data: { session }
        } = await sb.auth.getSession();

        if (!mounted) return;
        if (session) {
          navigate(nextRoute, { replace: true });
          return;
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setCheckingSession(false);
      }
    }

    checkSession();
    return () => {
      mounted = false;
    };
  }, [navigate, nextRoute]);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("اكتبي اسم المستخدم وكلمة المرور.");
      return;
    }

    const email = usernameToEmail(username);
    setSubmitting(true);

    const { error: loginError } = await sb.auth.signInWithPassword({ email, password });
    if (loginError) {
      setError(`فشل الدخول: ${loginError.message}`);
      setSubmitting(false);
      return;
    }

    navigate(nextRoute, { replace: true });
  }

  if (checkingSession) {
    return (
      <div className="login-page login-state" dir="rtl">
        <div className="login-card">
          <div className="login-title">جاري التحقق من الجلسة...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page" dir="rtl">
      <form className="login-card" onSubmit={onSubmit}>
        <img src="legacy/assets/woman.png" alt="She Store" className="login-hero" />
        <div className="login-title">تسجيل الدخول</div>
        <div className="login-muted">
          اكتبي اسم المستخدم وكلمة المرور. (مثل: <b>rahaf</b> أو <b>reem</b> أو <b>rawand</b>)
        </div>

        <label className="login-label" htmlFor="login-username">
          اسم المستخدم
        </label>
        <input
          id="login-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="اسم المستخدم"
          autoComplete="username"
          disabled={submitting}
        />

        <label className="login-label" htmlFor="login-password">
          كلمة المرور
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="كلمة المرور"
          autoComplete="current-password"
          disabled={submitting}
        />

        <button type="submit" className="login-btn" disabled={submitting}>
          {submitting ? "جاري الدخول..." : "دخول"}
        </button>

        {error ? <div className="login-error">{error}</div> : null}
      </form>
    </div>
  );
}
