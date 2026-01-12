import { useTabs } from "@/context/TabContext";
import LemmaReport from "@/pages/LemmaReport";
import ClassifierReport from "@/pages/ClassifierReport";
import QueryReport from "@/pages/QueryReport";
import MapReport from "@/pages/MapReport";

export default function TabContent() {
  const { tabs, activeTabId } = useTabs();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  if (!activeTab) {
    return null;
  }

  const reportProps = {
    projectId: activeTab.projectId,
  };

  switch (activeTab.reportType) {
    case "lemma":
      return <LemmaReport />;
    case "classifier":
      return <ClassifierReport />;
    case "query":
      return <QueryReport />;
    case "map":
      return <MapReport />;
    default:
      return null;
  }
}
