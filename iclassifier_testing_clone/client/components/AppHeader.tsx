import { useEffect, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CompareModeToggle from "@/components/CompareModeToggle";
import { Button } from "@/components/ui/button";

export default function AppHeader() {
  // AppHeader is always visible, including in comparison mode
  const location = useLocation();
  const navigate = useNavigate();
  const isCompareRoute = /^\/compare\/[^/]+\/[^/]+/.test(location.pathname);
  const [compareTabsCollapsed, setCompareTabsCollapsed] = useState(false);

  useEffect(() => {
    const updateHeight = () => {
      const header = document.getElementById("app-header");
      if (!header) return;
      document.documentElement.style.setProperty("--app-header-height", `${header.offsetHeight}px`);
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  useEffect(() => {
    if (!isCompareRoute) return;
    const handleTabsState = (event: Event) => {
      const detail = (event as CustomEvent<{ collapsed?: boolean }>).detail;
      if (typeof detail?.collapsed === "boolean") {
        setCompareTabsCollapsed(detail.collapsed);
      }
    };
    window.addEventListener("compare:tabs-state", handleTabsState as EventListener);
    return () => {
      window.removeEventListener("compare:tabs-state", handleTabsState as EventListener);
    };
  }, [isCompareRoute]);

  const handleToggleTabs = useCallback(() => {
    const next = !compareTabsCollapsed;
    window.dispatchEvent(new CustomEvent("compare:toggle-tabs", { detail: { collapsed: next } }));
    setCompareTabsCollapsed(next);
  }, [compareTabsCollapsed]);

  const handleJumpSummary = useCallback(() => {
    window.dispatchEvent(new CustomEvent("compare:jump-summary"));
  }, []);

  const handleExitCompare = useCallback(() => {
    navigate("/reports");
  }, [navigate]);

  return (
    <header id="app-header" className="bg-black text-white py-4 px-6 border-b border-gray-800">
      <div
        className={
          isCompareRoute
            ? "max-w-7xl mx-auto grid grid-cols-[auto,1fr,auto] items-center gap-6"
            : "max-w-7xl mx-auto flex items-center justify-between"
        }
      >
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img
            src="https://cdn.builder.io/api/v1/image/assets%2F9b85a9b7160046d8810aa65084b2d8be%2F76ae63b1df5a400db37e149d10b72c61?format=webp&width=800"
            alt="iClassifier Logo"
            className="h-10 w-auto"
          />
          <div className="text-xl font-semibold">
            <p>Reports</p>
          </div>
        </Link>
        <div className={isCompareRoute ? "text-sm text-gray-400 text-center justify-self-center" : "text-sm text-gray-400"}>
          <p>Browse through networks of concepts and categories</p>
        </div>
        {isCompareRoute ? (
          <div className="flex flex-wrap items-center gap-2 justify-self-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleTabs}
              className="text-xs font-semibold text-black border-black/30 bg-white hover:bg-gray-100 hover:text-black"
            >
              {compareTabsCollapsed ? "Open project comparison tabs" : "Hide project comparison tabs"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleJumpSummary}
              className="text-xs font-semibold text-black border-black/30 bg-white hover:bg-gray-100 hover:text-black"
            >
              Jump to summary
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExitCompare}
              className="text-xs font-semibold text-red-800 border-red-800/60 bg-white hover:bg-red-100 hover:text-red-900"
            >
              Exit compare mode
            </Button>
          </div>
        ) : (
          <CompareModeToggle />
        )}
      </div>
    </header>
  );
}
