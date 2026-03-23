import { X } from "lucide-react";
import { useTabs } from "@/context/TabContext";
import { cn } from "@/lib/utils";

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabs();

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-gray-200 bg-white overflow-x-auto">
      <div className="flex gap-2 px-4 sm:px-8 lg:px-20 py-3">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-t-lg border border-b-0 cursor-pointer transition-colors whitespace-nowrap",
              activeTabId === tab.id
                ? "bg-white text-blue-600 border-gray-200 font-medium"
                : "bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100"
            )}
          >
            <span className="text-sm font-medium">{tab.projectName}</span>
            <span className="text-xs text-gray-400">
              {tab.reportType.charAt(0).toUpperCase() + tab.reportType.slice(1)}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="ml-1 p-0.5 rounded hover:bg-gray-200 transition-colors"
              aria-label="Close tab"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
