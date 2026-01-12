import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Token, Lemma, Witness, ClassifierMetadata, ClassifierMeaningMap, egyptianProjects } from './sampleData';

interface ProjectDataState {
  [projectId: string]: {
    lemmas: Record<number, Lemma>;
    tokens: Record<number, Token>;
    witnesses: Record<string, Witness>;
    classifiers: ClassifierMetadata[];
    classifierMeanings: ClassifierMeaningMap;
    isLoaded: boolean;
    isLoading: boolean;
    error: string | null;
    lastFetched: number;
  };
}

interface ProjectDataContextType {
  getProjectData: (projectId: string) => {
    lemmas: Record<number, Lemma>;
    tokens: Record<number, Token>;
    witnesses: Record<string, Witness>;
    classifiers: ClassifierMetadata[];
    classifierMeanings: ClassifierMeaningMap;
    isLoading: boolean;
    error: string | null;
    needsFetch: boolean;
  };
  preloadProject: (projectId: string) => void;
  clearCache: () => void;
}

const ProjectDataContext = createContext<ProjectDataContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const COMBINED_EGYPTIAN_PROJECT_ID = "ancient-egyptian";

// Storage keys for persistence
const STORAGE_KEY_PREFIX = 'iclassifier-data-';
const STORAGE_TIMESTAMP_PREFIX = 'iclassifier-timestamp-';

const mergeProjectPayloads = (results: Array<{
  lemmas: Record<number, Lemma>;
  tokens: Record<number, Token>;
  witnesses: Record<string, Witness>;
  classifiers: ClassifierMetadata[];
  classifierMeanings: ClassifierMeaningMap;
}>) => {
  const merged = {
    lemmas: {} as Record<number, Lemma>,
    tokens: {} as Record<number, Token>,
    witnesses: {} as Record<string, Witness>,
    classifiers: [] as ClassifierMetadata[],
    classifierMeanings: {} as ClassifierMeaningMap
  };

  let nextLemmaId = 1;
  let nextTokenId = 1;

  results.forEach((projectData) => {
    const lemmaIds = Object.keys(projectData.lemmas).map((id) => Number(id)).filter((id) => Number.isFinite(id));
    const tokenIds = Object.keys(projectData.tokens).map((id) => Number(id)).filter((id) => Number.isFinite(id));

    const lemmaBase = nextLemmaId;
    const tokenBase = nextTokenId;

    const lemmaIdMap = new Map<number, number>();

    lemmaIds.forEach((oldId) => {
      const newId = lemmaBase + oldId;
      lemmaIdMap.set(oldId, newId);
      merged.lemmas[newId] = { ...projectData.lemmas[oldId], id: newId };
    });

    const tokenIdMap = new Map<number, number>();
    tokenIds.forEach((oldId) => {
      const token = projectData.tokens[oldId];
      const newId = tokenBase + oldId;
      const newLemmaId = lemmaIdMap.get(token.lemma_id) ?? token.lemma_id;
      tokenIdMap.set(oldId, newId);
      merged.tokens[newId] = { ...token, id: newId, lemma_id: newLemmaId };
    });

    Object.keys(projectData.witnesses).forEach((witnessId) => {
      if (!merged.witnesses[witnessId]) {
        merged.witnesses[witnessId] = projectData.witnesses[witnessId];
      }
    });

    projectData.classifiers.forEach((classifier) => {
      const rawTokenId = typeof classifier.token_id === "number"
        ? classifier.token_id
        : parseInt(String(classifier.token_id), 10);
      const mappedTokenId = Number.isFinite(rawTokenId) ? tokenIdMap.get(rawTokenId) : undefined;
      const updatedTokenId = mappedTokenId ?? classifier.token_id;
      merged.classifiers.push({ ...classifier, token_id: updatedTokenId });
    });

    Object.entries(projectData.classifierMeanings || {}).forEach(([classifier, meaning]) => {
      if (!meaning) return;
      const existing = merged.classifierMeanings[classifier];
      if (!existing) {
        merged.classifierMeanings[classifier] = meaning;
        return;
      }
      if (existing === meaning) return;
      const mergedSet = new Set(
        existing
          .split(";")
          .map((item) => item.trim())
          .filter(Boolean)
      );
      meaning
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => mergedSet.add(item));
      merged.classifierMeanings[classifier] = Array.from(mergedSet).join("; ");
    });

    const maxLemmaId = lemmaIds.length > 0 ? Math.max(...lemmaIds) : 0;
    const maxTokenId = tokenIds.length > 0 ? Math.max(...tokenIds) : 0;

    nextLemmaId = Math.max(nextLemmaId, lemmaBase + maxLemmaId + 1);
    nextTokenId = Math.max(nextTokenId, tokenBase + maxTokenId + 1);
  });

  return merged;
};

