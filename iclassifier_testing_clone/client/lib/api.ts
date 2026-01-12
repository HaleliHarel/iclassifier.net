import { useEffect, useState } from "react";
import { Token, Lemma, Witness, ClassifierMetadata } from "./sampleData";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

/**
 * Hook to fetch available projects from database
 */
export function useAvailableProjects() {
  const [data, setData] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const combinedProjectId = "ancient-egyptian";

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
          setData([combinedProjectId, 'classifyingtheother']);
        } else {
          const projectList = projects.includes(combinedProjectId)
            ? projects
            : [combinedProjectId, ...projects];
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
        setData([combinedProjectId, 'classifyingtheother']);
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
  const [data, setData] = useState<Record<number, Lemma>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [projectId]);

  return { data, loading, error };
}

/**
 * Hook to fetch all tokens for a project
 */
export function useTokens(projectId: string) {
  const [data, setData] = useState<Record<number, Token>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [projectId]);

  return { data, loading, error };
}

export function useClassifierMeanings(projectId: string) {
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    const fetchMeanings = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/iclassifier/${projectId}/classifier-meanings`
        );
        if (!response.ok) throw new Error("Failed to fetch classifier meanings");
        const meanings = await response.json();
        setData(meanings || {});
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setData({});
      } finally {
        setLoading(false);
      }
    };

    fetchMeanings();
  }, [projectId]);

  return { data, loading, error };
}

export function useLemmaSummaries(
  projectId: string,
  options?: { search?: string; limit?: number; offset?: number; withCounts?: boolean }
) {
  const [data, setData] = useState<{ items: Array<Lemma & { token_count?: number }>; total: number }>({
    items: [],
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
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
  }, [projectId, options?.search, options?.limit, options?.offset, options?.withCounts]);

  return { data, loading, error };
}

export function useTokensByLemma(
  projectId: string,
  lemmaId: number | null,
  options?: { witnessIds?: string[]; scripts?: string[]; tokenType?: string; limit?: number; offset?: number }
) {
  const [data, setData] = useState<{ items: Token[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !lemmaId) return;
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
          `${API_BASE}/iclassifier/${projectId}/tokens/by-lemma/${lemmaId}?${params.toString()}`
        );
        if (!response.ok) throw new Error("Failed to fetch lemma tokens");
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
    lemmaId,
    options?.tokenType,
    options?.limit,
    options?.offset,
    options?.witnessIds?.join(","),
    options?.scripts?.join(","),
  ]);

  return { data, loading, error };
}

export function useTokensByIds(projectId: string, ids: number[]) {
  const [data, setData] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || ids.length === 0) {
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
  }, [projectId, ids.join(",")]);

  return { data, loading, error };
}

export function useTokensByClassifier(
  projectId: string,
  classifier: string | null,
  options?: { witnessIds?: string[]; scripts?: string[]; tokenType?: string; limit?: number; offset?: number }
) {
  const [data, setData] = useState<{ items: Token[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !classifier) return;
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
    options?.tokenType,
    options?.limit,
    options?.offset,
    options?.witnessIds?.join(","),
    options?.scripts?.join(","),
  ]);

  return { data, loading, error };
}

/**
 * Hook to fetch all witnesses for a project
 */
export function useWitnesses(projectId: string) {
  const [data, setData] = useState<Record<string, Witness>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [projectId]);

  return { data, loading, error };
}

/**
 * Hook to fetch classifier metadata for a project
 */
export function useClassifierMetadata(projectId: string) {
  const [data, setData] = useState<ClassifierMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [projectId]);

  return { data, loading, error };
}

/**
 * Hook to fetch all data for a project at once
 * Useful for initial load
 */
export function useProjectData(projectId: string) {
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
  }, [projectId]);

  return { data, loading, error };
}
