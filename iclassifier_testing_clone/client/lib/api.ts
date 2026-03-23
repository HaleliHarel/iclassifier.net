import { useEffect, useMemo, useState } from "react";
import { Token, Lemma, Witness, ClassifierMetadata, projects } from "./sampleData";
import { useProjectData as useMergedProjectData } from "./dataProvider";
import { extractClassifiersFromString } from "./networkUtils";
import { mergeClassifierMeaningsWithFallback } from "./classifierMeaningFallback";
import { API_BASE_URL } from "./apiBase";

const API_BASE = API_BASE_URL;
const COMBINED_PROJECT_ID = "ancient-egyptian";

const isCombinedProject = (projectId: string) => projectId === COMBINED_PROJECT_ID;

const tokenMatchesTokenType = (token: Token, tokenType?: string) => {
  if (!tokenType || tokenType === "all") return true;
  if (tokenType === "compound-part") {
    return token.compound_id !== null && token.compound_id !== undefined;
  }
  if (tokenType === "standalone" || tokenType === "compound") {
    return token.compound_id === null || token.compound_id === undefined;
  }
  return true;
};

const tokenMatchesWitnessFilters = (
  token: Token,
  witnessIds?: string[],
  scripts?: string[],
  witnessData?: Record<string, Witness>
) => {
  if (witnessIds && witnessIds.length > 0) {
    if (!witnessIds.includes(String(token.witness_id))) {
      return false;
    }
  }
  if (scripts && scripts.length > 0) {
    const witness = witnessData?.[String(token.witness_id)];
    const script = witness?.script ? String(witness.script) : "";
    if (!script || !scripts.includes(script)) {
      return false;
    }
  }
  return true;
};

/**
 * Hook to fetch available projects from database
 */
export function useAvailableProjects() {
  const [data, setData] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        console.log('[API] Fetching available projects...');
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(`${API_BASE}/iclassifier/projects/list`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch projects: ${response.status}`);
        }
        
        const projects = await response.json();
        console.log('[API] Available projects:', projects);
        
        // If no projects from API, use default project
        if (!projects || projects.length === 0) {
          console.log('[API] No projects from API, using default project');
          setData([COMBINED_PROJECT_ID, 'classifyingtheother']);
        } else {
          const projectList = projects.includes(COMBINED_PROJECT_ID)
            ? projects
            : [COMBINED_PROJECT_ID, ...projects];
          setData(projectList);
        }
        setError(null);
      } catch (err) {
        console.error('[API] Error fetching projects:', err);
        if (err instanceof Error && err.name === 'AbortError') {
          setError('Request timed out');
        } else {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
        // Fallback to default project on error
        setData([COMBINED_PROJECT_ID, 'classifyingtheother']);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  return { data, loading, error };
}

/**
 * Hook to fetch all lemmas for a project
 */
export function useLemmas(projectId: string) {
  const combined = useMergedProjectData(isCombinedProject(projectId) ? projectId : "");
  const isCombined = isCombinedProject(projectId);
  const [data, setData] = useState<Record<number, Lemma>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || isCombined) return;
    const fetchLemmas = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/iclassifier/${projectId}/lemmas`
        );
        if (!response.ok) throw new Error("Failed to fetch lemmas");
        const lemmas = await response.json();
        setData(lemmas);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setData({});
      } finally {
        setLoading(false);
      }
    };

    fetchLemmas();
  }, [projectId, isCombined]);

  if (isCombined) {
    return {
      data: combined.lemmas || {},
      loading: combined.loading,
      error: combined.error || null
    };
  }

  return { data, loading, error };
}

/**
 * Hook to fetch all tokens for a project
 */
export function useTokens(projectId: string, enabled = true) {
  const combined = useMergedProjectData(isCombinedProject(projectId) ? projectId : "");
  const isCombined = isCombinedProject(projectId);
  const [data, setData] = useState<Record<number, Token>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || isCombined || !enabled) {
      if (!enabled) {
        setLoading(false);
        setError(null);
        setData({});
      }
      return;
    }
    const fetchTokens = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/iclassifier/${projectId}/tokens`
        );
        if (!response.ok) throw new Error("Failed to fetch tokens");
        const tokens = await response.json();
        setData(tokens);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setData({});
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
  }, [projectId, isCombined, enabled]);

  if (isCombined) {
    return {
      data: combined.tokens || {},
      loading: combined.loading,
      error: combined.error || null
    };
  }

  if (!enabled) {
    return { data: {}, loading: false, error: null };
  }

  return { data, loading, error };
}

export function useClassifierMeanings(projectId: string) {
  const combined = useMergedProjectData(isCombinedProject(projectId) ? projectId : "");
  const isCombined = isCombinedProject(projectId);
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const projectType = projects.find((project) => project.id === projectId)?.type;

  useEffect(() => {
    if (!projectId || isCombined) return;
    setLoading(true);
    const fetchMeanings = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/iclassifier/${projectId}/classifier-meanings`
        );
        if (!response.ok) throw new Error("Failed to fetch classifier meanings");
        const meanings = await response.json();
        setData(
          mergeClassifierMeaningsWithFallback({
            projectId,
            projectType,
            classifierMeanings: meanings || {}
          })
        );
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setData({});
      } finally {
        setLoading(false);
      }
    };

    fetchMeanings();
  }, [projectId, isCombined]);

  if (isCombined) {
    return {
      data: mergeClassifierMeaningsWithFallback({
        projectId,
        projectType,
        classifierMeanings: combined.classifierMeanings || {},
        lemmas: combined.lemmas
      }),
      loading: combined.loading,
      error: combined.error || null
    };
  }

  return { data, loading, error };
}

