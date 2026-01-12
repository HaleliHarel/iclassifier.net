import { useSearchParams } from "react-router-dom";
import { useTabs } from "@/context/TabContext";
import { projects } from "@/lib/sampleData";

export function useTabProjectId(): string {
  const [searchParams] = useSearchParams();
  const { tabs, activeTabId } = useTabs();

  // If in a tab, get projectId from the active tab
  if (activeTabId) {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab) {
      return activeTab.projectId;
    }
  }

  // Otherwise, get from URL query params
  const projectIdFromUrl = searchParams.get("projectId") || projects[0].id;
  return projectIdFromUrl;
}
