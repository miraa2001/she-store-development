import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { sb } from "../lib/supabaseClient";
import SessionLoader from "../components/common/SessionLoader";
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

function PackageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.5 9.4 7.55 4.24" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3 3 18 18" />
        <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
        <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-4.04 5.01" />
        <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [checkingSession, setCheckingSession] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="login-page" dir="rtl">
      <form className="login-glass-card" onSubmit={onSubmit} noValidate>
        <div className="login-logo" aria-hidden="true">
          <PackageIcon />
        </div>

        <h1 className="login-title">تسجيل الدخول</h1>
        <p className="login-subtitle">She Store Dashboard</p>

        <div className="login-field">
          <label className="login-field-label" htmlFor="login-username">
            اسم المستخدم
          </label>
          <input
            id="login-username"
            className="login-input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="اسم المستخدم"
            autoComplete="username"
            disabled={submitting}
            dir="rtl"
          />
        </div>

        <div className="login-field">
          <label className="login-field-label" htmlFor="login-password">
            كلمة المرور
          </label>
          <div className="login-password-wrap">
            <input
              id="login-password"
              className="login-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="كلمة المرور"
              autoComplete="current-password"
              disabled={submitting}
              dir="rtl"
            />
            <button
              type="button"
              className="login-eye-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={submitting}
              aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>

        <button type="submit" className="login-btn" disabled={submitting}>
          {submitting ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
        </button>

        <p className={`login-error ${error ? "visible" : ""}`} role="alert" aria-live="polite">
          {error}
        </p>
      </form>
    </div>
  );
}
