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
  const [sidebarOpen, setSidebarOpen] = useReactState(false);
  const [sidebarWidth, setSidebarWidth] = useReactState(() => {
    const stored = localStorage.getItem("iclassifier-sidebar-width");
    const parsed = stored ? parseInt(stored, 10) : 256;
    return Number.isFinite(parsed) ? parsed : 256;
  });
  const [isDesktop, setIsDesktop] = useReactState(false);
  const draggingRef = useRef(false);

  useEffect(() => {
    const update = () => setIsDesktop(window.innerWidth >= 1024);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const startResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    draggingRef.current = true;
  }, []);

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
    if (path.includes("/map-report")) return "theme-network";
    if (path.includes("/query-report")) return "theme-query";
    return "theme-project";
  })();

  return (
    <div className={cn("min-h-screen bg-white", themeClass)}>
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 lg:hidden",
          sidebarOpen ? "block" : "hidden"
        )}
        onClick={() => setSidebarOpen(false)}
      />

      <div
        className={cn(
          "fixed lg:static z-50 transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ width: isDesktop ? sidebarWidth : undefined }}
      >
        <GlobalNav width={isDesktop ? sidebarWidth : undefined} />
      </div>

      <button
        type="button"
        onClick={() => setSidebarOpen((prev) => !prev)}
        className="lg:hidden fixed top-4 left-4 z-30 p-2 bg-white rounded-lg shadow-lg"
        aria-label="Toggle navigation"
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {isDesktop && (
        <div
          onMouseDown={startResize}
          className="fixed top-0 bottom-0 z-40 hidden lg:block"
          style={{ left: sidebarWidth - 3, width: 6, cursor: "col-resize" }}
          aria-hidden="true"
        />
      )}

      <main
        className={cn("px-4 sm:px-8 lg:px-20 py-6 max-w-[1440px]", contentClassName)}
        style={{ marginLeft: isDesktop ? sidebarWidth : undefined }}
      >
        {children}
      </main>
    </div>
  );
}
