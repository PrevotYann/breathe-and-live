/** Accessible navigation layered on Foundry's existing Tabs controller. */
export function activateSheetNavigation(sheet, html) {
  const root = html[0] ?? html;
  const nav = root.querySelector(".sheet-tabs");
  if (!nav) return;
  const tabs = [...nav.querySelectorAll("[data-tab]")];
  const panels = [...root.querySelectorAll(".sheet-body > .tab")];
  nav.setAttribute("role", "tablist");
  const sync = () => {
    const vertical = root.ownerDocument.defaultView.getComputedStyle(nav).flexDirection === "column";
    nav.setAttribute("aria-orientation", vertical ? "vertical" : "horizontal");
    for (const tab of tabs) {
      const active = tab.classList.contains("active");
      const id = `${sheet.appId}-tab-${tab.dataset.tab}`;
      tab.id = id;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(active));
      tab.setAttribute("aria-controls", `${id}-panel`);
      tab.tabIndex = active ? 0 : -1;
      const panel = panels.find(panel => panel.dataset.tab === tab.dataset.tab);
      if (panel) {
        panel.id = `${id}-panel`;
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", id);
        panel.tabIndex = 0;
      }
    }
  };
  const activate = tab => {
    sheet._tabs[0].activate(tab.dataset.tab, { triggerCallback: true });
    sync();
  };
  nav.addEventListener("click", event => {
    const tab = event.target.closest("[data-tab]");
    if (tab) activate(tab);
  });
  nav.addEventListener("keydown", event => {
    const index = tabs.indexOf(event.target.closest("[data-tab]"));
    if (index < 0) return;
    let next;
    if (["ArrowRight", "ArrowDown"].includes(event.key)) next = (index + 1) % tabs.length;
    if (["ArrowLeft", "ArrowUp"].includes(event.key)) next = (index + tabs.length - 1) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (["Enter", " "].includes(event.key)) next = index;
    if (next === undefined) return;
    event.preventDefault();
    activate(tabs[next]);
    tabs[next].focus();
  });
  sync();

  // Keep opened explanations open after Foundry re-renders an edited document.
  sheet._blDisclosures ??= new Map();
  root.querySelectorAll("details").forEach((details, index) => {
    const key = `${details.closest("[data-tab]")?.dataset.tab}:${index}`;
    if (sheet._blDisclosures.has(key)) details.open = sheet._blDisclosures.get(key);
    details.addEventListener("toggle", () => sheet._blDisclosures.set(key, details.open));
  });
  // Existing templates use adjacent labels; associate them without changing data paths.
  root.querySelectorAll("input, select, textarea").forEach((control, index) => {
    control.id ||= `${sheet.appId}-field-${index}`;
    const previous = control.previousElementSibling;
    if (previous?.tagName === "LABEL" && !previous.querySelector("input")) previous.htmlFor = control.id;
    if (control.name === "name") control.setAttribute("aria-label", "Nom");
    if (control.closest(".pair")) {
      const label = control.closest(".pair").previousElementSibling?.textContent?.trim() || "Ressource";
      control.setAttribute("aria-label", `${label} — ${control.name.endsWith(".value") ? "valeur actuelle" : "maximum"}`);
    }
  });
  root.querySelectorAll("a[title]:not([role])").forEach(control => {
    control.setAttribute("role", "button");
    control.setAttribute("aria-label", control.title);
    control.tabIndex = 0;
    control.addEventListener("keydown", event => {
      if (["Enter", " "].includes(event.key)) { event.preventDefault(); control.click(); }
    });
  });
}
