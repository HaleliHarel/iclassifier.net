import React, { createContext, useContext, useState, ReactNode } from "react";

export interface Tab {
  id: string;
  projectId: string;
  projectName: string;
  reportType: "lemma" | "classifier" | "query" | "map";
}

interface TabContextType {
  tabs: Tab[];
  activeTabId: string | null;
  openTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export function TabProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const openTab = (tab: Tab) => {
    const existingTab = tabs.find(
      (t) => t.projectId === tab.projectId && t.reportType === tab.reportType
    );

    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(tab.id);
    }
  };

  const closeTab = (id: string) => {
    setTabs((prev) => prev.filter((t) => t.id !== id));

    if (activeTabId === id) {
      const remaining = tabs.filter((t) => t.id !== id);
      if (remaining.length > 0) {
        setActiveTabId(remaining[remaining.length - 1].id);
      } else {
        setActiveTabId(null);
      }
    }
  };

  const setActiveTabHandler = (id: string) => {
    setActiveTabId(id);
  };

  return (
    <TabContext.Provider
      value={{
        tabs,
        activeTabId,
        openTab,
        closeTab,
        setActiveTab: setActiveTabHandler,
      }}
    >
      {children}
    </TabContext.Provider>
  );
}

export function useTabs() {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error("useTabs must be used within a TabProvider");
  }
  return context;
}
