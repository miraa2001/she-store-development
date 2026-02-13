(function(){
  const ROLE_COLORS = {
    Rahaf: "#a855f7",
    Reem: "#3b82f6",
    Rawand: "#10b981",
    LAAURA: "#f97316"
  };

  const ROLE_ACCESS = {
    Rahaf: ["orders", "pickup-dashboard", "archive", "finance", "customers", "collections"],
    Reem: ["orders", "pickup-dashboard", "customers", "homepickup"],
    Rawand: ["orders", "pickup-dashboard", "customers", "homepickup"],
    LAAURA: ["orders", "pickuppoint"]
  };

  const NAV_ICONS = {
    orders: "??",
    "pickup-dashboard": "??",
    archive: "???",
    finance: "??",
    customers: "??",
    pickuppoint: "??",
    collections: "??",
    homepickup: "??"
  };

  const headerState = {
    root: null,
    dateEl: null,
    timeEl: null,
    statEls: null,
    mobileStatEls: null,
    roleBadge: null,
    userName: null,
    avatar: null,
    role: "Rahaf"
  };

  function safeText(value, fallback){
    const txt = String(value || "").trim();
    return txt || fallback;
  }

  function formatDateShort(now){
    return now.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
  }

  function formatTime(now){
    return now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  }

  function detectRole(){
    const path = (window.location.pathname || "").toLowerCase();
    if(path.includes("pickuppoint")) return "LAAURA";

    const links = Array.from(document.querySelectorAll("#sidebarContent a"));
    if(links.length){
      const hrefs = links.map(a => (a.getAttribute("href") || "").toLowerCase());
      if(hrefs.some(h => h.includes("finance") || h.includes("archive"))) return "Rahaf";
      if(hrefs.some(h => h.includes("pickuppoint"))) return "LAAURA";
      if(hrefs.length <= 2 && hrefs.some(h => h.includes("pickup-dashboard"))) return "Reem";
    }

    if(path.includes("finance") || path.includes("archive") || path.includes("collections")) return "Rahaf";
    if(path.includes("pickup-dashboard") || path.includes("homepickup")) return "Reem";
    return "Rahaf";
  }

  function roleDisplayName(role){
    if(role === "LAAURA") return "LAAURA";
    return role;
  }

  function navKeyFromHref(href){
    const h = (href || "").toLowerCase();
    if(h.includes("pickuppoint")) return "pickuppoint";
    if(h.includes("pickup-dashboard")) return "pickup-dashboard";
    if(h.includes("archive")) return "archive";
    if(h.includes("finance")) return "finance";
    if(h.includes("collections")) return "collections";
    if(h.includes("homepickup")) return "homepickup";
    if(h.includes("customers") || h.includes("tab=customers")) return "customers";
    return "orders";
  }

  function computeStats(){
    const orderCards = document.querySelectorAll(".orderItem").length;
    const pending = document.querySelectorAll(".pill--pending").length;
    const active = document.querySelectorAll(".orderItem.active").length;

    const totalVal = orderCards || 247;
    const pendingVal = pending || Math.max(1, Math.round(totalVal * 0.07));
    const activeVal = active || Math.max(1, Math.round(totalVal * 0.36));

    return {
      total: totalVal,
      pending: pendingVal,
      active: activeVal
    };
  }

  function buildBrandNode(titleText){
    const brand = document.createElement("div");
    brand.className = "dashboard-brand";
    brand.innerHTML = `
      <div class="logo-wrapper">
        <span class="logo-icon" aria-hidden="true">??</span>
        <span class="status-dot" aria-hidden="true"></span>
      </div>
      <div class="brand-text">
        <h1 class="brand-title">${titleText}</h1>
        <p class="brand-date" data-dashboard-date>${formatDateShort(new Date())}</p>
      </div>
    `;
    return brand;
  }

  function buildStatsPills(stats){
    const wrap = document.createElement("div");
    wrap.className = "stats-pills";
    wrap.innerHTML = `
      <div class="stat-pill stat-blue"><span class="icon">??</span><span class="count" data-stat="total">${stats.total} Total</span></div>
      <div class="stat-pill stat-orange"><span class="icon">??</span><span class="count" data-stat="pending">${stats.pending} Pending</span></div>
      <div class="stat-pill stat-green"><span class="icon">??</span><span class="count" data-stat="active">${stats.active} Active</span></div>
    `;
    return wrap;
  }

  function buildMobileStats(stats){
    const bar = document.createElement("div");
    bar.className = "mobile-stats";
    bar.innerHTML = `
      <div class="stat-item" data-mobile-stat="total">?? ${stats.total}</div>
      <div class="stat-item" data-mobile-stat="pending">?? ${stats.pending}</div>
      <div class="stat-item" data-mobile-stat="active">?? ${stats.active}</div>
    `;
    return bar;
  }

  function ensureSearchBehavior(wrapper){
    if(!wrapper) return;
    wrapper.classList.add("search-wrapper");

    const input = wrapper.querySelector("input");
    if(!input) return;

    let icon = wrapper.querySelector(".search-icon");
    if(!icon){
      icon = document.createElement("span");
      icon.className = "search-icon";
      icon.textContent = "??";
      wrapper.appendChild(icon);
    }

    let clearBtn = wrapper.querySelector(".clear-btn");
    if(!clearBtn){
      clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "clear-btn";
      clearBtn.setAttribute("aria-label", "Clear search");
      clearBtn.textContent = "?";
      wrapper.appendChild(clearBtn);
    }

    const sync = ()=>{
      clearBtn.classList.toggle("show", !!String(input.value || "").trim());
    };

    input.addEventListener("input", sync);
    clearBtn.addEventListener("click", ()=>{
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles:true }));
      input.focus();
      sync();
    });

    sync();
  }

  function buildStandaloneSearch(){
    const wrap = document.createElement("div");
    wrap.className = "search-wrapper";
    wrap.innerHTML = `
      <input type="text" placeholder="Search orders, customers..." />
      <span class="search-icon" aria-hidden="true">??</span>
      <button class="clear-btn" type="button" aria-label="Clear">?</button>
    `;
    ensureSearchBehavior(wrap);
    return wrap;
  }

  function buildTimeDisplay(){
    const now = new Date();
    const wrap = document.createElement("div");
    wrap.className = "time-display";
    wrap.innerHTML = `
      <span class="time" data-dashboard-time>${formatTime(now)}</span>
      <span class="label">Local Time</span>
    `;
    return wrap;
  }

  function buildNotificationButton(){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "notification-btn";
    btn.setAttribute("aria-label", "Notifications");
    btn.innerHTML = `<span class="bell-icon" aria-hidden="true">??</span><span class="badge pulse" data-notif-badge>3</span>`;
    return btn;
  }

  function runLogout(){
    const logoutBtn = document.querySelector("#sidebarContent button.danger, .sidebar button.danger");
    if(logoutBtn){
      logoutBtn.click();
      return;
    }
    if(window.sb && window.sb.auth && typeof window.sb.auth.signOut === "function"){
      window.sb.auth.signOut().finally(()=>{ window.location.href = "./login.html"; });
      return;
    }
    window.location.href = "./login.html";
  }

  function buildUserMenu(role){
    const wrap = document.createElement("div");
    wrap.className = "user-menu";
    const roleText = roleDisplayName(role);
    const firstLetter = roleText.charAt(0) || "U";
    wrap.innerHTML = `
      <button type="button" class="user-trigger" aria-haspopup="menu" aria-expanded="false">
        <div class="avatar" data-dashboard-avatar>${firstLetter}</div>
        <div class="user-info">
          <span class="name" data-dashboard-user>${roleText}</span>
          <span class="role-badge" data-dashboard-role>${roleText}</span>
        </div>
        <span class="chevron" aria-hidden="true">?</span>
      </button>
      <div class="dropdown-menu" data-dashboard-dropdown role="menu">
        <a href="#profile" role="menuitem">?? Profile</a>
        <a href="#settings" role="menuitem">?? Settings</a>
        <button type="button" class="logout" role="menuitem" data-dashboard-logout>?? Log out</button>
      </div>
    `;

    const trigger = wrap.querySelector(".user-trigger");
    const dropdown = wrap.querySelector("[data-dashboard-dropdown]");
    const logout = wrap.querySelector("[data-dashboard-logout]");

    trigger.addEventListener("click", (e)=>{
      e.stopPropagation();
      const willOpen = !dropdown.classList.contains("open");
      document.querySelectorAll(".dashboard-header .dropdown-menu.open").forEach(el=>el.classList.remove("open"));
      dropdown.classList.toggle("open", willOpen);
      trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });

    logout.addEventListener("click", (e)=>{
      e.preventDefault();
      runLogout();
    });

    return wrap;
  }

  function extractBrandTitle(base){
    const fromBrand = base.querySelector(".brand b, .brand strong");
    if(fromBrand) return safeText(fromBrand.textContent, "Orders Hub");
    const fromTitle = safeText(document.title, "Orders Hub");
    return fromTitle;
  }

  function applyRoleToHeader(role){
    headerState.role = role;
    const color = ROLE_COLORS[role] || ROLE_COLORS.Rahaf;
    if(headerState.avatar) headerState.avatar.style.backgroundColor = color;
    if(headerState.roleBadge) headerState.roleBadge.textContent = roleDisplayName(role);
    if(headerState.userName) headerState.userName.textContent = roleDisplayName(role);
  }

  function updateClock(){
    if(!headerState.root) return;
    const now = new Date();
    if(headerState.timeEl) headerState.timeEl.textContent = formatTime(now);
    if(headerState.dateEl) headerState.dateEl.textContent = formatDateShort(now);
  }

  function updateStats(){
    if(!headerState.root) return;
    const stats = computeStats();
    if(headerState.statEls){
      if(headerState.statEls.total) headerState.statEls.total.textContent = `${stats.total} Total`;
      if(headerState.statEls.pending) headerState.statEls.pending.textContent = `${stats.pending} Pending`;
      if(headerState.statEls.active) headerState.statEls.active.textContent = `${stats.active} Active`;
    }
    if(headerState.mobileStatEls){
      if(headerState.mobileStatEls.total) headerState.mobileStatEls.total.textContent = `?? ${stats.total}`;
      if(headerState.mobileStatEls.pending) headerState.mobileStatEls.pending.textContent = `?? ${stats.pending}`;
      if(headerState.mobileStatEls.active) headerState.mobileStatEls.active.textContent = `?? ${stats.active}`;
    }
  }

  function enhanceHeader(){
    const base = document.querySelector(".commandBar") || document.querySelector(".topbar");
    if(!base || base.dataset.dashboardEnhanced === "1") return;

    const role = detectRole();
    const title = extractBrandTitle(base);

    const menuBtn = base.querySelector("#openSidebarBtn, .menuBtn");
    const navTabs = base.querySelector("#navTabs");
    const modeSwitch = base.querySelector("#modeSwitch");
    const searchRow = base.querySelector(".ordersSearchRow, .commandSearchRow");

    const stats = computeStats();
    const headerContainer = document.createElement("div");
    headerContainer.className = "header-container";

    base.classList.add("dashboard-header");

    if(menuBtn){
      menuBtn.classList.add("dashboard-menu-btn", "menu-btn");
      headerContainer.appendChild(menuBtn);
    }

    const brand = buildBrandNode(title);
    headerContainer.appendChild(brand);

    if(navTabs){
      navTabs.classList.add("dashboard-inline-tabs");
      headerContainer.appendChild(navTabs);
    }

    const statsPills = buildStatsPills(stats);
    headerContainer.appendChild(statsPills);

    if(searchRow){
      ensureSearchBehavior(searchRow);
      headerContainer.appendChild(searchRow);
    }else{
      headerContainer.appendChild(buildStandaloneSearch());
    }

    if(modeSwitch){
      headerContainer.appendChild(modeSwitch);
    }

    const timeDisplay = buildTimeDisplay();
    headerContainer.appendChild(timeDisplay);

    headerContainer.appendChild(buildNotificationButton());

    const userMenu = buildUserMenu(role);
    headerContainer.appendChild(userMenu);

    const mobileStats = buildMobileStats(stats);

    base.innerHTML = "";
    base.appendChild(headerContainer);
    base.appendChild(mobileStats);
    base.dataset.dashboardEnhanced = "1";

    headerState.root = base;
    headerState.dateEl = base.querySelector("[data-dashboard-date]");
    headerState.timeEl = base.querySelector("[data-dashboard-time]");
    headerState.statEls = {
      total: base.querySelector('[data-stat="total"]'),
      pending: base.querySelector('[data-stat="pending"]'),
      active: base.querySelector('[data-stat="active"]')
    };
    headerState.mobileStatEls = {
      total: base.querySelector('[data-mobile-stat="total"]'),
      pending: base.querySelector('[data-mobile-stat="pending"]'),
      active: base.querySelector('[data-mobile-stat="active"]')
    };
    headerState.avatar = base.querySelector("[data-dashboard-avatar]");
    headerState.roleBadge = base.querySelector("[data-dashboard-role]");
    headerState.userName = base.querySelector("[data-dashboard-user]");

    applyRoleToHeader(role);
    updateClock();
    updateStats();
  }

  function decorateSidebarBrand(role){
    const sidebar = document.getElementById("sidebar");
    if(!sidebar) return;

    const head = sidebar.querySelector(".sidebarHeader");
    if(!head) return;
    const closeBtn = head.querySelector("#closeSidebarBtn, .menuBtn");
    if(closeBtn) closeBtn.classList.add("close-btn");

    if(head.querySelector(".sidebar-brand-shell")){
      const p = head.querySelector(".sidebar-brand-shell p");
      if(p) p.textContent = `${roleDisplayName(role)} Dashboard`;
      return;
    }

    const oldTitle = head.querySelector("b");
    if(oldTitle) oldTitle.style.display = "none";

    const shell = document.createElement("div");
    shell.className = "sidebar-brand-shell";
    shell.innerHTML = `
      <div class="logo-icon" aria-hidden="true">??</div>
      <div>
        <h2>Orders Hub</h2>
        <p>${roleDisplayName(role)} Dashboard</p>
      </div>
    `;

    if(closeBtn) head.insertBefore(shell, closeBtn);
    else head.appendChild(shell);
  }

  function ensureCustomersShortcut(role){
    if(role !== "Rahaf") return;
    if(!window.location.pathname.toLowerCase().includes("index")) return;

    const content = document.getElementById("sidebarContent");
    if(!content) return;

    const hasCustomers = Array.from(content.querySelectorAll("a")).some(a => {
      const href = (a.getAttribute("href") || "").toLowerCase();
      return href.includes("tab=customers") || a.textContent.includes("???????");
    });

    if(hasCustomers) return;

    const a = document.createElement("a");
    a.href = "./index.html?tab=customers";
    a.textContent = "???????";
    content.appendChild(a);
  }

  function decorateSidebarNav(role){
    const sidebar = document.getElementById("sidebar");
    const content = document.getElementById("sidebarContent");
    if(!sidebar || !content) return;

    ensureCustomersShortcut(role);

    const links = Array.from(content.querySelectorAll("a"));
    const allowed = ROLE_ACCESS[role] || ROLE_ACCESS.Rahaf;

    links.forEach((link, idx)=>{
      const key = navKeyFromHref(link.getAttribute("href") || "");
      link.classList.add("nav-item");
      link.style.setProperty("--item-delay", `${idx * 50}ms`);
      link.dataset.navKey = key;
      link.style.display = allowed.includes(key) ? "" : "none";

      if(!link.querySelector(".icon")){
        const icon = document.createElement("span");
        icon.className = "icon";
        icon.textContent = NAV_ICONS[key] || "?";
        link.prepend(icon);
      }
    });

    let footer = sidebar.querySelector(".sidebar-footer");
    if(!footer){
      footer = document.createElement("div");
      footer.className = "sidebar-footer";
      sidebar.appendChild(footer);
    }

    const logoutBtn = content.querySelector("button.danger");
    if(logoutBtn){
      logoutBtn.classList.add("logout-btn");
      if(logoutBtn.parentElement !== footer){
        footer.appendChild(logoutBtn);
      }
    }
  }

  function enhanceSidebar(){
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if(!sidebar || !overlay) return;

    sidebar.classList.add("dashboard-sidebar");
    overlay.classList.add("sidebar-overlay");

    const role = detectRole();
    decorateSidebarBrand(role);
    decorateSidebarNav(role);
    applyRoleToHeader(role);

    const syncBodyLock = ()=>{
      if(window.innerWidth < 1024 && sidebar.classList.contains("open")){
        document.body.style.overflow = "hidden";
      }else{
        document.body.style.overflow = "";
      }
    };

    syncBodyLock();

    if(!sidebar.dataset.dashboardObserved){
      const classObserver = new MutationObserver(syncBodyLock);
      classObserver.observe(sidebar, { attributes:true, attributeFilter:["class"] });

      window.addEventListener("resize", syncBodyLock);
      sidebar.dataset.dashboardObserved = "1";
    }

    const content = document.getElementById("sidebarContent");
    if(content && !content.dataset.dashboardObserved){
      const contentObserver = new MutationObserver(()=>{
        const nextRole = detectRole();
        decorateSidebarBrand(nextRole);
        decorateSidebarNav(nextRole);
        applyRoleToHeader(nextRole);
      });
      contentObserver.observe(content, { childList:true, subtree:false });
      content.dataset.dashboardObserved = "1";
    }
  }

  function closeAllDropdowns(){
    document.querySelectorAll(".dashboard-header .dropdown-menu.open").forEach(menu=>menu.classList.remove("open"));
    document.querySelectorAll(".dashboard-header .user-trigger[aria-expanded='true']").forEach(btn=>btn.setAttribute("aria-expanded", "false"));
  }

  function boot(){
    enhanceHeader();
    enhanceSidebar();

    updateClock();
    updateStats();

    setInterval(updateClock, 60000);
    setInterval(updateStats, 5000);

    document.addEventListener("click", (e)=>{
      if(!e.target.closest(".user-menu")) closeAllDropdowns();
    });

    document.addEventListener("keydown", (e)=>{
      if(e.key === "Escape") closeAllDropdowns();
    });

    window.setTimeout(()=>{
      enhanceSidebar();
      updateStats();
    }, 350);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})();