export function useLemmaSummaries(
  projectId: string,
  options?: { search?: string; limit?: number; offset?: number; withCounts?: boolean }
) {
  const combined = useMergedProjectData(isCombinedProject(projectId) ? projectId : "");
  const isCombined = isCombinedProject(projectId);
  const [data, setData] = useState<{ items: Array<Lemma & { token_count?: number }>; total: number }>({
    items: [],
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const combinedData = useMemo(() => {
    if (!isCombined) return { items: [], total: 0 };
    const search = String(options?.search || "").toLowerCase().trim();
    const withCounts = options?.withCounts ?? true;
    const lemmas = Object.values(combined.lemmas || {});
    const tokens = Object.values(combined.tokens || {});

    const filtered = search
      ? lemmas.filter((lemma) => {
          const translit = String(lemma.transliteration || "").toLowerCase();
          const meaning = String(lemma.meaning || "").toLowerCase();
          const idStr = String(lemma.id || "").toLowerCase();
          return translit.includes(search) || meaning.includes(search) || idStr.includes(search);
        })
      : lemmas;

    const total = filtered.length;
    const limit = typeof options?.limit === "number" ? options.limit : filtered.length;
    const offset = typeof options?.offset === "number" ? options.offset : 0;

    if (!withCounts) {
      const items = filtered
        .slice()
        .sort((a, b) => (a.id || 0) - (b.id || 0))
        .slice(offset, offset + limit);
      return { items, total };
    }

    const tokenCounts = new Map<number, number>();
    tokens.forEach((token) => {
      const lemmaId = Number(token.lemma_id);
      if (!Number.isFinite(lemmaId)) return;
      tokenCounts.set(lemmaId, (tokenCounts.get(lemmaId) || 0) + 1);
    });

    const withTokenCounts = filtered.map((lemma) => ({
      ...lemma,
      token_count: tokenCounts.get(lemma.id) || 0
    }));

    const items = withTokenCounts
      .slice()
      .sort((a, b) => {
        const countDiff = (b.token_count || 0) - (a.token_count || 0);
        if (countDiff !== 0) return countDiff;
        return (a.id || 0) - (b.id || 0);
      })
      .slice(offset, offset + limit);

    return { items, total };
  }, [
    isCombined,
    combined.lemmas,
    combined.tokens,
    options?.search,
    options?.limit,
    options?.offset,
    options?.withCounts
  ]);

  useEffect(() => {
    if (!projectId || isCombined) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (options?.search) params.set("search", options.search);
    params.set("limit", String(options?.limit ?? 10000));
    params.set("offset", String(options?.offset ?? 0));
    params.set("withCounts", String(options?.withCounts ?? true));

    const fetchSummaries = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/iclassifier/${projectId}/lemmas/paged?${params.toString()}`
        );
        if (!response.ok) throw new Error("Failed to fetch lemma summaries");
        const payload = await response.json();
        setData({
          items: Array.isArray(payload.items) ? payload.items : [],
          total: Number(payload.total || 0),
        });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setData({ items: [], total: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchSummaries();
  }, [projectId, isCombined, options?.search, options?.limit, options?.offset, options?.withCounts]);

  if (isCombined) {
    return {
      data: combinedData,
      loading: combined.loading,
      error: combined.error || null
    };
  }

  return { data, loading, error };
}

export function useTokensByLemma(
  projectId: string,
  lemmaId: number | null,
  options?: { witnessIds?: string[]; scripts?: string[]; tokenType?: string; limit?: number; offset?: number }
) {
  const combined = useMergedProjectData(isCombinedProject(projectId) ? projectId : "");
  const isCombined = isCombinedProject(projectId);
  const [data, setData] = useState<{ items: Token[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const combinedData = useMemo(() => {
    if (!isCombined || !lemmaId) return { items: [], total: 0 };
    const witnessIds = options?.witnessIds || [];
    const scripts = options?.scripts || [];
    const tokenType = options?.tokenType || "all";
    const limit = options?.limit ?? 1000;
    const offset = options?.offset ?? 0;

    const filtered = Object.values(combined.tokens || {})
      .filter((token) => token?.lemma_id === lemmaId)
      .filter((token) => tokenMatchesTokenType(token, tokenType))
      .filter((token) =>
        tokenMatchesWitnessFilters(token, witnessIds, scripts, combined.witnesses || {})
      )
      .sort((a, b) => a.id - b.id);

    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);
    return { items, total };
  }, [
    isCombined,
    lemmaId,
    combined.tokens,
    combined.witnesses,
    options?.tokenType,
    options?.limit,
    options?.offset,
    options?.witnessIds?.join(","),
    options?.scripts?.join(",")
  ]);

  useEffect(() => {
    if (!projectId || !lemmaId || isCombined) {
      setData({ items: [], total: 0 });
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setData({ items: [], total: 0 });
    const params = new URLSearchParams();
    params.set("limit", String(options?.limit ?? 1000));
    params.set("offset", String(options?.offset ?? 0));
    if (options?.tokenType) params.set("tokenType", options.tokenType);
    if (options?.witnessIds?.length) params.set("witnesses", options.witnessIds.join(","));
    if (options?.scripts?.length) params.set("scripts", options.scripts.join(","));

    const fetchTokens = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE}/iclassifier/${projectId}/tokens/by-lemma/${lemmaId}?${params.toString()}`
        );
        if (!response.ok) throw new Error("Failed to fetch lemma tokens");
        const payload = await response.json();
        if (cancelled) return;
        setData({
          items: Array.isArray(payload.items) ? payload.items : [],
          total: Number(payload.total || 0),
        });
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error");
        setData({ items: [], total: 0 });
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    };

    fetchTokens();

    return () => {
      cancelled = true;
    };
  }, [
    projectId,
    lemmaId,
    isCombined,
    options?.tokenType,
    options?.limit,
    options?.offset,
    options?.witnessIds?.join(","),
    options?.scripts?.join(","),
  ]);

  if (isCombined) {
    return {
      data: combinedData,
      loading: combined.loading,
      error: combined.error || null
    };
  }

  return { data, loading, error };
}

