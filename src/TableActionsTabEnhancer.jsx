import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function findSidebarTargets() {
  const sidebar = document.querySelector(".score-chat-sidebar");
  const tabs = sidebar?.querySelector(".sidebar-tabs") || null;
  return { sidebar, tabs };
}

export default function TableActionsTabEnhancer() {
  const [sidebarTarget, setSidebarTarget] = useState(null);
  const [tabsTarget, setTabsTarget] = useState(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const scan = () => {
      const { sidebar, tabs } = findSidebarTargets();
      setSidebarTarget(sidebar);
      setTabsTarget(tabs);
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!sidebarTarget || !tabsTarget) return undefined;

    sidebarTarget.classList.toggle("table-actions-tab-open", active);
    const appTabs = [...tabsTarget.querySelectorAll("button:not(.table-actions-tab-button)")];
    const closeActions = () => setActive(false);
    appTabs.forEach((button) => button.addEventListener("click", closeActions));

    return () => {
      sidebarTarget.classList.remove("table-actions-tab-open");
      appTabs.forEach((button) => button.removeEventListener("click", closeActions));
    };
  }, [active, sidebarTarget, tabsTarget]);

  if (!sidebarTarget || !tabsTarget) return null;

  return (
    <>
      {createPortal(
        <button
          type="button"
          className={`table-actions-tab-button ${active ? "active" : ""}`}
          aria-selected={active}
          aria-controls="table-actions-tab-pane"
          onClick={() => setActive(true)}
        >
          Table actions
        </button>,
        tabsTarget,
      )}
      {createPortal(
        <section
          id="table-actions-tab-pane"
          className={`table-actions-tab-pane ${active ? "active" : ""}`}
          aria-hidden={!active}
          aria-label="Table actions"
        >
          <header className="table-actions-tab-intro">
            <div>
              <b>Table actions</b>
              <span>Every draw, meld, discard, undo, and completed turn in one readable timeline.</span>
            </div>
          </header>
          <div className="table-actions-tab-content" />
        </section>,
        sidebarTarget,
      )}
    </>
  );
}
