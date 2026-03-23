import { ReactNode, useEffect, useState as useReactState, useRef, useCallback } from "react";
import { Menu, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import GlobalNav from "./GlobalNav";
import { cn } from "@/lib/utils";

interface SidebarLayoutProps {
  children: ReactNode;
  contentClassName?: string;
}

export default function SidebarLayout({ children, contentClassName }: SidebarLayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useReactState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= 1024;
  });
  const [sidebarWidth, setSidebarWidth] = useReactState(() => {
    const stored = localStorage.getItem("iclassifier-sidebar-width");
    const parsed = stored ? parseInt(stored, 10) : 256;
    return Number.isFinite(parsed) ? parsed : 256;
  });
  const [isDesktop, setIsDesktop] = useReactState(false);
  const [viewportWidth, setViewportWidth] = useReactState(() => {
    if (typeof window === "undefined") return 0;
    return window.innerWidth;
  });
  const [headerHeight, setHeaderHeight] = useReactState(0);
  const draggingRef = useRef(false);

  // Check if we're in comparison mode - if so, return children without sidebar
  const isComparisonMode = location.pathname.match(/^\/compare\/[^/]+\/[^/]+/);
  if (isComparisonMode) {
    return <>{children}</>;
  }

  useEffect(() => {
    const update = () => {
      setIsDesktop(window.innerWidth >= 1024);
      setViewportWidth(window.innerWidth);
      const header = document.getElementById("app-header");
      setHeaderHeight(header?.offsetHeight || 0);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      setSidebarOpen(false);
    }
  }, [location.pathname, isDesktop]);

  useEffect(() => {
    if (isDesktop) {
      setSidebarOpen(true);
    }
  }, [isDesktop]);

  const startResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDesktop || !sidebarOpen) return;
    event.preventDefault();
    draggingRef.current = true;
  }, [isDesktop, sidebarOpen]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!draggingRef.current) return;
      const next = Math.min(420, Math.max(220, event.clientX));
      setSidebarWidth(next);
    };
    const onUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        localStorage.setItem("iclassifier-sidebar-width", `${sidebarWidth}`);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [sidebarWidth]);

  const themeClass = (() => {
    const path = location.pathname;
    if (path.includes("/lemma")) return "theme-lemma";
    if (path.includes("/classifier")) return "theme-classifier";
    if (path.includes("/network")) return "theme-network";
    if (path.includes("/query-report")) return "theme-query";
    return "theme-project";
  })();

  const mobileSidebarWidth = Math.min(sidebarWidth, Math.max(200, Math.floor(viewportWidth * 0.7)));
  const sidebarVisibleWidth = sidebarOpen ? (isDesktop ? sidebarWidth : mobileSidebarWidth) : 0;
  const toggleLeft = sidebarOpen ? sidebarVisibleWidth + 12 : 12;
  const toggleTop = headerHeight + 12;
  const mainMaxWidthClass = sidebarOpen ? "max-w-[1560px]" : "max-w-[1760px]";

  return (
    <div className={cn("min-h-screen bg-white", themeClass)}>
      <div
        className={cn(
          "fixed left-0 z-40 transition-[width] duration-300 overflow-hidden"
        )}
        style={{
          width: sidebarVisibleWidth,
          top: headerHeight,
          height: `calc(100vh - ${headerHeight}px)`
        }}
      >
        {sidebarOpen && (
          <GlobalNav width={sidebarVisibleWidth} />
        )}
      </div>

      <button
        type="button"
        onClick={() => setSidebarOpen((prev) => !prev)}
        className="fixed z-50 p-2 bg-white rounded-lg shadow-lg group"
        style={{ left: toggleLeft, top: toggleTop }}
        aria-label="Toggle navigation"
      >
        <span className="flex items-center gap-2">
          {sidebarOpen ? (
            <X className="w-5 h-5 group-hover:w-6 group-hover:h-6 transition-all" />
          ) : (
            <Menu className="w-5 h-5 group-hover:w-6 group-hover:h-6 transition-all" />
          )}
          <span className="hidden group-hover:inline text-[11px] font-semibold text-gray-600 transition-opacity">
            {sidebarOpen ? "Close navigation menu" : "Open navigation menu"}
          </span>
        </span>
      </button>

      {isDesktop && sidebarOpen && (
        <div
          onMouseDown={startResize}
          className="fixed top-0 bottom-0 z-40 hidden lg:block"
          style={{
            left: sidebarVisibleWidth - 3,
            width: 6,
            cursor: "col-resize",
            top: headerHeight,
            height: `calc(100vh - ${headerHeight}px)`
          }}
          aria-hidden="true"
        />
      )}

      <main
        className={cn(
          "px-4 sm:px-8 lg:px-20 py-6 lg:border-l border-[#E5E7EB] transition-[margin,width] duration-300",
          mainMaxWidthClass,
          contentClassName
        )}
        style={{
          marginLeft: sidebarVisibleWidth || undefined,
          width: sidebarVisibleWidth ? `calc(100% - ${sidebarVisibleWidth}px)` : undefined
        }}
      >
        {children}
      </main>
    </div>
  );
}