export function useTokensByIds(projectId: string, ids: number[]) {
  const combined = useMergedProjectData(isCombinedProject(projectId) ? projectId : "");
  const isCombined = isCombinedProject(projectId);
  const [data, setData] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const combinedData = useMemo(() => {
    if (!isCombined || ids.length === 0) return [];
    const tokens = combined.tokens || {};
    return ids
      .map((id) => tokens[id])
      .filter(Boolean)
      .sort((a, b) => a.id - b.id);
  }, [isCombined, combined.tokens, ids.join(",")]);

  useEffect(() => {
    if (!projectId || ids.length === 0 || isCombined) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("ids", ids.join(","));

    const fetchTokens = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE}/iclassifier/${projectId}/tokens/by-ids?${params.toString()}`
        );
        if (!response.ok) throw new Error("Failed to fetch tokens");
        const payload = await response.json();
        setData(Array.isArray(payload.items) ? payload.items : []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
  }, [projectId, ids.join(","), isCombined]);

  if (isCombined) {
    return {
      data: combinedData,
      loading: combined.loading,
      error: combined.error || null
    };
  }

  return { data, loading, error };
}

export function useTokensByClassifier(
  projectId: string,
  classifier: string | null,
  options?: { witnessIds?: string[]; scripts?: string[]; tokenType?: string; limit?: number; offset?: number }
) {
  const combined = useMergedProjectData(isCombinedProject(projectId) ? projectId : "");
  const isCombined = isCombinedProject(projectId);
  const [data, setData] = useState<{ items: Token[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const combinedData = useMemo(() => {
    if (!isCombined || !classifier) return { items: [], total: 0 };
    const witnessIds = options?.witnessIds || [];
    const scripts = options?.scripts || [];
    const tokenType = options?.tokenType || "all";
    const limit = options?.limit ?? 1000;
    const offset = options?.offset ?? 0;

    const filtered = Object.values(combined.tokens || {})
      .filter((token) => {
        const clfs = extractClassifiersFromString(token.mdc_w_markup || "");
        return clfs.includes(classifier);
      })
      .filter((token) => tokenMatchesTokenType(token, tokenType))
      .filter((token) =>
        tokenMatchesWitnessFilters(token, witnessIds, scripts, combined.witnesses || {})
      )
      .sort((a, b) => a.id - b.id);

    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);
    return { items, total };
  }, [
    isCombined,
    classifier,
    combined.tokens,
    combined.witnesses,
    options?.tokenType,
    options?.limit,
    options?.offset,
    options?.witnessIds?.join(","),
    options?.scripts?.join(",")
  ]);

  useEffect(() => {
    if (!projectId || !classifier || isCombined) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(options?.limit ?? 1000));
    params.set("offset", String(options?.offset ?? 0));
    if (options?.tokenType) params.set("tokenType", options.tokenType);
    if (options?.witnessIds?.length) params.set("witnesses", options.witnessIds.join(","));
    if (options?.scripts?.length) params.set("scripts", options.scripts.join(","));

    const fetchTokens = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE}/iclassifier/${projectId}/tokens/by-classifier/${encodeURIComponent(classifier)}?${params.toString()}`
        );
        if (!response.ok) throw new Error("Failed to fetch classifier tokens");
        const payload = await response.json();
        setData({
          items: Array.isArray(payload.items) ? payload.items : [],
          total: Number(payload.total || 0),
        });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setData({ items: [], total: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
  }, [
    projectId,
    classifier,
    isCombined,
    options?.tokenType,
    options?.limit,
    options?.offset,
    options?.witnessIds?.join(","),
    options?.scripts?.join(","),
  ]);

  if (isCombined) {
    return {
      data: combinedData,
      loading: combined.loading,
      error: combined.error || null
    };
  }

  return { data, loading, error };
}

