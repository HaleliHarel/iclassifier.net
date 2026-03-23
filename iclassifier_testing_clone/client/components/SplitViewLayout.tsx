import { ReactNode } from "react";
import { X } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import TopNavButtons from "@/components/TopNavButtons";
import GlobalFooter from "@/components/GlobalFooter";
import { useComparison } from "@/context/ComparisonContext";

interface SplitViewLayoutProps {
  leftChild: ReactNode;
  rightChild: ReactNode;
}

export default function SplitViewLayout({ leftChild, rightChild }: SplitViewLayoutProps) {
  const { state, closeLeftPanel, closeRightPanel } = useComparison();

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Main split panel */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel */}
          <ResizablePanel defaultSize={50} minSize={20} maxSize={80}>
            <div className="h-full flex flex-col bg-white">
              {/* Top header with close button */}
              <div className="px-4 sm:px-8 lg:px-20 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-transparent">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Project {state.leftProjectId}
                    </h2>
                    <p className="text-sm text-gray-600">Left Panel</p>
                  </div>
                  <button
                    onClick={closeLeftPanel}
                    className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                    aria-label="Close left panel"
                  >
                    <X className="w-5 h-5 text-red-600" />
                  </button>
                </div>
                <TopNavButtons projectId={state.leftProjectId || undefined} />
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto px-4 sm:px-8 lg:px-20 py-6">
                {leftChild}
              </div>
            </div>
          </ResizablePanel>

          {/* Divider */}
          <ResizableHandle withHandle />

          {/* Right Panel */}
          <ResizablePanel defaultSize={50} minSize={20} maxSize={80}>
            <div className="h-full flex flex-col bg-white">
              {/* Top header with close button */}
              <div className="px-4 sm:px-8 lg:px-20 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-transparent">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Project {state.rightProjectId}
                    </h2>
                    <p className="text-sm text-gray-600">Right Panel</p>
                  </div>
                  <button
                    onClick={closeRightPanel}
                    className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                    aria-label="Close right panel"
                  >
                    <X className="w-5 h-5 text-red-600" />
                  </button>
                </div>
                <TopNavButtons projectId={state.rightProjectId || undefined} />
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto px-4 sm:px-8 lg:px-20 py-6">
                {rightChild}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Global Footer */}
      <GlobalFooter />
    </div>
  );
}
