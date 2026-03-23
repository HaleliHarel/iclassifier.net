import { Home, Search, List, Radio } from "lucide-react";
import { Home as HomeIcon, Search as SearchIcon, List as ListIcon, Radio as RadioIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavigate = (path?: string) => () => {
    if (!path) return;
    navigate(path);
    onNavigate?.();
  };

  const isActive = (path?: string) => path && location.pathname === path;

  return (
    <aside className="w-64 h-screen flex-shrink-0 border-r border-[#E5E7EB] bg-white fixed left-0 top-0">
      <div className="p-6">
        <h1 className="text-xl font-semibold tracking-tight">iClassifier</h1>
      </div>

      <nav className="px-2 mt-10 space-y-24">
        <div>
          <div className="px-4 mb-1">
            <h2 className="text-base font-semibold">Discover</h2>
          </div>

          <button
            type="button"
            onClick={handleNavigate("/")}
            className={cn(
              "w-full flex items-center gap-4 px-4 h-10 rounded-lg transition-colors",
              isActive("/") ? "bg-[#F9FAFB]" : "hover:bg-[#F9FAFB]"
            )}
          >
            <HomeIcon className="w-6 h-6" />
            <span className={cn("text-base", isActive("/") ? "font-bold" : "font-medium")}>Home</span>
          </button>

          <button
            type="button"
            onClick={handleNavigate("/lemma")}
            className={cn(
              "w-full flex items-center gap-4 px-4 h-10 rounded-lg transition-colors",
              isActive("/lemma") ? "bg-[#F9FAFB]" : "hover:bg-[#F9FAFB]"
            )}
          >
            <SearchIcon className="w-6 h-6" />
            <span
              className={cn(
                "text-base text-left whitespace-normal",
                isActive("/lemma") ? "font-bold" : "font-medium"
              )}
            >
              Browse lemmas or classifiers
            </span>
          </button>
        </div>

        <div>
          <div className="px-4 mb-2">
            <h2 className="text-base font-semibold">Library</h2>
          </div>

          <button
            type="button"
            className="w-full flex items-center gap-4 px-4 h-10 rounded-lg transition-colors hover:bg-[#F9FAFB]"
          >
            <ListIcon className="w-6 h-6" />
            <span className="text-base font-medium">Project list</span>
          </button>

          <button
            type="button"
            className="w-full flex items-center gap-4 px-4 h-10 rounded-lg transition-colors hover:bg-[#F9FAFB]"
          >
            <div className="w-6 h-6 bg-[#F5C842] rounded" />
            <span className="text-base font-medium">Guidelines</span>
          </button>

          <button
            type="button"
            className="w-full flex items-center gap-4 px-4 h-10 rounded-lg transition-colors hover:bg-[#F9FAFB]"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
            <span className="text-base font-medium">Saved Reports</span>
          </button>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            className="w-full flex items-center gap-4 px-4 h-10 rounded-lg transition-colors hover:bg-[#F9FAFB]"
          >
            <RadioIcon className="w-6 h-6" />
            <span className="text-base font-medium">Bug report</span>
          </button>

          <button
            type="button"
            className="w-full flex items-center gap-4 px-4 h-10 rounded-lg transition-colors hover:bg-[#F9FAFB]"
          >
            <span className="text-base font-medium" style={{ marginLeft: "42px" }}>
              Contact us
            </span>
          </button>
        </div>
      </nav>
    </aside>
  );
}