/**
 * Hook to fetch all witnesses for a project
 */
export function useWitnesses(projectId: string) {
  const combined = useMergedProjectData(isCombinedProject(projectId) ? projectId : "");
  const isCombined = isCombinedProject(projectId);
  const [data, setData] = useState<Record<string, Witness>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || isCombined) return;
    const fetchWitnesses = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/iclassifier/${projectId}/witnesses`
        );
        if (!response.ok) throw new Error("Failed to fetch witnesses");
        const witnesses = await response.json();
        setData(witnesses);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setData({});
      } finally {
        setLoading(false);
      }
    };

    fetchWitnesses();
  }, [projectId, isCombined]);

  if (isCombined) {
    return {
      data: combined.witnesses || {},
      loading: combined.loading,
      error: combined.error || null
    };
  }

  return { data, loading, error };
}

/**
 * Hook to fetch classifier metadata for a project
 */
export function useClassifierMetadata(projectId: string) {
  const combined = useMergedProjectData(isCombinedProject(projectId) ? projectId : "");
  const isCombined = isCombinedProject(projectId);
  const [data, setData] = useState<ClassifierMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || isCombined) return;
    const fetchMetadata = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/iclassifier/${projectId}/classifier-metadata`
        );
        if (!response.ok) throw new Error("Failed to fetch classifier metadata");
        const metadata = await response.json();
        setData(metadata);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [projectId, isCombined]);

  if (isCombined) {
    return {
      data: combined.classifiers || [],
      loading: combined.loading,
      error: combined.error || null
    };
  }

  return { data, loading, error };
}

/**
 * Hook to fetch all data for a project at once
 * Useful for initial load
 */
export function useProjectData(projectId: string) {
  const combined = useMergedProjectData(isCombinedProject(projectId) ? projectId : "");
  const isCombined = isCombinedProject(projectId);
  const [data, setData] = useState<{
    lemmas: Record<number, Lemma>;
    tokens: Record<number, Token>;
    witnesses: Record<string, Witness>;
    classifiers: ClassifierMetadata[];
  }>({
    lemmas: {},
    tokens: {},
    witnesses: {},
    classifiers: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || isCombined) return;
    const fetchData = async () => {
      try {
        console.log(`[API] Fetching data for project: ${projectId}`);
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(
          `${API_BASE}/iclassifier/${projectId}/full`,
          { signal: controller.signal }
        );
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch project data: ${response.status} ${response.statusText}`);
        }
        
        const projectData = await response.json();
        console.log(`[API] Successfully fetched data for project: ${projectId}`);
        setData(projectData);
        setError(null);
      } catch (err) {
        console.error(`[API] Error fetching project data for ${projectId}:`, err);
        if (err instanceof Error && err.name === 'AbortError') {
          setError('Request timed out. Please try again.');
        } else {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
        // Set empty data structure on error so components can still render
        setData({
          lemmas: {},
          tokens: {},
          witnesses: {},
          classifiers: [],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId, isCombined]);

  if (isCombined) {
    return {
      data: combined.data || {
        lemmas: {},
        tokens: {},
        witnesses: {},
        classifiers: []
      },
      loading: combined.loading,
      error: combined.error || null
    };
  }

  return { data, loading, error };
}
