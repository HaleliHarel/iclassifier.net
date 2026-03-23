import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home as HomeIcon, List as ListIcon } from "lucide-react";
import { useProject, useCurrentProjectId } from "@/lib/projectContext";
import { projects } from "@/lib/sampleData";

interface GlobalNavProps {
  width?: number;
}

export default function GlobalNav({ width }: GlobalNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { getProjectAwareUrl } = useProject();
  const currentProjectId = useCurrentProjectId();
  const currentProjectName = projects.find((project) => project.id === currentProjectId)?.name;

  const getActiveTab = () => {
    const path = location.pathname;
    if (path === "/") return "project";
    if (path.includes("/lemma")) return "lemma";
    if (path.includes("/classifier")) return "classifier";
    if (path.includes("/query-report")) return "query";
    if (path.includes("/network")) return "map";
    return "project";
  };

  const activeTab = getActiveTab();

  const activeClassesById: Record<string, string> = {
    project: "bg-green-100 text-green-900",
    map: "bg-pink-100 text-pink-900",
    classifier: "bg-blue-100 text-blue-900",
    lemma: "bg-yellow-100 text-yellow-900",
    query: "bg-gray-200 text-gray-900"
  };

  const projectPath = currentProjectId ? `/project/${currentProjectId}` : "/";

  const navItems = [
    { id: "project", label: "Project", path: projectPath },
    { id: "map", label: "Network", path: "/network" },
    { id: "classifier", label: "Classifier", path: "/classifier" },
    { id: "lemma", label: "Lemma", path: "/lemma" },
    { id: "query", label: "Advanced Query", path: "/query-report" },
  ];

  const handleNavigation = (path: string) => {
    if (path === "/" || path.startsWith("/project/")) {
      navigate(path);
    } else if (currentProjectId) {
      const targetPath = `/project/${currentProjectId}${path}`;
      navigate(targetPath);
    } else {
      // Fallback to legacy URL structure if no project is selected
      navigate(getProjectAwareUrl(path));
    }
  };

  return (
    <aside
      className="h-full flex flex-col flex-shrink-0 bg-white"
      style={{ width: width ? `${width}px` : undefined }}
    >
      <div className="p-6">
        <a href="https://iclassifier.net" target="_blank" rel="noopener noreferrer">
          <h1 className="text-xl tracking-tight hover:opacity-80 transition-opacity">
            <div className="font-normal">
              <p>
                <em>iClassifier</em>.net
              </p>
            </div>
            <span className="font-bold" />
          </h1>
        </a>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 mt-10 space-y-8">
        {/* Browse By Section */}
        <div>
          <div className="px-4 mb-4">
            <h2 className="text-base font-semibold">Browse by:</h2>
          </div>

          <div className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.path)}
                className={cn(
                  "w-full flex items-center gap-4 px-4 h-10 rounded-lg transition-colors text-left",
                  activeTab === item.id
                    ? activeClassesById[item.id] || "bg-blue-100 text-blue-900"
                    : "hover:bg-[#F9FAFB]"
                )}
              >
                <span className={cn("text-base", activeTab === item.id ? "font-bold" : "font-normal")}>
                  {item.label}
                </span>
                {currentProjectId && (
                  <span className="text-xs text-gray-500 ml-auto">
                    {currentProjectName || currentProjectId}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Library Section */}
        <div>
          <div className="px-4 mb-2">
            <h2 className="text-base font-semibold">Learn more:</h2>
          </div>

          <button
            type="button"
            onClick={() => navigate("/about")}
            className={cn(
              "w-full flex items-center gap-4 px-4 h-10 rounded-lg transition-colors",
              location.pathname === "/about" ? "bg-[#F9FAFB]" : "hover:bg-[#F9FAFB]"
            )}
          >
            <span className="text-xl leading-none" aria-hidden="true">𓏛</span>
            <span className={cn("text-base", location.pathname === "/about" ? "font-bold" : "font-normal")}>
              About
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/user-manual")}
            className={cn(
              "w-full flex items-center gap-4 px-4 h-10 rounded-lg transition-colors",
              location.pathname === "/user-manual" ? "bg-[#F9FAFB]" : "hover:bg-[#F9FAFB]"
            )}
          >
            <span className="text-xl leading-none" aria-hidden="true">𓀨</span>
            <span className={cn("text-base", location.pathname === "/user-manual" ? "font-bold" : "font-normal")}>
              User Manual
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/contact-us")}
            className={cn(
              "w-full flex items-center gap-4 px-4 h-10 rounded-lg transition-colors",
              location.pathname === "/contact-us" ? "bg-[#F9FAFB]" : "hover:bg-[#F9FAFB]"
            )}
          >
            <span className="text-xl leading-none" aria-hidden="true">𓀁</span>
            <span className={cn("text-base", location.pathname === "/contact-us" ? "font-bold" : "font-normal")}>
              Contact us
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/bug-report")}
            className={cn(
              "w-full flex items-center gap-4 px-4 h-10 rounded-lg transition-colors",
              location.pathname === "/bug-report" ? "bg-[#F9FAFB]" : "hover:bg-[#F9FAFB]"
            )}
          >
            <span className="text-xl leading-none" aria-hidden="true">𓆧</span>
            <span className={cn("text-base", location.pathname === "/bug-report" ? "font-bold" : "font-normal")}>
              Bug report
            </span>
          </button>
        </div>
      </nav>
    </aside>
  );
}
