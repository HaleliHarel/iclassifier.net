import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Download, AlertCircle, X } from "lucide-react";
import SidebarLayout from "@/components/SidebarLayout";
import NetworkGraph from "@/components/NetworkGraph";
import { downloadCanvasPNG, downloadCanvasSVG, downloadNetworkDataWorkbook } from "@/lib/networkExport";
import Citation from "@/components/Citation";
import ReportActions from "@/components/ReportActions";
import { cn } from "@/lib/utils";
import { useAvailableProjects } from "@/lib/api";
import { useCurrentProjectId } from "@/lib/projectContext";
import NotFound from "@/pages/NotFound";
import ClassifierLabel from "@/components/ClassifierLabel";
import { formatClassifierLabelText } from "@/lib/classifierLabel";
import { mdc2uni } from "@/lib/mdc2uni";
import { getThesaurusLabel } from "@/lib/thesauri";
import {
  projects,
  type Token,
  type Lemma,
  type Witness,
} from "@/lib/sampleData";

interface LemmaMultiSelectProps {
  lemmaData: Record<number, Lemma>;
  selectedLemmaIds: number[];
  onSelectionChange: (lemmaIds: number[]) => void;
}

function LemmaMultiSelect({
  lemmaData,
  selectedLemmaIds,
  onSelectionChange,
}: LemmaMultiSelectProps) {
  const [searchInput, setSearchInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allLemmas = useMemo(
    () => Object.values(lemmaData),
    [lemmaData]
  );

  const filteredLemmas = useMemo(() => {
    if (!searchInput.trim()) return allLemmas;

    const lowerSearch = searchInput.toLowerCase();
    return allLemmas.filter((lemma) =>
      lemma.transliteration.toLowerCase().includes(lowerSearch) ||
      lemma.meaning.toLowerCase().includes(lowerSearch)
    );
  }, [searchInput, allLemmas]);

  const selectedLemmas = useMemo(
    () =>
      selectedLemmaIds
        .map((id) => lemmaData[id])
        .filter(Boolean),
    [selectedLemmaIds, lemmaData]
  );

  const handleRemoveLemma = (lemmaId: number) => {
    onSelectionChange(
      selectedLemmaIds.filter((id) => id !== lemmaId)
    );
  };

  const handleAddLemma = (lemmaId: number) => {
    if (!selectedLemmaIds.includes(lemmaId)) {
      onSelectionChange([...selectedLemmaIds, lemmaId]);
    }
    setSearchInput("");
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      {/* Selected Lemmas Display */}
      {selectedLemmas.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedLemmas.map((lemma) => (
            <div
              key={lemma.id}
              className="inline-flex items-center gap-2 px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm"
            >
              <span><em className="italic">{lemma.transliteration}</em></span>
              <button
                onClick={() => handleRemoveLemma(lemma.id)}
                className="hover:text-teal-900 transition-colors"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search Input */}
      <input
        type="text"
        placeholder="Search lemmas by transliteration or meaning..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        onFocus={() => setIsOpen(true)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
      />

      {/* Dropdown List */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filteredLemmas.length === 0 ? (
            <div className="px-4 py-3 text-gray-500 text-sm text-center">
              No lemmas found
            </div>
          ) : (
            filteredLemmas.map((lemma) => (
              <button
                key={lemma.id}
                onClick={() => handleAddLemma(lemma.id)}
                disabled={selectedLemmaIds.includes(lemma.id)}
                className={cn(
                  "w-full px-4 py-2 text-left text-sm transition-colors border-b border-gray-100 last:border-b-0",
                  selectedLemmaIds.includes(lemma.id)
                    ? "bg-teal-50 text-teal-700 cursor-not-allowed opacity-50"
                    : "hover:bg-gray-100 text-gray-800"
                )}
              >
                <div className="font-medium"><em className="italic">{lemma.transliteration}</em></div>
                <div className="text-xs text-gray-500">
                  {lemma.meaning}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface WitnessMultiSelectProps {
  witnessData: Record<string, Witness>;
  selectedWitnessIds: string[];
  onSelectionChange: (witnessIds: string[]) => void;
  projectType?: string;
}

function WitnessMultiSelect({
  witnessData,
  selectedWitnessIds,
  onSelectionChange,
  projectType,
}: WitnessMultiSelectProps) {
  const [searchInput, setSearchInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allWitnesses = useMemo(
    () => Object.values(witnessData),
    [witnessData]
  );

  const filteredWitnesses = useMemo(() => {
    if (!searchInput.trim()) return allWitnesses;

    const lowerSearch = searchInput.toLowerCase();
    const scriptLabel = (script: string) =>
      getThesaurusLabel(projectType, "scripts", script) || script;
    return allWitnesses.filter((witness) =>
      witness.id.toLowerCase().includes(lowerSearch) ||
      witness.name.toLowerCase().includes(lowerSearch) ||
      witness.script.toLowerCase().includes(lowerSearch) ||
      scriptLabel(witness.script).toLowerCase().includes(lowerSearch)
    );
  }, [searchInput, allWitnesses, projectType]);

  const selectedWitnesses = useMemo(
    () =>
      selectedWitnessIds
        .map((id) => witnessData[id])
        .filter(Boolean),
    [selectedWitnessIds, witnessData]
  );

  const handleRemoveWitness = (witnessId: string) => {
    onSelectionChange(
      selectedWitnessIds.filter((id) => id !== witnessId)
    );
  };

  const handleAddWitness = (witnessId: string) => {
    if (!selectedWitnessIds.includes(witnessId)) {
      onSelectionChange([...selectedWitnessIds, witnessId]);
    }
    setSearchInput("");
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      {/* Selected Witnesses Display */}
      {selectedWitnesses.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedWitnesses.map((witness) => (
            <div
              key={witness.id}
              className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
            >
              <span>{witness.name || witness.id}</span>
              <button
                onClick={() => handleRemoveWitness(witness.id)}
                className="hover:text-purple-900 transition-colors"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search Input */}
      <input
        type="text"
        placeholder="Search sources by name or script type..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        onFocus={() => setIsOpen(true)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
      />

      {/* Dropdown List */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filteredWitnesses.length === 0 ? (
            <div className="px-4 py-3 text-gray-500 text-sm text-center">
              No sources found
            </div>
          ) : (
            filteredWitnesses.map((witness) => (
              <button
                key={witness.id}
                onClick={() => handleAddWitness(witness.id)}
                disabled={selectedWitnessIds.includes(witness.id)}
                className={cn(
                  "w-full px-4 py-2 text-left text-sm transition-colors border-b border-gray-100 last:border-b-0",
                  selectedWitnessIds.includes(witness.id)
                    ? "bg-purple-50 text-purple-700 cursor-not-allowed opacity-50"
                    : "hover:bg-gray-100 text-gray-800"
                )}
              >
                <div className="font-medium">{witness.name || witness.id}</div>
                <div className="text-xs text-gray-500">
                  {witness.name && <span className="mr-2">ID: {witness.id}</span>}
                  Script: {getThesaurusLabel(projectType, "scripts", witness.script) || witness.script}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface QueryFilter {
  project: string;
  lemmas: number[];
  witnesses: string[];
  scripts: string[];
  tokenType: "all" | "standalone" | "compound";
  classifierFilter: string;
  regexPattern: string;
}

interface NetworkNode {
  id: string;
  label: string;
  type: "classifier" | "lemma";
  isCenter?: boolean;
}

interface NetworkEdge {
  source: string;
  target: string;
  weight: number;
}

export default function QueryReport() {
  const navigate = useNavigate();
  const { projectId: urlProjectId } = useParams();
  const currentProjectId = useCurrentProjectId();
  
  // Fetch available projects
  const { data: availableProjectIds } = useAvailableProjects();

  // Map project IDs to project metadata
  const getAvailableProjects = useMemo(() => {
    return availableProjectIds
      .map((id) => projects.find((p) => p.id === id))
      .filter(Boolean) as typeof projects;
  }, [availableProjectIds]);

  // Determine initial project (URL param first, then first available, or fallback)
  const initialProject = useMemo(() => {
    if (urlProjectId) return urlProjectId;
    if (currentProjectId) return currentProjectId;
    if (getAvailableProjects.length > 0) return getAvailableProjects[0].id;
    return "ancient-egyptian";
  }, [urlProjectId, currentProjectId, getAvailableProjects]);

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    initialProject ? [initialProject] : []
  );

  const primaryProjectId = useMemo(() => {
    if (urlProjectId && selectedProjectIds.includes(urlProjectId)) {
      return urlProjectId;
    }
    if (currentProjectId && selectedProjectIds.includes(currentProjectId)) {
      return currentProjectId;
    }
    return selectedProjectIds[0] || initialProject;
  }, [selectedProjectIds, urlProjectId, currentProjectId, initialProject]);

  const [lemmaData, setLemmaData] = useState<Record<number, Lemma>>({});
  const [witnessData, setWitnessData] = useState<Record<string, Witness>>({});
  const [classifierMeanings, setClassifierMeanings] = useState<Record<string, string>>({});
  const [allScripts, setAllScripts] = useState<string[]>([]);
  const [allClassifiers, setAllClassifiers] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const selectedProjectInfo = projects.find((project) => project.id === primaryProjectId);

  const getClassifierBaseLabel = useMemo(() => {
    if (!selectedProjectInfo || selectedProjectInfo.type !== "hieroglyphic") {
      return (classifier: string) => classifier;
    }
    return (classifier: string) => {
      const glyph = mdc2uni[classifier] || classifier;
      return `${glyph} (${classifier})`;
    };
  }, [selectedProjectInfo]);

  const [filters, setFilters] = useState<QueryFilter>({
    project: primaryProjectId || "",
    lemmas: [],
    witnesses: [],
    scripts: [],
    tokenType: "all",
    classifierFilter: "",
    regexPattern: "",
  });
  const [showResults, setShowResults] = useState(false);
  const [regexError, setRegexError] = useState<string | null>(null);
  const [queryResults, setQueryResults] = useState<Token[]>([]);
  const [queryTotal, setQueryTotal] = useState(0);
  const [queryPage, setQueryPage] = useState(1);
  const RESULTS_PER_PAGE = 100;
  const [queryLoading, setQueryLoading] = useState(false);
  const queryNetworkCanvasRef = useRef<HTMLCanvasElement>(null);

  if (!selectedProjectInfo && !dataLoading) {
    return <NotFound />;
  }

  // Update filters.project when primary project changes
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      project: primaryProjectId || "",
    }));
  }, [primaryProjectId]);

  // Sync selection with URL/context changes
  useEffect(() => {
    const nextProject = urlProjectId || currentProjectId;
    if (!nextProject) return;
    setSelectedProjectIds((prev) => {
      if (prev.length === 0) return [nextProject];
      if (prev.length === 1 && prev[0] !== nextProject) return [nextProject];
      return prev;
    });
  }, [urlProjectId, currentProjectId]);

  // Update URL when project changes
  useEffect(() => {
    if (primaryProjectId) {
      const targetPath = `/project/${primaryProjectId}/query-report`;
      if (window.location.pathname !== targetPath) {
        navigate(targetPath, { replace: true });
      }
    }
  }, [primaryProjectId, navigate]);

  const regexExample = useMemo(() => {
    if (!selectedProjectInfo) return "^A|[A-Z]\\d+";
    if (selectedProjectInfo.type === "cuneiform") return "^DU|LU2";
    if (selectedProjectInfo.type === "chinese") return "水|火";
    if (selectedProjectInfo.type === "hieroglyphic") return "^A1|Z1";
    return "^A|[A-Z]\\d+";
  }, [selectedProjectInfo]);

  useEffect(() => {
    if (!primaryProjectId) return;
    let isActive = true;
    setDataLoading(true);
    setDataError(null);

    Promise.all([
      fetch(`/api/iclassifier/${primaryProjectId}/lemmas`).then((res) => res.json()),
      fetch(`/api/iclassifier/${primaryProjectId}/witnesses`).then((res) => res.json()),
      fetch(`/api/iclassifier/${primaryProjectId}/classifier-meanings`).then((res) => res.json()),
      fetch(`/api/iclassifier/${primaryProjectId}/scripts`).then((res) => res.json()),
      fetch(`/api/iclassifier/${primaryProjectId}/classifiers?limit=10000&offset=0`).then((res) => res.json()),
    ])
      .then(([lemmas, witnesses, meanings, scripts, classifiers]) => {
        if (!isActive) return;
        setLemmaData(lemmas || {});
        setWitnessData(witnesses || {});
        setClassifierMeanings(meanings || {});
        const scriptList = Array.isArray(scripts) ? scripts : [];
        const classifierList = Array.isArray(classifiers?.items) ? classifiers.items : [];
        setAllScripts(scriptList);
        setAllClassifiers([...classifierList].sort());
      })
      .catch((err) => {
        if (!isActive) return;
        setDataError(err instanceof Error ? err.message : "Failed to load data");
      })
      .finally(() => {
        if (!isActive) return;
        setDataLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [primaryProjectId]);

  // Extract classifiers from tokens
  const extractClassifiers = (mdc_w_markup: string | null | undefined): string[] => {
    if (!mdc_w_markup) return [];
    const classifierRegex = /~([A-Z0-9]+)~/g;
    const matches = [...mdc_w_markup.matchAll(classifierRegex)];
    return matches.map((m) => m[1]);
  };

  const runQuery = useCallback(async (page: number) => {
    if (!primaryProjectId) return;
    setRegexError(null);

    if (filters.regexPattern) {
      try {
        new RegExp(filters.regexPattern, "i");
      } catch (error) {
        setRegexError(
          `Invalid regex: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        setQueryResults([]);
        setQueryTotal(0);
        return;
      }
    }

    const params = new URLSearchParams();
    params.set("limit", String(RESULTS_PER_PAGE));
    params.set("offset", String((page - 1) * RESULTS_PER_PAGE));
    params.set("tokenType", filters.tokenType);
    if (filters.lemmas.length > 0) params.set("lemmas", filters.lemmas.join(","));
    if (filters.witnesses.length > 0) params.set("witnesses", filters.witnesses.join(","));
    if (filters.scripts.length > 0) params.set("scripts", filters.scripts.join(","));
    if (filters.classifierFilter) params.set("classifier", filters.classifierFilter);
    if (filters.regexPattern) params.set("regex", filters.regexPattern);

    setQueryLoading(true);
    try {
      const response = await fetch(`/api/iclassifier/${primaryProjectId}/query?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 400 && data?.error) {
          setRegexError(data.error);
        }
        setQueryResults([]);
        setQueryTotal(0);
        return;
      }
      setQueryResults(Array.isArray(data.items) ? data.items : []);
      setQueryTotal(Number(data.total || 0));
    } catch (error) {
      setQueryResults([]);
      setQueryTotal(0);
      setDataError(error instanceof Error ? error.message : "Failed to run query");
    } finally {
      setQueryLoading(false);
    }
  }, [primaryProjectId, filters, RESULTS_PER_PAGE]);

  useEffect(() => {
    if (!showResults) return;
    runQuery(queryPage);
  }, [showResults, queryPage, runQuery]);

  useEffect(() => {
    if (showResults) {
      setQueryPage(1);
    }
  }, [filters, showResults]);

  // Build semantic network from filtered results
  const networkData = useMemo(() => {
    const nodeMap = new Map<string, NetworkNode>();
    const edgeMap = new Map<string, { edge: NetworkEdge; count: number }>();

    queryResults.forEach((token) => {
      const lemmaId = token.lemma_id;
      const lemma = lemmaData[lemmaId];
      const classifiers = extractClassifiers(token.mdc_w_markup);

      // Add lemma node
      if (lemma) {
        const lemmaNodeId = `lemma-${lemmaId}`;
        if (!nodeMap.has(lemmaNodeId)) {
          nodeMap.set(lemmaNodeId, {
            id: lemmaNodeId,
            label: lemma.transliteration,
            type: "lemma",
          });
        }
      }

      // Add classifier nodes and edges
      classifiers.forEach((classifier) => {
        const classifierNodeId = `clf-${classifier}`;
        if (!nodeMap.has(classifierNodeId)) {
          const baseLabel = getClassifierBaseLabel(classifier);
          const label = formatClassifierLabelText(classifier, classifierMeanings, baseLabel);
          nodeMap.set(classifierNodeId, {
            id: classifierNodeId,
            label,
            type: "classifier",
          });
        }

        // Create edge between lemma and classifier
        if (lemma) {
          const edgeKey = [
            `lemma-${lemmaId}`,
            `clf-${classifier}`,
          ]
            .sort()
            .join("|");
          const existing = edgeMap.get(edgeKey);
          if (existing) {
            existing.count += 1;
          } else {
            edgeMap.set(edgeKey, {
              edge: {
                source: `lemma-${lemmaId}`,
                target: `clf-${classifier}`,
                weight: 1,
              },
              count: 1,
            });
          }
        }
      });
    });

    // Update edge weights
    const edges = Array.from(edgeMap.values()).map(({ edge, count }) => ({
      ...edge,
      weight: count,
    }));

    return {
      nodes: Array.from(nodeMap.values()),
      edges,
    };
  }, [queryResults, classifierMeanings, getClassifierBaseLabel, lemmaData]);

  const handleToggleLemma = (lemmaId: number) => {
    setFilters((prev) => ({
      ...prev,
      lemmas: prev.lemmas.includes(lemmaId)
        ? prev.lemmas.filter((id) => id !== lemmaId)
        : [...prev.lemmas, lemmaId],
    }));
  };

  const handleToggleScript = (script: string) => {
    setFilters((prev) => ({
      ...prev,
      scripts: prev.scripts.includes(script)
        ? prev.scripts.filter((s) => s !== script)
        : [...prev.scripts, script],
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      project: primaryProjectId,
      lemmas: [],
      witnesses: [],
      scripts: [],
      tokenType: "all",
      classifierFilter: "",
      regexPattern: "",
    });
    setShowResults(false);
    setRegexError(null);
    setQueryResults([]);
    setQueryTotal(0);
    setQueryPage(1);
  };

  const handleDownloadResults = () => {
    const headers = [
      "Token ID",
      "Lemma",
      "Transliteration",
      "Meaning",
      "MDC",
      "Source Text",
      "Script",
      "Classifiers",
    ];

    const rows = queryResults.map((token) => [
      token.id,
      lemmaData[token.lemma_id]?.transliteration || "",
      lemmaData[token.lemma_id]?.meaning || "",
      token.mdc,
      token.witness_id,
      witnessData[token.witness_id]?.script || "",
      extractClassifiers(token.mdc_w_markup).join(", "),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) =>
            typeof cell === "string" && cell.includes(",")
              ? `"${cell}"`
              : cell
          )
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `query-results-${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.max(1, Math.ceil(queryTotal / RESULTS_PER_PAGE));

  return (
    <SidebarLayout>
      <div className="max-w-7xl mx-auto" id="query-report-content">
        <div className="mb-8">
          <h1 className="text-4xl font-bold page-accent-text mb-2">
            iClassifier Advanced Query
          </h1>
          <p className="text-gray-600">
            Search tokens using regular expressions and visualize relationships
          </p>
        </div>
        {dataError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {dataError}
          </div>
        )}

        {/* Dataset Selector */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <label htmlFor="project-select" className="block text-sm font-semibold mb-3">
            Select datasets to query ({getAvailableProjects.length} available):
          </label>
          {dataLoading ? (
            <p className="text-sm text-gray-500">Loading projects...</p>
          ) : getAvailableProjects.length === 0 ? (
            <p className="text-sm text-red-500">No projects available. Please ensure database files are in the databases folder.</p>
          ) : (
            <select
              id="project-select"
              multiple
              value={selectedProjectIds}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions).map((option) => option.value);
                if (values.length === 0) {
                  const fallback = primaryProjectId || getAvailableProjects[0]?.id;
                  setSelectedProjectIds(fallback ? [fallback] : []);
                  return;
                }
                setSelectedProjectIds(values);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              size={Math.min(8, getAvailableProjects.length)}
            >
              {getAvailableProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
          {selectedProjectIds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedProjectIds.map((projectId) => {
                const project = projects.find((item) => item.id === projectId);
                const isCurrent = projectId === currentProjectId;
                return (
                  <span
                    key={projectId}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                  >
                    {project?.name || projectId}
                    {isCurrent && (
                      <span className="text-xs font-semibold text-red-600">
                        current project
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-black mb-6">
            Query Filters
          </h2>

          {/* Witness/Source Selection */}
          <div className="mb-6">
            <h3 className="font-semibold text-black mb-3">Subset Sources (Texts):</h3>
            <p className="text-sm text-gray-600 mb-3">
              Filter by the source text or artifact name and script type
            </p>
            <WitnessMultiSelect
              witnessData={witnessData}
              selectedWitnessIds={filters.witnesses}
              projectType={selectedProjectInfo?.type}
              onSelectionChange={(witnessIds) =>
                setFilters((prev) => ({ ...prev, witnesses: witnessIds }))
              }
            />
          </div>

          {/* Lemma Selection */}
          <div className="mb-6">
            <h3 className="font-semibold text-black mb-3">Subset Lemmas:</h3>
            <LemmaMultiSelect
              lemmaData={lemmaData}
              selectedLemmaIds={filters.lemmas}
              onSelectionChange={(lemmaIds) =>
                setFilters((prev) => ({ ...prev, lemmas: lemmaIds }))
              }
            />
          </div>

          {/* Script Selection */}
          <div className="mb-6">
            <h3 className="font-semibold text-black mb-3">Choose Script Types:</h3>
            <div className="flex flex-wrap gap-2">
              {allScripts.map((script) => (
                <button
                  key={script}
                  onClick={() => handleToggleScript(script)}
                  className={cn(
                    "px-3 py-2 rounded text-sm font-medium transition-colors",
                    filters.scripts.includes(script)
                      ? "bg-teal-600 text-white"
                      : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                  )}
                >
                  {getThesaurusLabel(selectedProjectInfo?.type, "scripts", script) || script}
                </button>
              ))}
            </div>
          </div>

          {/* Classifier Filter */}
          <div className="mb-6">
            <h3 className="font-semibold text-black mb-3">Filter by classifiers:</h3>
            <select
              value={filters.classifierFilter}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  classifierFilter: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Classifiers</option>
              {allClassifiers.map((classifier) => (
                <option key={classifier} value={classifier}>
                  {formatClassifierLabelText(
                    classifier,
                    classifierMeanings,
                    getClassifierBaseLabel(classifier)
                  )}
                </option>
              ))}
            </select>
          </div>

          {/* Regex Search */}
          <div className="mb-6 pb-6 border-t border-gray-200 pt-6">
            <h3 className="font-semibold text-black mb-3">
              Regular Expression Search
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Example for {selectedProjectInfo?.name || "this dataset"}:{" "}
              <code className="bg-gray-100 px-2 py-1 rounded text-xs">{regexExample}</code>
            </p>
            <input
              type="text"
              placeholder={`Enter regex pattern (e.g., ${regexExample})`}
              value={filters.regexPattern}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  regexPattern: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-sm"
            />
            {regexError && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="text-red-700 text-sm">{regexError}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowResults(true);
                setQueryPage(1);
              }}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
            >
              Run Query ({showResults ? queryTotal : 0} results)
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Results Section */}
        {showResults && (
          <>
            {queryLoading && (
              <div className="mb-4 text-sm text-gray-500">Running query…</div>
            )}
            {/* Semantic Network Visualization */}
            {queryResults.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
                <h2 className="text-xl font-semibold text-black mb-4">
                  Semantic Network (Classifier-Lemma Relationships)
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  Node size represents frequency; edges show classifier-lemma associations
                </p>
                {networkData.nodes.length > 0 ? (
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    <NetworkGraph
                      canvasRef={queryNetworkCanvasRef}
                      nodes={networkData.nodes.map(node => ({
                        id: node.id,
                        label: node.label,
                        color: node.type === 'lemma' ? '#e3f2fd' : '#fff3e0',
                        size: 20,
                      }))}
                      edges={networkData.edges.map(edge => ({
                        from: edge.source,
                        to: edge.target,
                        width: Math.min(edge.weight * 2, 10),
                      }))}
                      width={800}
                      height={500}
                    />
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500 px-4 pb-4">
                      <button
                        onClick={() => downloadCanvasPNG(queryNetworkCanvasRef.current, 96, "query-network-96dpi.png")}
                        className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition-colors text-sm"
                      >
                        PNG 96
                      </button>
                      <button
                        onClick={() => downloadCanvasPNG(queryNetworkCanvasRef.current, 300, "query-network-300dpi.png")}
                        className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition-colors text-sm"
                      >
                        PNG 300
                      </button>
                      <button
                        onClick={() => downloadCanvasSVG(queryNetworkCanvasRef.current, "query-network.svg")}
                        className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition-colors text-sm"
                      >
                        SVG
                      </button>
                      <button
                        onClick={() => downloadNetworkDataWorkbook(networkData.nodes, networkData.edges, "query-network-data.xls")}
                        className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition-colors text-sm"
                      >
                        Data
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-600 text-center py-8">
                    No semantic relationships found
                  </p>
                )}
              </div>
            )}

            {/* Results Table */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-black">
                  Query Results ({queryTotal} tokens)
                </h2>
                {queryResults.length > 0 && (
                  <button
                    onClick={handleDownloadResults}
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg font-medium hover:bg-black/90 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                )}
              </div>

              {queryResults.length === 0 ? (
                <p className="text-gray-600 text-center py-8">
                  No tokens match your query filters. Try adjusting your criteria.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-black text-white">
                        <th className="px-4 py-3 text-left">Token ID</th>
                        <th className="px-4 py-3 text-left">Lemma</th>
                        <th className="px-4 py-3 text-left">Meaning</th>
                        <th className="px-4 py-3 text-left">MDC</th>
                        <th className="px-4 py-3 text-left">Source Text</th>
                        <th className="px-4 py-3 text-left">Script</th>
                        <th className="px-4 py-3 text-left">Classifiers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queryResults.map((token, idx) => (
                        <tr
                          key={token.id}
                          className={cn(
                            "border-b border-gray-200",
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                          )}
                        >
                          <td className="px-4 py-3">{token.id}</td>
                          <td className="px-4 py-3 font-medium">
                            <em className="italic">{lemmaData[token.lemma_id]?.transliteration}</em>
                          </td>
                          <td className="px-4 py-3">
                            {lemmaData[token.lemma_id]?.meaning}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono">
                            {token.mdc}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">
                            {token.witness_id}
                          </td>
                          <td className="px-4 py-3">
                            {witnessData[token.witness_id]?.script}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {extractClassifiers(token.mdc_w_markup).map(
                                (classifier) => (
                                  <span
                                    key={classifier}
                                    className="px-2 py-1 bg-teal-100 text-teal-700 rounded text-xs font-medium"
                                  >
                                    <ClassifierLabel
                                      classifier={classifier}
                                      meanings={classifierMeanings}
                                      displayLabel={getClassifierBaseLabel(classifier)}
                                      className="text-teal-700"
                                      meaningClassName="text-teal-600/80"
                                    />
                                  </span>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    </table>
                  </div>
                  {queryTotal > RESULTS_PER_PAGE && (
                    <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                      <button
                        type="button"
                        onClick={() => setQueryPage((prev) => Math.max(1, prev - 1))}
                        disabled={queryPage === 1}
                        className={cn(
                          "px-3 py-1 rounded border",
                          queryPage === 1
                            ? "border-gray-200 text-gray-300 cursor-not-allowed"
                            : "border-gray-300 text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        Previous
                      </button>
                      <span>
                        Page {queryPage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQueryPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={queryPage >= totalPages}
                        className={cn(
                          "px-3 py-1 rounded border",
                          queryPage >= totalPages
                            ? "border-gray-200 text-gray-300 cursor-not-allowed"
                            : "border-gray-300 text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Citation Section */}
            <div className="max-w-7xl mx-auto">
              <Citation
                type="query"
                projectName={projects.find((p) => p.id === filters.project)?.name || "Unknown"}
                authors={projects.find((p) => p.id === filters.project)?.authors || "Unknown"}
                projectId={filters.project}
              />
            </div>

            {/* Action Buttons - Bottom */}
            <div className="mt-12 pt-8 border-t border-gray-300 flex justify-center gap-4">
              <ReportActions
                reportId="query-report-content"
                reportType="query"
                projectId={filters.project}
              />
            </div>
          </>
        )}
      </div>
    </SidebarLayout>
  );
}
