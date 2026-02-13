(function(){
  "use strict";

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
    return String(document.body?.dataset?.page || "").toLowerCase();
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

  function ensureCustomersShortcut(content){
    if(!content || pageKey() !== "index") return;

    const links = Array.from(content.querySelectorAll("a"));
    if(!links.length) return;

    const hasCustomers = links.some((link)=>{
      const href = String(link.getAttribute("href") || "").toLowerCase();
      return href.includes("tab=customers") || href.includes("customers");
    });
    if(hasCustomers) return;

    const orderLink = links.find((link)=>{
      const href = String(link.getAttribute("href") || "").toLowerCase();
      return href.includes("index.html") && !href.includes("tab=customers");
    });
    if(!orderLink) return;

    const customers = document.createElement("a");
    customers.href = "./index.html?tab=customers";
    customers.textContent = "العملاء";
    orderLink.insertAdjacentElement("afterend", customers);
  }

  function enhanceCommandHeader(commandBar){
    if(!commandBar || commandBar.dataset.rhEnhanced === "1") return;

    commandBar.classList.add("ss-rh-command");

    const commandLabel = commandBar.querySelector(".commandLabel");
    if(commandLabel) commandLabel.style.display = "none";

    const navTabs = commandBar.querySelector("#navTabs");
    const modeSwitch = commandBar.querySelector("#modeSwitch");
    const menuBtn = commandBar.querySelector("#openSidebarBtn, .menuBtn");
    const searchRow = commandBar.querySelector(".ordersSearchRow, .commandSearchRow") ||
      (document.getElementById("searchInput") ? document.getElementById("searchInput").closest(".row") : null);

    if(navTabs) navTabs.classList.add("ss-rh-tabs");
    if(modeSwitch) modeSwitch.classList.add("ss-rh-mode");
    if(menuBtn) menuBtn.classList.add("ss-rh-menu-btn");

    if(searchRow){
      searchRow.classList.add("ss-rh-search-row");

      let shell = searchRow.querySelector(".ss-rh-search-shell");
      if(!shell){
        shell = document.createElement("div");
        shell.className = "ss-rh-search-shell";

        const inputWrap = document.createElement("div");
        inputWrap.className = "ss-rh-search-input-wrap";

        const icon = document.createElement("span");
        icon.className = "ss-rh-search-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "⌕";

        const input = searchRow.querySelector("#searchInput, .searchBox, input");
        if(input){
          inputWrap.appendChild(icon);
          inputWrap.appendChild(input);
        }

        shell.appendChild(inputWrap);
        searchRow.appendChild(shell);
      }

      const count = document.getElementById("searchCount");
      if(count && count.parentElement !== searchRow){
        searchRow.appendChild(count);
      }
    }

    const row = document.createElement("div");
    row.className = "ss-rh-cmd-row";

    const right = document.createElement("div");
    right.className = "ss-rh-cmd-right";

    const left = document.createElement("div");
    left.className = "ss-rh-cmd-left";

    if(navTabs) right.appendChild(navTabs);
    if(searchRow) right.appendChild(searchRow);
    if(modeSwitch) left.appendChild(modeSwitch);
    if(menuBtn) left.appendChild(menuBtn);

    commandBar.innerHTML = "";
    row.appendChild(right);
    row.appendChild(left);
    commandBar.appendChild(row);

    commandBar.dataset.rhEnhanced = "1";
  }

  function enhanceSimpleHeader(topbar){
    if(!topbar || topbar.dataset.rhEnhanced === "1") return;

    topbar.classList.add("ss-rh-simple");

    const brand = topbar.querySelector(".brand");
    const menuBtn = topbar.querySelector("#openSidebarBtn, .menuBtn");
    if(menuBtn) menuBtn.classList.add("ss-rh-menu-btn");

    const row = document.createElement("div");
    row.className = "ss-rh-simple-row";

    const titleWrap = document.createElement("div");
    titleWrap.className = "ss-rh-simple-title";

    const dot = document.createElement("span");
    dot.className = "ss-rh-simple-dot";

    const textWrap = document.createElement("div");

    let titleNode = null;
    let subtitleNode = null;

    if(brand){
      titleNode = brand.querySelector("b, strong, h1, h2");
      subtitleNode = brand.querySelector(".muted");
    }

    if(!titleNode){
      titleNode = document.createElement("h1");
      titleNode.textContent = document.title || "She-Store";
    }

    titleNode.classList.add("ss-rh-title");
    textWrap.appendChild(titleNode);

    if(subtitleNode){
      subtitleNode.classList.add("ss-rh-subtitle");
      textWrap.appendChild(subtitleNode);
    }

    titleWrap.appendChild(dot);
    titleWrap.appendChild(textWrap);

    topbar.innerHTML = "";
    row.appendChild(titleWrap);
    if(menuBtn) row.appendChild(menuBtn);
    topbar.appendChild(row);

    topbar.dataset.rhEnhanced = "1";
  }

  function enhanceSidebarHeader(sidebar){
    if(!sidebar) return;
    sidebar.classList.add("ss-rh-sidebar");

    const header = sidebar.querySelector(".sidebarHeader");
    if(!header) return;

    const closeBtn = header.querySelector("#closeSidebarBtn, .menuBtn");
    if(closeBtn) closeBtn.classList.add("ss-rh-close-btn");

    const oldTitle = header.querySelector("b");
    const titleText = oldTitle ? String(oldTitle.textContent || "").trim() : "She-Store";

    if(!header.querySelector(".ss-rh-brand")){
      const brand = document.createElement("div");
      brand.className = "ss-rh-brand";

      const badge = document.createElement("span");
      badge.className = "ss-rh-brand-badge";
      badge.textContent = "SS";

      const text = document.createElement("div");
      text.className = "ss-rh-brand-text";

      const h2 = document.createElement("h2");
      h2.className = "ss-rh-brand-title";
      h2.textContent = titleText && titleText !== "القائمة" ? titleText : "She-Store";

      const small = document.createElement("p");
      small.className = "ss-rh-brand-subtitle";
      small.textContent = "Dashboard";

      text.appendChild(h2);
      text.appendChild(small);
      brand.appendChild(badge);
      brand.appendChild(text);

      if(oldTitle) oldTitle.remove();
      header.insertBefore(brand, closeBtn || null);
    }
  }

  function decorateSidebarContent(){
    const content = document.getElementById("sidebarContent");
    if(!content) return;

    ensureCustomersShortcut(content);

    const links = Array.from(content.querySelectorAll("a"));
    links.forEach((link)=>{
      link.classList.add("ss-rh-nav-link");

      let icon = link.querySelector(".ss-rh-nav-icon");
      if(!icon){
        icon = document.createElement("span");
        icon.className = "ss-rh-nav-icon";
        icon.setAttribute("aria-hidden", "true");
      }

      const key = navKeyFromHref(link.getAttribute("href"));
      icon.textContent = NAV_ICONS[key] || "•";

      let label = link.querySelector(".ss-rh-nav-label");
      if(!label){
        label = document.createElement("span");
        label.className = "ss-rh-nav-label";
        label.textContent = (link.textContent || "").trim();
        link.textContent = "";
        link.appendChild(icon);
        link.appendChild(label);
      }else if(icon.parentElement !== link){
        link.prepend(icon);
      }

      link.classList.toggle("is-active", isNavLinkActive(link));
    });

    const logout = content.querySelector("button.danger");
    if(logout){
      logout.classList.add("ss-rh-logout-btn");
      if(!logout.querySelector(".ss-rh-nav-icon")){
        const icon = document.createElement("span");
        icon.className = "ss-rh-nav-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "↩";

        const label = document.createElement("span");
        label.className = "ss-rh-nav-label";
        label.textContent = (logout.textContent || "").trim();

        logout.textContent = "";
        logout.appendChild(icon);
        logout.appendChild(label);
      }
    }
  }

  function enhanceSidebar(){
    const overlay = document.getElementById("sidebarOverlay");
    if(overlay) overlay.classList.add("ss-rh-overlay");

    const openBtn = document.getElementById("openSidebarBtn");
    if(openBtn) openBtn.classList.add("ss-rh-menu-btn");

    const sidebar = document.getElementById("sidebar");
    if(!sidebar) return;

    enhanceSidebarHeader(sidebar);
    decorateSidebarContent();

    const content = document.getElementById("sidebarContent");
    if(content && content.dataset.rhObserved !== "1"){
      const observer = new MutationObserver(()=>{
        decorateSidebarContent();
      });
      observer.observe(content, { childList:true, subtree:false });
      content.dataset.rhObserved = "1";
    }
  }

  function enhanceWorkspaceSidebar(){
    if(pageKey() !== "index") return;

    const ordersGrid = document.getElementById("ordersGrid");
    const viewGrid = document.getElementById("viewGrid");

    if(ordersGrid) ordersGrid.classList.add("ss-rh-workspace");
    if(viewGrid) viewGrid.classList.add("ss-rh-workspace");
  }

  function boot(){
    const commandBar = document.querySelector(".commandBar");
    const topbar = document.querySelector(".topbar");

    if(commandBar) enhanceCommandHeader(commandBar);
    if(topbar) enhanceSimpleHeader(topbar);

    enhanceSidebar();
    enhanceWorkspaceSidebar();

    window.addEventListener("popstate", decorateSidebarContent);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})();
