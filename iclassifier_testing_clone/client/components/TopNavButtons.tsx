import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useProject, useCurrentProjectId } from "@/lib/projectContext";
import { projects } from "@/lib/sampleData";

interface TopNavButtonsProps {
  projectId?: string;
  panelPosition?: "left" | "right";
  onReportTypeChange?: (reportType: string) => void;
  currentReportType?: string;
  compact?: boolean;
}

export default function TopNavButtons({ projectId, panelPosition, onReportTypeChange, currentReportType, compact }: TopNavButtonsProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { getProjectAwareUrl } = useProject();
  const currentProjectId = projectId || useCurrentProjectId();
  const currentProjectName = projects.find((project) => project.id === currentProjectId)?.name;

  const getActiveTab = () => {
    // If currentReportType is provided (compare mode), use it
    if (currentReportType) {
      if (currentReportType === "network") return "map";
      return currentReportType;
    }

    // Otherwise, derive from URL path
    const path = location.pathname;
    if (path === "/" || path === "/compare") return "project";
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
    query: "bg-gray-200 text-gray-900",
  };

  const projectPath = currentProjectId ? `/project/${currentProjectId}` : "/";

  const navItems = [
    { id: "project", label: "Project", path: projectPath, type: "project" as const },
    { id: "map", label: "Network", path: "/network", type: "network" as const },
    { id: "classifier", label: "Classifier", path: "/classifier", type: "classifier" as const },
    { id: "lemma", label: "Lemma", path: "/lemma", type: "lemma" as const },
    { id: "query", label: "Advanced Query", path: "/query-report", type: "query" as const },
  ];

  const reportTypeToPath = (type: string): string => {
    switch (type) {
      case "project":
        return "";
      case "query":
        return "query-report";
      case "network":
        return "network";
      case "classifier":
        return "classifier";
      case "lemma":
        return "lemma";
      default:
        return type;
    }
  };

  const handleNavigation = (reportType: string) => {
    // If we have a callback (used in comparison mode), call it instead of navigating
    if (onReportTypeChange) {
      onReportTypeChange(reportType);
      return;
    }

    // Normal navigation (not in comparison mode)
    const pathSegment = reportTypeToPath(reportType);
    if (reportType === "project") {
      navigate(projectPath);
    } else if (currentProjectId) {
      const targetPath = `/project/${currentProjectId}/${pathSegment}`;
      navigate(targetPath);
    } else {
      navigate(getProjectAwareUrl(`/${pathSegment}`));
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-1", compact ? "" : "mb-4 pb-4 border-b border-gray-200")}>
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => handleNavigation(item.type)}
          className={cn(
            "px-3 py-2 rounded-lg transition-colors text-sm font-medium",
            activeTab === item.id
              ? activeClassesById[item.id] || "bg-blue-100 text-blue-900"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