// Helper to safely access localStorage
const getStoredData = (projectId: string) => {
  try {
    const dataKey = STORAGE_KEY_PREFIX + projectId;
    const timestampKey = STORAGE_TIMESTAMP_PREFIX + projectId;
    
    const data = localStorage.getItem(dataKey);
    const timestamp = localStorage.getItem(timestampKey);
    
    if (data && timestamp) {
      const age = Date.now() - parseInt(timestamp);
      if (age < CACHE_DURATION) {
        return JSON.parse(data);
      }
    }
  } catch (e) {
    console.warn('Failed to read stored data:', e);
  }
  return null;
};

const setStoredData = (projectId: string, data: any) => {
  try {
    const dataKey = STORAGE_KEY_PREFIX + projectId;
    const timestampKey = STORAGE_TIMESTAMP_PREFIX + projectId;
    
    localStorage.setItem(dataKey, JSON.stringify(data));
    localStorage.setItem(timestampKey, Date.now().toString());
  } catch (e) {
    console.warn('Failed to store data:', e);
  }
};

export function ProjectDataProvider({ children }: { children: React.ReactNode }) {
  const [dataState, setDataState] = useState<ProjectDataState>({});

  // Initialize with stored data
  useEffect(() => {
    // This runs once on mount to restore any cached data
    const restoredState: ProjectDataState = {};
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (!key.startsWith(STORAGE_KEY_PREFIX)) return;
      const projectId = key.replace(STORAGE_KEY_PREFIX, "");
      const stored = getStoredData(projectId);
      if (!stored) return;
      restoredState[projectId] = {
        ...stored,
        isLoading: false,
        lastFetched: Date.now()
      };
    });
    
    if (Object.keys(restoredState).length > 0) {
      setDataState(restoredState);
    }
  }, []);

  const fetchFullProjectData = useCallback(async (projectId: string) => {
    const response = await fetch(`${API_BASE}/iclassifier/${projectId}/full`);
    if (!response.ok) {
      throw new Error(`Failed to fetch project data for ${projectId}`);
    }
    return response.json() as Promise<{
      lemmas: Record<number, Lemma>;
      tokens: Record<number, Token>;
      witnesses: Record<string, Witness>;
      classifiers: ClassifierMetadata[];
      classifierMeanings: ClassifierMeaningMap;
    }>;
  }, []);

  const mergeProjectData = useCallback(async (projectIds: string[]) => {
    const results = await Promise.allSettled(projectIds.map(fetchFullProjectData));
    const successes = results
      .filter((result): result is PromiseFulfilledResult<{
        lemmas: Record<number, Lemma>;
        tokens: Record<number, Token>;
        witnesses: Record<string, Witness>;
        classifiers: ClassifierMetadata[];
        classifierMeanings: ClassifierMeaningMap;
      }> => result.status === "fulfilled")
      .map((result) => result.value);

    const failures = results
      .map((result, index) => ({ result, projectId: projectIds[index] }))
      .filter((item) => item.result.status === "rejected")
      .map((item) => item.projectId);

    if (failures.length > 0) {
      console.warn("[DataProvider] Skipping projects with failed data loads:", failures);
    }

    if (successes.length === 0) {
      throw new Error("Failed to load project data for all selected projects");
    }

    return mergeProjectPayloads(successes);
  }, [fetchFullProjectData]);

  const fetchProjectData = useCallback(async (projectId: string) => {
    console.log(`[DataProvider] Fetching data for project: ${projectId}`);
    
    // Set loading state
    setDataState(prev => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        isLoading: true,
        error: null,
        lemmas: prev[projectId]?.lemmas || {},
        tokens: prev[projectId]?.tokens || {},
        witnesses: prev[projectId]?.witnesses || {},
        classifiers: prev[projectId]?.classifiers || [],
        classifierMeanings: prev[projectId]?.classifierMeanings || {},
        isLoaded: prev[projectId]?.isLoaded || false,
        lastFetched: prev[projectId]?.lastFetched || 0,
      }
    }));

    try {
      const results = projectId === COMBINED_EGYPTIAN_PROJECT_ID
        ? await mergeProjectData(egyptianProjects.map((project) => project.id))
        : await fetchFullProjectData(projectId);

      console.log(`[DataProvider] Successfully loaded project data for ${projectId}:`, {
        lemmas: Object.keys(results.lemmas).length,
        tokens: Object.keys(results.tokens).length,
        witnesses: Object.keys(results.witnesses).length,
        classifiers: results.classifiers.length,
        classifierMeanings: Object.keys(results.classifierMeanings || {}).length
      });

      const projectState = {
        ...results,
        isLoaded: true,
        isLoading: false,
        error: null,
        lastFetched: Date.now()
      };

      // Update state
      setDataState(prev => ({
        ...prev,
        [projectId]: projectState
      }));

      // Store in localStorage for persistence
      setStoredData(projectId, projectState);

    } catch (err) {
      console.error(`[DataProvider] Error fetching project data for ${projectId}:`, err);
      
      setDataState(prev => ({
        ...prev,
        [projectId]: {
          ...prev[projectId],
          isLoading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          lemmas: prev[projectId]?.lemmas || {},
          tokens: prev[projectId]?.tokens || {},
          witnesses: prev[projectId]?.witnesses || {},
          classifiers: prev[projectId]?.classifiers || [],
          classifierMeanings: prev[projectId]?.classifierMeanings || {},
          isLoaded: false,
          lastFetched: 0,
        }
      }));
    }
  }, [fetchFullProjectData, mergeProjectData]);

  const getProjectData = useCallback((projectId: string) => {
    const projectState = dataState[projectId];
    
    // Always return data (even if empty) to avoid hooks issues
    return {
      lemmas: projectState?.lemmas || {},
      tokens: projectState?.tokens || {},
      witnesses: projectState?.witnesses || {},
      classifiers: projectState?.classifiers || [],
      classifierMeanings: projectState?.classifierMeanings || {},
      isLoading: projectState?.isLoading || false,
      error: projectState?.error || null,
      dataVersion: projectState?.lastFetched || 0,
      needsFetch: !projectState || (!projectState.isLoaded && !projectState.isLoading) ||
                  (projectState.isLoaded && (Date.now() - projectState.lastFetched > CACHE_DURATION))
    };
  }, [dataState]);

  const preloadProject = useCallback((projectId: string) => {
    const projectState = dataState[projectId];
    if (!projectState || !projectState.isLoaded) {
      fetchProjectData(projectId);
    }
  }, [dataState, fetchProjectData]);

  const clearCache = useCallback(() => {
    setDataState({});
    // Clear localStorage
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(STORAGE_KEY_PREFIX) || key.startsWith(STORAGE_TIMESTAMP_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Failed to clear stored data:', e);
    }
  }, []);

  return (
    <ProjectDataContext.Provider value={{ getProjectData, preloadProject, clearCache }}>
      {children}
    </ProjectDataContext.Provider>
  );
}

