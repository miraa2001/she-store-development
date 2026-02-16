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
          <div className="inputContainer">
            <input
              required
              id="login-username"
              className="inputField"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="اسم المستخدم"
              type="text"
              autoComplete="username"
              disabled={submitting}
              dir="rtl"
            />
            <label className="floatingLabel" htmlFor="login-username">
              اسم المستخدم
            </label>
            <svg viewBox="0 0 448 512" className="fieldIcon" aria-hidden="true">
              <path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z" />
            </svg>
          </div>

          <div className="inputContainer">
            <input
              required
              id="login-password"
              className="inputField"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="كلمة المرور"
              type="password"
              autoComplete="current-password"
              disabled={submitting}
              dir="rtl"
            />
            <label className="floatingLabel" htmlFor="login-password">
              كلمة المرور
            </label>
            <svg viewBox="0 0 448 512" className="fieldIcon" aria-hidden="true">
              <path d="M400 224h-24v-72C376 68.2 307.8 0 224 0S72 68.2 72 152v72H48c-26.5 0-48 21.5-48 48v192c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V272c0-26.5-21.5-48-48-48zM120 152c0-57.3 46.7-104 104-104s104 46.7 104 104v72H120v-72zm152 170.7V376c0 13.3-10.7 24-24 24s-24-10.7-24-24v-53.3c-14.2-8.3-24-23.8-24-41.7 0-26.5 21.5-48 48-48s48 21.5 48 48c0 17.9-9.8 33.4-24 41.7z" />
            </svg>
          </div>
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
