import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import SessionLoader from "../components/common/SessionLoader";
import { sb } from "../lib/supabaseClient";

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
      <StyledWrapper>
        <div className="loaderWrap" dir="rtl">
          <SessionLoader />
        </div>
      </StyledWrapper>
    );
  }

  return (
    <StyledWrapper>
      <form className="form" onSubmit={onSubmit} noValidate dir="rtl">
        <p id="heading">Login</p>

        <div className="field">
          <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width={16} height={16} fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M13.106 7.222c0-2.967-2.249-5.032-5.482-5.032-3.35 0-5.646 2.318-5.646 5.702 0 3.493 2.235 5.708 5.762 5.708.862 0 1.689-.123 2.304-.335v-.862c-.43.199-1.354.328-2.29.328-2.926 0-4.813-1.88-4.813-4.798 0-2.844 1.921-4.881 4.594-4.881 2.735 0 4.608 1.688 4.608 4.156 0 1.682-.554 2.769-1.416 2.769-.492 0-.772-.28-.772-.76V5.206H8.923v.834h-.11c-.266-.595-.881-.964-1.6-.964-1.4 0-2.378 1.162-2.378 2.823 0 1.737.957 2.906 2.379 2.906.8 0 1.415-.39 1.709-1.087h.11c.081.67.703 1.148 1.503 1.148 1.572 0 2.57-1.415 2.57-3.643zm-7.177.704c0-1.197.54-1.907 1.456-1.907.93 0 1.524.738 1.524 1.907S8.308 9.84 7.371 9.84c-.895 0-1.442-.725-1.442-1.914z" />
          </svg>
          <input
            autoComplete="username"
            placeholder="Username"
            className="input-field"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="field">
          <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width={16} height={16} fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
          </svg>
          <input
            placeholder="Password"
            className="input-field"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="btn">
          <button className="button1" type="submit" disabled={submitting}>
            {submitting ? "Logging in..." : "Login"}
          </button>
          <button className="button2" type="button" aria-disabled="true">
            Sign Up
          </button>
        </div>

        <button className="button3" type="button" aria-disabled="true">
          Forgot Password
        </button>

        <p className={`error ${error ? "visible" : ""}`} role="alert" aria-live="polite">
          {error}
        </p>
      </form>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #121212;

  .loaderWrap {
    min-height: 100dvh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(420px, 100%);
    padding-left: 2em;
    padding-right: 2em;
    padding-bottom: 0.4em;
    background-color: #171717;
    border-radius: 25px;
    transition: 0.4s ease-in-out;
  }

  .form:hover {
    transform: scale(1.05);
    border: 1px solid black;
  }

  #heading {
    text-align: center;
    margin: 2em;
    color: rgb(255, 255, 255);
    font-size: 1.2em;
  }

  .field {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    border-radius: 25px;
    padding: 0.6em;
    border: none;
    outline: none;
    color: white;
    background-color: #171717;
    box-shadow: inset 2px 5px 10px rgb(5, 5, 5);
  }

  .input-icon {
    height: 1.3em;
    width: 1.3em;
    fill: white;
  }

  .input-field {
    background: none;
    border: none;
    outline: none;
    width: 100%;
    color: #d3d3d3;
  }

  .form .btn {
    display: flex;
    justify-content: center;
    flex-direction: row;
    margin-top: 2.5em;
  }

  .button1 {
    padding: 0.5em 1.1em;
    border-radius: 5px;
    margin-right: 0.5em;
    border: none;
    outline: none;
    transition: 0.4s ease-in-out;
    background-color: #252525;
    color: white;
    cursor: pointer;
  }

  .button1:hover {
    background-color: black;
    color: white;
  }

  .button1:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .button2 {
    padding: 0.5em 2.3em;
    border-radius: 5px;
    border: none;
    outline: none;
    transition: 0.4s ease-in-out;
    background-color: #252525;
    color: white;
    cursor: pointer;
  }

  .button2:hover {
    background-color: black;
    color: white;
  }

  .button3 {
    margin-bottom: 1em;
    padding: 0.5em;
    border-radius: 5px;
    border: none;
    outline: none;
    transition: 0.4s ease-in-out;
    background-color: #252525;
    color: white;
    cursor: pointer;
  }

  .button3:hover {
    background-color: red;
    color: white;
  }

  .error {
    margin: 0 0 1.5em;
    min-height: 20px;
    text-align: center;
    color: #ff9b9b;
    font-size: 0.9em;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .error.visible {
    opacity: 1;
  }
`;
