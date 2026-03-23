import React, { createContext, useContext, ReactNode } from "react";

interface ProjectContextOverrideType {
  overrideProjectId: string | null;
  panelPosition?: "left" | "right" | null;
}

const ProjectContextOverride = createContext<ProjectContextOverrideType | undefined>(undefined);

export function ProjectContextOverrideProvider({
  children,
  overrideProjectId,
  panelPosition,
}: {
  children: ReactNode;
  overrideProjectId: string | null;
  panelPosition?: "left" | "right" | null;
}) {
  return (
    <ProjectContextOverride.Provider value={{ overrideProjectId, panelPosition }}>
      {children}
    </ProjectContextOverride.Provider>
  );
}

export function useProjectContextOverride() {
  const context = useContext(ProjectContextOverride);
  if (context === undefined) {
    return { overrideProjectId: null, panelPosition: null };
  }
  return context;
}