export function useProjectData(projectId: string) {
  const context = useContext(ProjectDataContext);
  if (!context) {
    throw new Error('useProjectData must be used within a ProjectDataProvider');
  }
  
  const data = projectId
    ? context.getProjectData(projectId)
    : {
        lemmas: {},
        tokens: {},
        witnesses: {},
        classifiers: [],
        classifierMeanings: {},
        isLoading: false,
        error: null,
        needsFetch: false
      };
  
  // Use useEffect to trigger fetching when needed
  useEffect(() => {
    if (projectId && data.needsFetch) {
      context.preloadProject(projectId);
    }
  }, [projectId, data.needsFetch, context]);
  
  const payload = {
    lemmas: data.lemmas,
    tokens: data.tokens,
    witnesses: data.witnesses,
    classifiers: data.classifiers,
    classifierMeanings: data.classifierMeanings
  };

  return {
    data: payload,
    lemmas: data.lemmas,
    tokens: data.tokens,
    witnesses: data.witnesses,
    classifiers: data.classifiers,
    classifierMeanings: data.classifierMeanings,
    loading: data.isLoading,
    isLoading: data.isLoading,
    error: data.error
  };
}

export function useMultiProjectData(projectIds: string[]) {
  const context = useContext(ProjectDataContext);
  if (!context) {
    throw new Error('useMultiProjectData must be used within a ProjectDataProvider');
  }

  const uniqueIds = Array.from(new Set(projectIds.filter(Boolean)));
  const projectStates = uniqueIds.map((projectId) => ({
    projectId,
    data: context.getProjectData(projectId)
  }));

  const mergeKey = projectStates
    .map(({ projectId, data }) => `${projectId}:${dataState[projectId]?.lastFetched || 0}:${data.isLoading}:${data.error ? 1 : 0}`)
    .join("|");

  useEffect(() => {
    projectStates.forEach(({ projectId, data }) => {
      if (projectId && data.needsFetch) {
        context.preloadProject(projectId);
      }
    });
  }, [mergeKey, context]);

  const merged = useMemo(() => {
    if (projectStates.length === 0) {
      return {
        lemmas: {} as Record<number, Lemma>,
        tokens: {} as Record<number, Token>,
        witnesses: {} as Record<string, Witness>,
        classifiers: [] as ClassifierMetadata[],
        classifierMeanings: {} as ClassifierMeaningMap
      };
    }

    if (projectStates.length === 1) {
      const only = projectStates[0].data;
      return {
        lemmas: only.lemmas,
        tokens: only.tokens,
        witnesses: only.witnesses,
        classifiers: only.classifiers,
        classifierMeanings: only.classifierMeanings
      };
    }

    return mergeProjectPayloads(
      projectStates.map(({ data }) => ({
        lemmas: data.lemmas,
        tokens: data.tokens,
        witnesses: data.witnesses,
        classifiers: data.classifiers,
        classifierMeanings: data.classifierMeanings
      }))
    );
  }, [mergeKey]);

  const isLoading = projectStates.some(({ data }) => data.isLoading);
  const error = projectStates.map(({ data }) => data.error).find(Boolean) || null;

  return {
    data: merged,
    lemmas: merged.lemmas,
    tokens: merged.tokens,
    witnesses: merged.witnesses,
    classifiers: merged.classifiers,
    classifierMeanings: merged.classifierMeanings,
    loading: isLoading,
    isLoading,
    error
  };
}

export function useProjectDataActions() {
  const context = useContext(ProjectDataContext);
  if (!context) {
    throw new Error('useProjectDataActions must be used within a ProjectDataProvider');
  }
  return {
    preloadProject: context.preloadProject,
    clearCache: context.clearCache
  };
}
