import { useEffect, useMemo, useState } from "react";
import { getCurrentUserProfile } from "../lib/auth";
import { sb } from "../lib/supabaseClient";
import HomePickupPage from "./HomePickupPage";
import PickupPointPage from "./PickupPointPage";
import CollectionsPage from "./CollectionsPage";
import "./pickup-dashboard-page.css";

const TAB_CONFIG = {
  home: { id: "home", label: "?????? ?????" },
  aura: { id: "aura", label: "La Aura" },
  collections: { id: "collections", label: "????? ???????" }
};

function roleLabel(role) {
  if (role === "rahaf") return "???";
  if (role === "reem") return "???";
  if (role === "rawand") return "????";
  if (role === "laaura") return "????";
  return "??????";
}

function getRoleTabs(role) {
  if (role === "rahaf") return ["home", "aura", "collections"];
  if (role === "reem" || role === "rawand") return ["home"];
  if (role === "laaura") return ["aura"];
  return [];
}

function getRoleSidebarLinks(role) {
  if (role === "rahaf") {
    return [
      { label: "????????", href: "#/orders" },
      { label: "???????? ????????", href: "#/pickup-dashboard" },
      { label: "???????", href: "#/archive" },
      { label: "???????", href: "#/finance" }
    ];
  }
  if (role === "reem" || role === "rawand") {
    return [
      { label: "????????", href: "#/orders" },
      { label: "???????? ????????", href: "#/pickup-dashboard" }
    ];
  }
  return [];
}

export default function PickupDashboardPage() {
  const [profile, setProfile] = useState({
    loading: true,
    authenticated: false,
    role: "viewer",
    email: ""
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [loadedTabs, setLoadedTabs] = useState([]);

  const roleTabs = useMemo(() => getRoleTabs(profile.role), [profile.role]);
  const sidebarLinks = useMemo(() => getRoleSidebarLinks(profile.role), [profile.role]);
  const showSidebar = profile.role !== "laaura";

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const result = await getCurrentUserProfile();
        if (!mounted) return;
        setProfile({
          loading: false,
          authenticated: result.authenticated,
          role: result.role,
          email: result.email
        });
      } catch (error) {
        console.error(error);
        if (!mounted) return;
        setProfile({
          loading: false,
          authenticated: false,
          role: "viewer",
          email: ""
        });
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const firstTab = roleTabs[0];
    if (!firstTab) return;
    setActiveTab((prev) => (roleTabs.includes(prev) ? prev : firstTab));
    setLoadedTabs((prev) => (prev.includes(firstTab) ? prev : [...prev, firstTab]));
  }, [roleTabs]);

  useEffect(() => {
    if (!activeTab) return;
    setLoadedTabs((prev) => (prev.includes(activeTab) ? prev : [...prev, activeTab]));
  }, [activeTab]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  async function signOut() {
    try {
      await sb.auth.signOut();
    } catch (error) {
      console.error(error);
    } finally {
      window.location.hash = "#/login";
    }
  }

  function renderPanel(tabId) {
    if (tabId === "home") return <HomePickupPage embedded />;
    if (tabId === "aura") return <PickupPointPage embedded />;
    if (tabId === "collections") return <CollectionsPage embedded />;
    return null;
  }

  if (profile.loading) {
    return (
      <div className="pickup-page pickup-state">
        <div className="pickup-note">???? ?????? ?? ??????...</div>
      </div>
    );
  }

  if (!profile.authenticated) {
    return (
      <div className="pickup-page pickup-state">
        <div className="pickup-note pickup-note-danger">
          <h2>?? ???? ???? ????</h2>
          <p>???? ????? ?????? ?????.</p>
          <a href="#/login" className="pickup-btn">
            ??? ????? ??????
          </a>
        </div>
      </div>
    );
  }

  if (!roleTabs.length) {
    return (
      <div className="pickup-page pickup-state">
        <div className="pickup-note pickup-note-danger">
          <h2>?? ???? ??????</h2>
          <p>??? ?????? ?? ???? ?????? ???? ???????? ????????.</p>
          <a href="#/orders" className="pickup-btn">
            ?????? ????????
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="pickup-page" dir="rtl">
      {showSidebar ? (
        <>
          <div className={`pickup-sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />
          <aside className={`pickup-sidebar ${sidebarOpen ? "open" : ""}`}>
            <div className="pickup-sidebar-head">
              <b>???????</b>
              <button type="button" className="pickup-btn pickup-btn-icon danger" onClick={() => setSidebarOpen(false)}>
                ?
              </button>
            </div>
            <div className="pickup-sidebar-content">
              {sidebarLinks.map((item) => (
                <a key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}>
                  {item.label}
                </a>
              ))}
              <button type="button" className="danger" onClick={signOut}>
                ????? ????
              </button>
            </div>
          </aside>
        </>
      ) : null}

      <div className="pickup-wrap">
        <div className="pickup-topbar">
          <div className="pickup-brand">
            <b>???????? ????????</b>
            <div className="pickup-muted">
              {profile.role === "laaura" ? "???? La Aura" : "?? ????? + La Aura + ???????"} ? {roleLabel(profile.role)}
            </div>
          </div>
          {showSidebar ? (
            <button type="button" className="pickup-btn pickup-btn-icon" onClick={() => setSidebarOpen(true)}>
              ?
            </button>
          ) : (
            <button type="button" className="pickup-btn danger" onClick={signOut}>
              ????? ????
            </button>
          )}
        </div>

        {roleTabs.length > 1 ? (
          <div className="pickup-tabs">
            {roleTabs.map((tabId) => (
              <button
                key={tabId}
                type="button"
                className={`pickup-tab-btn ${activeTab === tabId ? "active" : ""}`}
                onClick={() => setActiveTab(tabId)}
              >
                {TAB_CONFIG[tabId].label}
              </button>
            ))}
          </div>
        ) : null}

        {roleTabs.map((tabId) => (
          <div key={tabId} className={`pickup-panel ${activeTab === tabId ? "active" : ""}`}>
            {loadedTabs.includes(tabId) ? <div className="pickup-panel-content">{renderPanel(tabId)}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
