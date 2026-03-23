import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Token, Lemma, Witness, ClassifierMetadata, ClassifierMeaningMap, unifiedEgyptianProjects, projects } from './sampleData';
import { mergeClassifierMeaningsWithFallback } from './classifierMeaningFallback';
import { API_BASE_URL } from "./apiBase";

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
    cacheVersion?: string;
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
    dataVersion: number;
  };
  preloadProject: (projectId: string) => void;
  clearCache: () => void;
}

const ProjectDataContext = createContext<ProjectDataContextType | undefined>(undefined);

const API_BASE = API_BASE_URL;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const COMBINED_EGYPTIAN_PROJECT_ID = "ancient-egyptian";
const COMBINED_CACHE_VERSION = unifiedEgyptianProjects
  .map((project) => project.id)
  .slice()
  .sort()
  .join("|");

const shouldNormalizeEgyptianTransliteration = (projectId: string) => {
  if (projectId === COMBINED_EGYPTIAN_PROJECT_ID) return true;
  return projects.find((project) => project.id === projectId)?.type === "hieroglyphic";
};

const normalizeEgyptianTransliteration = (value?: string | null) => {
  if (!value) return value;
  return value.replace(/[ḳḲ]/g, (match) => (match === "ḳ" ? "q" : "Q"));
};

const normalizeLemmaTransliterations = (lemmas: Record<number, Lemma>) => {
  if (!lemmas) return lemmas;
  let changed = false;
  const updated: Record<number, Lemma> = { ...lemmas };

  Object.entries(lemmas).forEach(([id, lemma]) => {
    if (!lemma) return;
    const normalized = normalizeEgyptianTransliteration(lemma.transliteration);
    if (normalized !== lemma.transliteration) {
      updated[id as unknown as number] = { ...lemma, transliteration: normalized };
      changed = true;
    }
  });

  return changed ? updated : lemmas;
};

// Storage keys for persistence
const STORAGE_KEY_PREFIX = 'iclassifier-data-';
const STORAGE_TIMESTAMP_PREFIX = 'iclassifier-timestamp-';

