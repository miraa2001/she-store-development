(function(){
  "use strict";

  const PAGE_LABELS = {
    index: "لوحة الطلبات",
    archive: "الأرشيف",
    collections: "المجموعات",
    finance: "المالية",
    "pickup-dashboard": "لوحة الاستلام",
    pickuppoint: "نقطة الاستلام",
    homepickup: "استلام المنزل"
  };

  const NAV_ICONS = {
    orders: "📦",
    "pickup-dashboard": "📍",
    pickuppoint: "🏠",
    archive: "🗂️",
    finance: "💳",
    customers: "👥",
    collections: "🛍️",
    homepickup: "🚚"
  };

  function pageKey(){
    return (document.body?.dataset?.page || "").toLowerCase();
  }

  function pageLabel(){
    const key = pageKey();
    return PAGE_LABELS[key] || (document.title || "She-Store").replace(/\s*[-|].*$/, "");
  }

  function enhanceSearchRow(row){
    if(!row || row.dataset.shellReady === "1") return;
    row.classList.add("ss-shell-search");

    const input = row.querySelector("#searchInput, input");
    if(input){
      input.classList.add("ss-shell-search-input");
      input.setAttribute("autocomplete", "off");
    }

    if(!row.querySelector(".ss-shell-search-icon")){
      const icon = document.createElement("span");
      icon.className = "ss-shell-search-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "⌕";
      row.insertBefore(icon, row.firstChild);
    }

    row.dataset.shellReady = "1";
  }

  function enhanceCommandBar(commandBar){
    if(!commandBar || commandBar.dataset.shellEnhanced === "1") return;

    commandBar.classList.add("ss-shell-header", "ss-shell-header--command");

    const commandLabel = commandBar.querySelector(".commandLabel");
    if(commandLabel){
      commandLabel.classList.add("ss-shell-command-label");
      if(!String(commandLabel.textContent || "").trim()){
        commandLabel.textContent = pageLabel();
      }
    }

    const menuBtn = commandBar.querySelector("#openSidebarBtn, .menuBtn");
    if(menuBtn) menuBtn.classList.add("ss-shell-menu-btn");

    const tabs = commandBar.querySelector("#navTabs");
    if(tabs) tabs.classList.add("ss-shell-tabs");

    const modeSwitch = commandBar.querySelector("#modeSwitch");
    if(modeSwitch) modeSwitch.classList.add("ss-shell-mode");

    const searchRow = commandBar.querySelector(".ordersSearchRow, .commandSearchRow") ||
      (document.getElementById("searchInput") ? document.getElementById("searchInput").closest(".row") : null);
    enhanceSearchRow(searchRow);

    commandBar.dataset.shellEnhanced = "1";
  }

  function enhanceTopBar(topbar){
    if(!topbar || topbar.dataset.shellEnhanced === "1") return;

    topbar.classList.add("ss-shell-header", "ss-shell-header--simple");

    const menuBtn = topbar.querySelector("#openSidebarBtn, .menuBtn");
    if(menuBtn) menuBtn.classList.add("ss-shell-menu-btn");

    const brand = topbar.querySelector(".brand");
    if(brand){
      brand.classList.add("ss-shell-brand");

      const title = brand.querySelector("b, strong, h1, h2");
      if(title) title.classList.add("ss-shell-brand-title");

      const subtitle = brand.querySelector(".muted");
      if(subtitle) subtitle.classList.add("ss-shell-brand-subtitle");
    }

    topbar.dataset.shellEnhanced = "1";
  }

  function navKeyFromHref(href){
    const value = String(href || "").toLowerCase();
    if(value.includes("tab=customers")) return "customers";
    if(value.includes("pickup-dashboard")) return "pickup-dashboard";
    if(value.includes("pickuppoint")) return "pickuppoint";
    if(value.includes("archive")) return "archive";
    if(value.includes("finance")) return "finance";
    if(value.includes("collections")) return "collections";
    if(value.includes("homepickup")) return "homepickup";
    return "orders";
  }

  function ensureCustomersShortcut(content){
    if(!content) return;

    const links = Array.from(content.querySelectorAll("a"));
    if(!links.length) return;

    const hasCustomers = links.some((link)=>{
      const href = String(link.getAttribute("href") || "").toLowerCase();
      return href.includes("tab=customers") || href.includes("customers");
    });
    if(hasCustomers) return;

    const hasOrders = links.some((link)=>{
      const href = String(link.getAttribute("href") || "").toLowerCase();
      return href.includes("index.html");
    });
    if(!hasOrders) return;

    const customersLink = document.createElement("a");
    customersLink.href = "./index.html?tab=customers";
    customersLink.textContent = "العملاء";

    const orderLink = links.find((link)=>{
      const href = String(link.getAttribute("href") || "").toLowerCase();
      return href.includes("index.html") && !href.includes("tab=customers");
    });

    if(orderLink && orderLink.parentNode){
      orderLink.insertAdjacentElement("afterend", customersLink);
    }else{
      content.appendChild(customersLink);
    }
  }

  function normalizePath(inputPath){
    return String(inputPath || "").replace(/\/+$/, "").toLowerCase();
  }

  function isCustomersTabActive(){
    const current = normalizePath(window.location.pathname || "");
    const params = new URLSearchParams(window.location.search || "");
    return current.endsWith("/index.html") && params.get("tab") === "customers";
  }

  function isNavLinkActive(link){
    const href = link.getAttribute("href");
    if(!href) return false;

    let url;
    try{
      url = new URL(href, window.location.href);
    }catch(_err){
      return false;
    }

    const linkKey = navKeyFromHref(href);
    if(linkKey === "customers") return isCustomersTabActive();

    const currentPath = normalizePath(window.location.pathname);
    const linkPath = normalizePath(url.pathname);

    return currentPath === linkPath;
  }

  function decorateSidebarHeader(sidebar){
    if(!sidebar) return;

    sidebar.classList.add("ss-shell-sidebar");

    const header = sidebar.querySelector(".sidebarHeader");
    if(!header) return;

    header.classList.add("ss-shell-sidebar-header");

    const closeBtn = header.querySelector("#closeSidebarBtn, .menuBtn");
    if(closeBtn) closeBtn.classList.add("ss-shell-sidebar-close");

    const title = header.querySelector("b");
    if(!title) return;

    const titleText = String(title.textContent || "").trim();
    if(!titleText || titleText === "القائمة"){
      title.textContent = "She-Store";
    }

    if(!header.querySelector(".ss-shell-sidebar-brand")){
      const brand = document.createElement("div");
      brand.className = "ss-shell-sidebar-brand";

      const subtitle = document.createElement("small");
      subtitle.className = "ss-shell-sidebar-subtitle";
      subtitle.textContent = "لوحة التحكم";

      const parent = title.parentNode;
      if(parent){
        parent.insertBefore(brand, title);
        brand.appendChild(title);
        brand.appendChild(subtitle);
      }
    }
  }

  function decorateSidebarContent(){
    const content = document.getElementById("sidebarContent");
    if(!content) return;

    ensureCustomersShortcut(content);

    const links = Array.from(content.querySelectorAll("a"));
    links.forEach((link)=>{
      link.classList.add("ss-nav-link");

      if(!link.querySelector(".ss-nav-icon")){
        const key = navKeyFromHref(link.getAttribute("href"));
        const icon = document.createElement("span");
        icon.className = "ss-nav-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = NAV_ICONS[key] || "•";
        link.insertBefore(icon, link.firstChild);
      }

      link.classList.toggle("is-active", isNavLinkActive(link));
    });

    const logoutBtn = content.querySelector("button.danger");
    if(logoutBtn){
      logoutBtn.classList.add("ss-logout-btn");

      if(!logoutBtn.querySelector(".ss-nav-icon")){
        const icon = document.createElement("span");
        icon.className = "ss-nav-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "↩";
        logoutBtn.insertBefore(icon, logoutBtn.firstChild);
      }
    }
  }

  function enhanceSidebarShell(){
    const overlay = document.getElementById("sidebarOverlay");
    const sidebar = document.getElementById("sidebar");
    const openBtn = document.getElementById("openSidebarBtn");

    if(overlay) overlay.classList.add("ss-shell-overlay");
    if(openBtn) openBtn.classList.add("ss-shell-menu-btn");

    decorateSidebarHeader(sidebar);
    decorateSidebarContent();

    const content = document.getElementById("sidebarContent");
    if(content && content.dataset.shellObserved !== "1"){
      const observer = new MutationObserver(()=>{
        decorateSidebarContent();
      });
      observer.observe(content, { childList: true, subtree: false });
      content.dataset.shellObserved = "1";
    }
  }

  function enhanceIndexWorkspace(){
    if(pageKey() !== "index") return;

    const ordersGrid = document.getElementById("ordersGrid");
    if(ordersGrid) ordersGrid.classList.add("ss-workspace-grid");

    const viewGrid = document.getElementById("viewGrid");
    if(viewGrid) viewGrid.classList.add("ss-workspace-grid");
  }

  function boot(){
    const commandBar = document.querySelector(".commandBar");
    const topbar = document.querySelector(".topbar");

    if(commandBar) enhanceCommandBar(commandBar);
    if(topbar) enhanceTopBar(topbar);

    enhanceSidebarShell();
    enhanceIndexWorkspace();

    window.addEventListener("popstate", decorateSidebarContent);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})();
