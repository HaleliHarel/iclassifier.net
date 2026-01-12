import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';

interface ProjectContextType {
  currentProject: string | null;
  setCurrentProject: (projectId: string) => void;
  getProjectAwareUrl: (basePath: string) => string;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const STORAGE_KEY = 'iclassifier-current-project';

// Helper to safely access localStorage
const getStoredProject = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const setStoredProject = (projectId: string | null): void => {
  try {
    if (projectId) {
      localStorage.setItem(STORAGE_KEY, projectId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Silently fail if localStorage is not available
  }
};

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [currentProject, setCurrentProjectState] = useState<string | null>(() => getStoredProject());
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Update current project from URL path or search params (fallback)
  useEffect(() => {
    const pathMatch = location.pathname.match(/\/project\/([^/]+)/);
    const projectFromPath = pathMatch ? pathMatch[1] : null;
    const projectFromSearch = searchParams.get('projectId');
    const projectId = projectFromPath || projectFromSearch;
    
    if (projectId && projectId !== currentProject) {
      setCurrentProjectState(projectId);
      setStoredProject(projectId);
    } else if (!projectId && currentProject && location.pathname.startsWith('/project')) {
      // If we're on a project route but no project ID, redirect to include it
      const newPath = location.pathname.replace('/project', `/project/${currentProject}`);
      navigate(newPath, { replace: true });
    }
    
    setIsLoading(false);
  }, [searchParams, location.pathname, currentProject, navigate]);

  const setCurrentProject = (projectId: string) => {
    setCurrentProjectState(projectId);
    setStoredProject(projectId);
  };

  const getProjectAwareUrl = (basePath: string) => {
    if (currentProject) {
      return `/project/${currentProject}${basePath}`;
    }
    // Fallback to legacy URL structure for backward compatibility
    return `${basePath}${currentProject ? `?projectId=${currentProject}` : ''}`;
  };

  return (
    <ProjectContext.Provider value={{ currentProject, setCurrentProject, getProjectAwareUrl, isLoading }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

// Hook to get current project ID from URL or context
export function useCurrentProjectId(): string {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { currentProject } = useProject();
  
  const pathMatch = location.pathname.match(/\/project\/([^/]+)/);
  const projectFromPath = pathMatch ? pathMatch[1] : null;
  const projectFromSearch = searchParams.get('projectId');
  
  return projectFromPath || projectFromSearch || currentProject || 'ancient-egyptian';
}