const mergeProjectPayloads = (results: Array<{
  projectId: string;
  data: {
    lemmas: Record<number, Lemma>;
    tokens: Record<number, Token>;
    witnesses: Record<string, Witness>;
    classifiers: ClassifierMetadata[];
    classifierMeanings: ClassifierMeaningMap;
  };
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

  results.forEach(({ projectId, data: projectData }) => {
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

    const witnessIdMap = new Map<string, string>();
    Object.keys(projectData.witnesses).forEach((witnessId) => {
      const originalId = String(witnessId);
      let mergedId = originalId;
      if (merged.witnesses[mergedId]) {
        mergedId = `${projectId}::${originalId}`;
        let suffix = 1;
        while (merged.witnesses[mergedId]) {
          mergedId = `${projectId}::${originalId}#${suffix++}`;
        }
      }
      witnessIdMap.set(originalId, mergedId);
      merged.witnesses[mergedId] = {
        ...projectData.witnesses[witnessId],
        id: mergedId
      };
    });

    const tokenIdMap = new Map<number, number>();
    tokenIds.forEach((oldId) => {
      const token = projectData.tokens[oldId];
      const newId = tokenBase + oldId;
      const newLemmaId = lemmaIdMap.get(token.lemma_id) ?? token.lemma_id;
      const mappedWitnessId = token.witness_id != null
        ? witnessIdMap.get(String(token.witness_id)) ?? token.witness_id
        : token.witness_id;
      tokenIdMap.set(oldId, newId);
      merged.tokens[newId] = {
        ...token,
        id: newId,
        lemma_id: newLemmaId,
        witness_id: mappedWitnessId
      };
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

// Helper to clear old cached data when storage is full
const clearOldCachedData = () => {
  const keys = Object.keys(localStorage);
  const cacheKeys = keys.filter(key => key.startsWith(STORAGE_KEY_PREFIX));
  
  // Get cache entries with timestamps
  const cacheEntries = cacheKeys
    .map(dataKey => {
      const projectId = dataKey.replace(STORAGE_KEY_PREFIX, '');
      const timestampKey = STORAGE_TIMESTAMP_PREFIX + projectId;
      const timestamp = localStorage.getItem(timestampKey);
      return {
        projectId,
        dataKey,
        timestampKey,
        timestamp: timestamp ? parseInt(timestamp) : 0
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp); // Oldest first

  // Remove oldest entries until we've cleared at least 25% of cache entries
  const entriesToRemove = Math.max(1, Math.floor(cacheEntries.length * 0.25));
  
  for (let i = 0; i < entriesToRemove && i < cacheEntries.length; i++) {
    const entry = cacheEntries[i];
    try {
      localStorage.removeItem(entry.dataKey);
      localStorage.removeItem(entry.timestampKey);
      console.log(`Removed cached data for ${entry.projectId}`);
    } catch (e) {
      console.warn(`Failed to remove cache for ${entry.projectId}:`, e);
    }
  }
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
        const parsed = JSON.parse(data);
        if (projectId === COMBINED_EGYPTIAN_PROJECT_ID) {
          if (parsed?.cacheVersion !== COMBINED_CACHE_VERSION) {
            return null;
          }
        }
        return parsed;
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

    const payload = projectId === COMBINED_EGYPTIAN_PROJECT_ID
      ? { ...data, cacheVersion: COMBINED_CACHE_VERSION }
      : data;

    const jsonData = JSON.stringify(payload);
    
    // Check if data is too large (> 4MB to leave room for other data)
    const sizeInMB = new Blob([jsonData]).size / (1024 * 1024);
    
    if (sizeInMB > 4) {
      console.warn(`Dataset ${projectId} is too large (${sizeInMB.toFixed(1)}MB) for localStorage caching. Skipping cache.`);
      return;
    }

    localStorage.setItem(dataKey, jsonData);
    localStorage.setItem(timestampKey, Date.now().toString());
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn(`Storage quota exceeded for ${projectId}. Attempting cleanup...`);
      
      // Try to clear old cached data to make room
      try {
        clearOldCachedData();
        // Try storing again after cleanup
        const dataKey = STORAGE_KEY_PREFIX + projectId;
        const timestampKey = STORAGE_TIMESTAMP_PREFIX + projectId;
        const payload = projectId === COMBINED_EGYPTIAN_PROJECT_ID
          ? { ...data, cacheVersion: COMBINED_CACHE_VERSION }
          : data;
        localStorage.setItem(dataKey, JSON.stringify(payload));
        localStorage.setItem(timestampKey, Date.now().toString());
        console.log(`Successfully cached ${projectId} after cleanup`);
      } catch (retryError) {
        console.warn(`Could not cache ${projectId} even after cleanup:`, retryError);
      }
    } else {
      console.warn('Failed to store data:', e);
    }
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
      const normalizedStored = shouldNormalizeEgyptianTransliteration(projectId)
        ? { ...stored, lemmas: normalizeLemmaTransliterations(stored.lemmas || {}) }
        : stored;
      restoredState[projectId] = {
        ...normalizedStored,
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
    const results = await Promise.all(
      projectIds.map(async (projectId) => ({
        projectId,
        data: await fetchFullProjectData(projectId)
      }))
    );
    return mergeProjectPayloads(results);
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
        ? await mergeProjectData(unifiedEgyptianProjects.map((project) => project.id))
        : await fetchFullProjectData(projectId);
      const normalizedResults = shouldNormalizeEgyptianTransliteration(projectId)
        ? { ...results, lemmas: normalizeLemmaTransliterations(results.lemmas || {}) }
        : results;

      console.log(`[DataProvider] Successfully loaded project data for ${projectId}:`, {
        lemmas: Object.keys(normalizedResults.lemmas).length,
        tokens: Object.keys(normalizedResults.tokens).length,
        witnesses: Object.keys(normalizedResults.witnesses).length,
        classifiers: normalizedResults.classifiers.length,
        classifierMeanings: Object.keys(normalizedResults.classifierMeanings || {}).length
      });

      const projectState = {
        ...normalizedResults,
        isLoaded: true,
        isLoading: false,
        error: null,
        lastFetched: Date.now(),
        cacheVersion: projectId === COMBINED_EGYPTIAN_PROJECT_ID
          ? COMBINED_CACHE_VERSION
          : undefined
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
          cacheVersion: prev[projectId]?.cacheVersion
        }
      }));
    }
  }, [fetchFullProjectData, mergeProjectData]);

  const getProjectData = useCallback((projectId: string) => {
    const projectState = dataState[projectId];
    const projectType = projects.find((project) => project.id === projectId)?.type;
    const combinedInvalid = projectId === COMBINED_EGYPTIAN_PROJECT_ID
      ? projectState?.cacheVersion !== COMBINED_CACHE_VERSION
      : false;
    const isStale = projectState?.lastFetched
      ? Date.now() - projectState.lastFetched > CACHE_DURATION
      : true;
    const needsFetch = !projectState
      || (!projectState.isLoaded && !projectState.isLoading)
      || (projectState.isLoaded && (isStale || combinedInvalid));
    
    const classifierMeanings = mergeClassifierMeaningsWithFallback({
      projectId,
      projectType,
      classifierMeanings: combinedInvalid ? {} : (projectState?.classifierMeanings || {}),
      lemmas: combinedInvalid ? {} : projectState?.lemmas
    });

    // Always return data (even if empty) to avoid hooks issues
    return {
      lemmas: combinedInvalid ? {} : (projectState?.lemmas || {}),
      tokens: combinedInvalid ? {} : (projectState?.tokens || {}),
      witnesses: combinedInvalid ? {} : (projectState?.witnesses || {}),
      classifiers: combinedInvalid ? [] : (projectState?.classifiers || []),
      classifierMeanings,
      isLoading: projectState?.isLoading || false,
      error: projectState?.error || null,
      dataVersion: projectState?.lastFetched || 0,
      needsFetch
    };
  }, [dataState]);

  const preloadProject = useCallback((projectId: string) => {
    const projectState = dataState[projectId];
    const isStale = projectState?.lastFetched
      ? Date.now() - projectState.lastFetched > CACHE_DURATION
      : true;
    const combinedInvalid = projectId === COMBINED_EGYPTIAN_PROJECT_ID
      ? projectState?.cacheVersion !== COMBINED_CACHE_VERSION
      : false;
    if (!projectState || ((!projectState.isLoaded || isStale || combinedInvalid) && !projectState.isLoading)) {
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
    .map(({ projectId, data }) => `${projectId}:${data.dataVersion || 0}:${data.isLoading}:${data.error ? 1 : 0}`)
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
      projectStates.map(({ projectId, data }) => ({
        projectId,
        data: {
          lemmas: data.lemmas,
          tokens: data.tokens,
          witnesses: data.witnesses,
          classifiers: data.classifiers,
          classifierMeanings: data.classifierMeanings
        }
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
