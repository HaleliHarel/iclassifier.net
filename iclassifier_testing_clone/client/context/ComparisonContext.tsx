import React, { createContext, useContext, useState, ReactNode } from "react";

export interface ComparisonState {
  isComparing: boolean;
  leftProjectId: string | null;
  rightProjectId: string | null;
  activePanel: "left" | "right";
}

interface ComparisonContextType {
  state: ComparisonState;
  startComparison: (leftProjectId: string, rightProjectId: string) => void;
  endComparison: () => void;
  closeLeftPanel: () => void;
  closeRightPanel: () => void;
  setActivePanel: (panel: "left" | "right") => void;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ComparisonState>({
    isComparing: false,
    leftProjectId: null,
    rightProjectId: null,
    activePanel: "left",
  });

  const startComparison = (leftProjectId: string, rightProjectId: string) => {
    setState({
      isComparing: true,
      leftProjectId,
      rightProjectId,
      activePanel: "left",
    });
  };

  const endComparison = () => {
    setState({
      isComparing: false,
      leftProjectId: null,
      rightProjectId: null,
      activePanel: "left",
    });
  };

  const closeLeftPanel = () => {
    if (state.rightProjectId) {
      // Move right panel to left and exit comparison mode
      setState({
        isComparing: false,
        leftProjectId: null,
        rightProjectId: null,
        activePanel: "left",
      });
    }
  };

  const closeRightPanel = () => {
    if (state.leftProjectId) {
      // Keep left panel and exit comparison mode
      setState({
        isComparing: false,
        leftProjectId: null,
        rightProjectId: null,
        activePanel: "left",
      });
    }
  };

  const setActivePanel = (panel: "left" | "right") => {
    setState((prev) => ({ ...prev, activePanel: panel }));
  };

  return (
    <ComparisonContext.Provider
      value={{
        state,
        startComparison,
        endComparison,
        closeLeftPanel,
        closeRightPanel,
        setActivePanel,
      }}
    >
      {children}
    </ComparisonContext.Provider>
  );
}

export function useComparison() {
  const context = useContext(ComparisonContext);
  if (!context) {
    throw new Error("useComparison must be used within a ComparisonProvider");
  }
  return context;
}
