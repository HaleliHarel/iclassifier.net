import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useProject } from "@/lib/projectContext";

export default function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentProject } = useProject();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes("/lemma")) return "lemma";
    if (path.includes("/classifier")) return "classifier";
    if (path.includes("/query-report")) return "query";
    if (path.includes("/network")) return "map";
    return "projects";
  };

  const getProjectAwareUrl = (reportType: string) => {
    if (currentProject) {
      return `/project/${currentProject}/${reportType}`;
    }
    // If no project is selected, navigate to home to select a project
    return '/';
  };

  const activeTab = getActiveTab();

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
      <div className="flex items-center bg-[#F9FAFB] rounded-lg p-1 overflow-x-auto w-full sm:w-auto">
        <button
          onClick={() => navigate("/")}
          className={cn(
            "px-3 h-8 rounded flex items-center text-sm sm:text-base font-medium transition-all whitespace-nowrap",
            activeTab === "projects" && "bg-white shadow-sm"
          )}
        >
          Projects
        </button>
        <button
          onClick={() => navigate(getProjectAwareUrl("lemma"))}
          className={cn(
            "px-3 h-8 rounded flex items-center text-sm sm:text-base font-medium transition-all whitespace-nowrap",
            activeTab === "lemma" && "bg-white shadow-sm"
          )}
        >
          Lemma
        </button>
        <button
          onClick={() => navigate(getProjectAwareUrl("classifier"))}
          className={cn(
            "px-3 h-8 rounded flex items-center text-sm sm:text-base font-medium transition-all whitespace-nowrap",
            activeTab === "classifier" && "bg-white shadow-sm"
          )}
        >
          Classifier
        </button>
        <button
          onClick={() => navigate(getProjectAwareUrl("query-report"))}
          className={cn(
            "px-3 h-8 rounded flex items-center text-sm sm:text-base font-medium transition-all whitespace-nowrap",
            activeTab === "query" && "bg-white shadow-sm"
          )}
        >
          Query
        </button>
        <button
          onClick={() => navigate(getProjectAwareUrl("network"))}
          className={cn(
            "px-3 h-8 rounded flex items-center text-sm sm:text-base font-medium transition-all whitespace-nowrap",
            activeTab === "map" && "bg-white shadow-sm"
          )}
        >
          Map
        </button>
      </div>

      <button className="px-4 h-10 bg-black text-white rounded-lg text-base font-medium hover:bg-black/90 transition-colors w-full sm:w-auto">
        Home
      </button>
    </div>
  );
}
