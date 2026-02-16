import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SessionLoader from "../components/common/SessionLoader";
import MinimalInput from "../components/common/MinimalInput";
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

  if (target.startsWith("#/")) target = target.slice(1);

  if (!target.startsWith("/")) {
    const filePart = target.split(/[?#]/)[0].split("/").pop()?.toLowerCase();
    if (filePart && LEGACY_ROUTE_MAP[filePart]) return LEGACY_ROUTE_MAP[filePart];
    return fallback;
  }

  if (target.startsWith("/legacy/")) return target;

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
      } catch (sessionError) {
        console.error(sessionError);
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
      setError("يرجى إدخال اسم المستخدم وكلمة المرور.");
      return;
    }

    const email = usernameToEmail(username);
    setSubmitting(true);

    const { error: loginError } = await sb.auth.signInWithPassword({ email, password });
    if (loginError) {
      setError(`فشل تسجيل الدخول: ${loginError.message}`);
      setSubmitting(false);
      return;
    }

    navigate(nextRoute, { replace: true });
  }

  if (checkingSession) {
    return (
      <div className="login-page login-state" dir="rtl">
        <SessionLoader />
      </div>
    );
  }

  return (
    <main className="login-page" dir="rtl">
      <form className="login-form" onSubmit={onSubmit} noValidate>
        <h1 className="login-brand" dir="ltr">
          She Store
        </h1>

        <div className="login-accent" aria-hidden="true" />

        <div className="login-fields">
          <MinimalInput
            type="text"
            placeholder="اسم المستخدم"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            name="username"
            autoComplete="username"
            disabled={submitting}
            dir="rtl"
          />

          <MinimalInput
            type="password"
            placeholder="كلمة المرور"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            name="password"
            autoComplete="current-password"
            disabled={submitting}
            dir="rtl"
          />
        </div>

        <button type="submit" className="login-btn" disabled={submitting}>
          {submitting ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
        </button>

        <p className={`login-error ${error ? "visible" : ""}`} role="alert" aria-live="polite">
          {error}
        </p>
      </form>
    </main>
  );
}