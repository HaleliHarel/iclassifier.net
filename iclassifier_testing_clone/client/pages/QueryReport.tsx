import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Download, AlertCircle, X, BarChart3, Info } from "lucide-react";
import SidebarLayout from "@/components/SidebarLayout";
import { downloadNetworkJPEG, downloadNetworkPNG, downloadNetworkSVGVector, downloadNetworkDataWorkbook } from "@/lib/networkExport";
import { fetchJseshBase64, getJseshImageUrl, getJseshRenderHeight } from "@/lib/jsesh";
import Citation from "@/components/Citation";
import ReportActions from "@/components/ReportActions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAvailableProjects } from "@/lib/api";
import { useCurrentProjectId } from "@/lib/projectContext";
import { useCompareNavigation } from "@/hooks/useCompareNavigation";
import { useProjectData } from "@/lib/dataProvider";
import NotFound from "@/pages/NotFound";
import ClassifierLabel from "@/components/ClassifierLabel";
import DisplayModeControls from "@/components/DisplayModeControls";
import { formatClassifierLabelText } from "@/lib/classifierLabel";
import { mdc2uni } from "@/lib/mdc2uni";
import { getThesaurusLabel } from "@/lib/thesauri";
import { mergeClassifierMeaningsWithFallback } from "@/lib/classifierMeaningFallback";
import { formatClassifierMeaning, formatClassifierMeaningLabel } from "@/lib/classifierMeaningFormat";
import { getLuwianGlyphSvgPath } from "@/lib/luwianGlyphs";
import { apiUrl } from "@/lib/apiBase";
import {
  createMapNetworkAll,
  createMapNetworkByLevelAndType,
  buildClassifierMapsFromMetadata,
  extractLemmaTranslation,
  formatLemmaOriginLabelItalic,
  formatLemmaOriginTranslationLabel,
  formatLemmaTranslationLabel,
  getLemmaNodeFontFace,
  extractClassifiersFromString,
  getNetworkOptions,
  scaleEdgeWidths,
  JSESH_NODE_COLOR,
  LEMMA_CLASSIFIER_EDGE_COLOR,
  CLASSIFIER_COOCCURRENCE_EDGE_COLOR,
  buildPosColorMap,
  fetchExtendedSignDataUrl,
  CLF_NODE_WIDTH,
  CLF_NODE_HEIGHT,
  CLF_NODE_RADIUS,
  wrapClassifierImage,
} from "@/lib/networkUtils";
import {
  CLASSIFIER_LEVEL_LABELS,
  CLASSIFIER_TYPE_LABELS_WITH_ANYTHING,
  projects,
  unifiedEgyptianProjects,
  resolveNetworkDefaults,
  type Token,
  type Lemma,
  type Witness,
} from "@/lib/sampleData";

// Dynamically import vis-network for client-side rendering
let VisNetwork: any = null;
let VisDataSet: any = null;
const classifierImageCache = new Map<string, string>(); // cache extended/JSesh images by MDC
const BROKEN_IMAGE_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'/%3E";
const getInteractionByFrozenState = (frozen: boolean) => ({
  dragNodes: !frozen,
  dragView: !frozen,
  zoomView: !frozen,
});
const UNIFIED_EGYPTIAN_PROJECT_ID = "ancient-egyptian";

interface LemmaMultiSelectProps {
  lemmaData: Record<number, Lemma>;
  selectedLemmaIds: number[];
  onSelectionChange: (lemmaIds: number[]) => void;
}

const SEMANTIC_FIELD_PALETTE = [
  "#2563eb",
  "#22c55e",
  "#f5c842",
  "#ec4899",
  "#ef4444",
  "#93c5fd",
  "#86efac",
  "#f6d47a",
  "#fbcfe8",
  "#fca5a5",
  "#1d4ed8",
  "#16a34a",
  "#eab927",
  "#db2777",
  "#dc2626",
  "#60a5fa"
];

const UNKNOWN_LEXICAL_FIELD = "Unspecified";

const splitLexicalFieldValue = (rawValue: string) => {
  return rawValue
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const getLemmaLexicalFields = (lemma: Lemma) => {
  const rawValue = String(
    lemma.lexical_field || (lemma as any).semantic || lemma.concept || ""
  ).trim();
  if (!rawValue) return [];
  return splitLexicalFieldValue(rawValue);
};

const PROPER_NAME_POS = new Set(["PN", "TN", "DN"]);

const splitPosTokens = (rawValue: string) => {
  return rawValue
    .toUpperCase()
    .split(/[^A-Z]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const isProperNamePos = (value?: string | null) => {
  if (!value) return false;
  return splitPosTokens(String(value)).some((token) => PROPER_NAME_POS.has(token));
};

const hasProperNameMarker = (lemma: Lemma) => {
  const text = `${lemma.meaning || ""} ${lemma.lexical_field || ""}`.toUpperCase();
  return /\b(PN|TN|DN)\b/.test(text);
};

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
              className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
            >
              <span><em className="italic">{lemma.transliteration}</em></span>
              <button
                onClick={() => handleRemoveLemma(lemma.id)}
                className="hover:text-blue-900 transition-colors"
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
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Dropdown List */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filteredLemmas.length === 0 ? (
            <div className="px-3 py-3 text-gray-500 text-sm text-center">
              No lemmas found
            </div>
          ) : (
            filteredLemmas.map((lemma) => (
              <button
                key={lemma.id}
                onClick={() => handleAddLemma(lemma.id)}
                disabled={selectedLemmaIds.includes(lemma.id)}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm transition-colors border-b border-gray-100 last:border-b-0",
                  selectedLemmaIds.includes(lemma.id)
                    ? "bg-blue-50 text-blue-700 cursor-not-allowed opacity-50"
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
              className="inline-flex items-center gap-2 px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-sm"
            >
              <span>{witness.name || witness.id}</span>
              <button
                onClick={() => handleRemoveWitness(witness.id)}
                className="hover:text-pink-900 transition-colors"
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
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Dropdown List */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filteredWitnesses.length === 0 ? (
            <div className="px-3 py-3 text-gray-500 text-sm text-center">
              No sources found
            </div>
          ) : (
            filteredWitnesses.map((witness) => (
              <button
                key={witness.id}
                onClick={() => handleAddWitness(witness.id)}
                disabled={selectedWitnessIds.includes(witness.id)}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm transition-colors border-b border-gray-100 last:border-b-0",
                  selectedWitnessIds.includes(witness.id)
                    ? "bg-pink-50 text-pink-700 cursor-not-allowed opacity-50"
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
  posFilter: string;
  commentFilter: string;
}

export default function QueryReport() {
  const navigate = useNavigate();
  const location = useLocation();
  const isComparisonRoute = location.pathname.startsWith("/compare/");
  const { projectId: urlProjectId } = useParams();
  const currentProjectId = useCurrentProjectId();
  const { setCompareTarget } = useCompareNavigation();
  
  // State for vis.js network
  const [visReady, setVisReady] = useState(false);
  const networkRef = useRef<HTMLDivElement>(null);
  const queryNetworkCardRef = useRef<HTMLDivElement>(null);
  const networkInstanceRef = useRef<any>(null);
  const [isQueryNetworkFullscreen, setIsQueryNetworkFullscreen] = useState(false);
  const semanticNetworkRef = useRef<HTMLDivElement>(null);
  const semanticNetworkCardRef = useRef<HTMLDivElement>(null);
  const semanticNetworkInstanceRef = useRef<any>(null);
  const semanticNetworkResizeObserverRef = useRef<ResizeObserver | null>(null);
  const queryNetworkResizeObserverRef = useRef<ResizeObserver | null>(null);
  const [isSemanticNetworkFullscreen, setIsSemanticNetworkFullscreen] = useState(false);
  const queryNetworkFullscreenActive =
    typeof document !== "undefined" && document.fullscreenElement === queryNetworkCardRef.current
      ? isQueryNetworkFullscreen
      : false;
  const semanticNetworkFullscreenActive =
    typeof document !== "undefined" && document.fullscreenElement === semanticNetworkCardRef.current
      ? isSemanticNetworkFullscreen
      : false;

  // Initialize vis.js
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('vis-network/standalone').then((vis) => {
        VisNetwork = vis.Network;
        VisDataSet = vis.DataSet;
        setVisReady(true);
      });
    }
  }, []);

  const goFullscreen = useCallback((element: HTMLDivElement | null) => {
    if (element && element.requestFullscreen) {
      element.requestFullscreen();
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsQueryNetworkFullscreen(document.fullscreenElement === queryNetworkCardRef.current);
      setIsSemanticNetworkFullscreen(document.fullscreenElement === semanticNetworkCardRef.current);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.fullscreenElement === queryNetworkCardRef.current) {
        exitFullscreen();
      }
      if (document.fullscreenElement === semanticNetworkCardRef.current) {
        exitFullscreen();
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleKeyDown);
    handleFullscreenChange();
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [exitFullscreen]);

  useEffect(() => {
    if (!networkInstanceRef.current) return;
    if (typeof networkInstanceRef.current.setSize === "function") {
      networkInstanceRef.current.setSize("100%", "100%");
    }
    if (typeof networkInstanceRef.current.redraw === "function") {
      networkInstanceRef.current.redraw();
    }
  }, [queryNetworkFullscreenActive]);

  useEffect(() => {
    if (!semanticNetworkInstanceRef.current) return;
    if (typeof semanticNetworkInstanceRef.current.setSize === "function") {
      semanticNetworkInstanceRef.current.setSize("100%", "100%");
    }
    if (typeof semanticNetworkInstanceRef.current.redraw === "function") {
      semanticNetworkInstanceRef.current.redraw();
    }
  }, [semanticNetworkFullscreenActive]);
  
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
  const unifiedDefaultsAppliedRef = useRef(false);

  const unifiedEgyptianProjectIds = useMemo(
    () => unifiedEgyptianProjects.map((project) => project.id),
    []
  );
  const availableProjectIdSet = useMemo(
    () => new Set(getAvailableProjects.map((project) => project.id)),
    [getAvailableProjects]
  );
  const unifiedSelectedProjectIds = useMemo(() => {
    const ids = [UNIFIED_EGYPTIAN_PROJECT_ID, ...unifiedEgyptianProjectIds];
    if (availableProjectIdSet.size === 0) return ids;
    return ids.filter((id) => availableProjectIdSet.has(id));
  }, [availableProjectIdSet, unifiedEgyptianProjectIds]);

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
  const networkDefaults = useMemo(
    () => resolveNetworkDefaults(selectedProjectInfo || undefined),
    [selectedProjectInfo]
  );

  const openLemma = useCallback(
    (lemmaId: string | number) => {
      const numericId = typeof lemmaId === "number" ? lemmaId : parseInt(String(lemmaId), 10);
      if (setCompareTarget({ type: "lemma", lemmaId: Number.isFinite(numericId) ? numericId : undefined })) return;
      if (!primaryProjectId) return;
      navigate(`/project/${primaryProjectId}/lemma/${lemmaId}`);
    },
    [navigate, primaryProjectId, setCompareTarget]
  );

  const openClassifier = useCallback(
    (classifier: string) => {
      if (setCompareTarget({ type: "classifier", classifier })) return;
      if (!primaryProjectId) return;
      navigate(`/project/${primaryProjectId}/classifier?classifier=${encodeURIComponent(classifier)}`);
    },
    [navigate, primaryProjectId, setCompareTarget]
  );

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
    posFilter: "",
    commentFilter: "",
  });
  const [showResults, setShowResults] = useState(false);
  const [regexError, setRegexError] = useState<string | null>(null);
  const [queryResults, setQueryResults] = useState<Token[]>([]);
  const [queryTotal, setQueryTotal] = useState(0);
  const [queryPage, setQueryPage] = useState(1);
  const RESULTS_PER_PAGE = 100;
  const [queryLoading, setQueryLoading] = useState(false);
  const [useUnicode, setUseUnicode] = useState(networkDefaults.useUnicode);
  const [classifierDisplayMode, setClassifierDisplayMode] = useState<"visual" | "meaning">("visual");
  const [lemmaDisplayMode, setLemmaDisplayMode] = useState<"origin" | "translation" | "both">("both");
  const [lemmaColorMode, setLemmaColorMode] = useState<"default" | "pos">("default");
  const [clfLevels, setClfLevels] = useState<Set<number>>(new Set(networkDefaults.clfLevels));
  const [clfTypes, setClfTypes] = useState<Set<string>>(new Set(networkDefaults.clfTypes));
  const [useAllData, setUseAllData] = useState(networkDefaults.useAllData);
  const [semanticFieldView, setSemanticFieldView] = useState<"distribution" | "network">("distribution");
  const [semanticFieldMaxFields, setSemanticFieldMaxFields] = useState(12);
  const [semanticFieldMaxLemmas, setSemanticFieldMaxLemmas] = useState(30);
  const [semanticNetworkLoading, setSemanticNetworkLoading] = useState(false);
  const [isSemanticNetworkFrozen, setIsSemanticNetworkFrozen] = useState(false);
  const [excludeProperNames, setExcludeProperNames] = useState(true);

  const fullDataProjectId = showResults && primaryProjectId ? primaryProjectId : "";
  const { data: fullProjectData } = useProjectData(fullDataProjectId);
  const { clfData, clfParseData } = useMemo(
    () => buildClassifierMapsFromMetadata(fullProjectData?.classifiers || []),
    [fullProjectData?.classifiers]
  );
  const properNameLemmaIds = useMemo(() => {
    const ids = new Set<number>();
    const tokenSource = fullProjectData?.tokens || {};
    Object.values(tokenSource).forEach((token: any) => {
      const lemmaId = Number(token?.lemma_id);
      if (!Number.isFinite(lemmaId)) return;
      if (isProperNamePos(token?.pos)) {
        ids.add(lemmaId);
      }
    });
    Object.values(lemmaData).forEach((lemma) => {
      if (hasProperNameMarker(lemma)) {
        ids.add(lemma.id);
      }
    });
    return ids;
  }, [fullProjectData?.tokens, lemmaData]);
  const posLegendData = useMemo(() => {
    const posSet = new Set<string>();
    const lemmaPosCounts: Record<number, Record<string, number>> = {};
    const sourceTokens = useAllData && fullProjectData?.tokens
      ? Object.values(fullProjectData.tokens)
      : queryResults;

    sourceTokens.forEach((token: any) => {
      if (!token) return;
      const lemmaId = Number(token.lemma_id);
      if (!Number.isFinite(lemmaId)) return;
      const tokenPos = token?.pos === null || token?.pos === undefined
        ? ""
        : String(token.pos).trim();
      if (!tokenPos) return;
      posSet.add(tokenPos);
      if (!lemmaPosCounts[lemmaId]) {
        lemmaPosCounts[lemmaId] = {};
      }
      lemmaPosCounts[lemmaId][tokenPos] = (lemmaPosCounts[lemmaId][tokenPos] || 0) + 1;
    });

    const lemmaPosById: Record<number, string> = {};
    Object.entries(lemmaPosCounts).forEach(([lemmaId, counts]) => {
      const entries = Object.entries(counts);
      entries.sort((a, b) => {
        const diff = b[1] - a[1];
        if (diff !== 0) return diff;
        return a[0].localeCompare(b[0]);
      });
      if (entries.length > 0) {
        lemmaPosById[Number(lemmaId)] = entries[0][0];
      }
    });

    const posList = Array.from(posSet).sort((a, b) => a.localeCompare(b));
    return {
      lemmaPosById,
      posColorMap: buildPosColorMap(posList),
      posList
    };
  }, [useAllData, fullProjectData?.tokens, queryResults]);

  const semanticLemmaDisplayModeRef = useRef<"origin" | "translation" | "both">(lemmaDisplayMode);

  useEffect(() => {
    if (semanticFieldView !== "network") return;
    semanticLemmaDisplayModeRef.current = lemmaDisplayMode;
  }, [lemmaDisplayMode, semanticFieldView]);

  const classifierFontFace = useMemo(() => {
    if (selectedProjectInfo?.type === "cuneiform") return "cuneiform";
    if (selectedProjectInfo?.type === "chinese") return "Noto Sans TC";
    if (selectedProjectInfo?.type === "hieroglyphic") {
      return useUnicode ? "eot" : "hierofont";
    }
    return "sans-serif";
  }, [selectedProjectInfo?.type, useUnicode]);

  const lemmaFontFace = useMemo(() => {
    return getLemmaNodeFontFace(selectedProjectInfo?.type);
  }, [selectedProjectInfo?.type]);

  const semanticFieldStats = useMemo(() => {
    const counts: Record<string, number> = {};
    const lemmasByField: Record<string, Lemma[]> = {};
    let totalLemmas = 0;

    Object.values(lemmaData).forEach((lemma) => {
      if (excludeProperNames && properNameLemmaIds.has(lemma.id)) {
        return;
      }
      const fields = getLemmaLexicalFields(lemma);
      const activeFields = fields.length > 0 ? fields : [UNKNOWN_LEXICAL_FIELD];
      activeFields.forEach((field) => {
        counts[field] = (counts[field] || 0) + 1;
        if (!lemmasByField[field]) {
          lemmasByField[field] = [];
        }
        lemmasByField[field].push(lemma);
      });
      totalLemmas += 1;
    });

    const sortedFields = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return { counts, lemmasByField, sortedFields, totalLemmas };
  }, [lemmaData, excludeProperNames, properNameLemmaIds]);

  const semanticFieldColors = useMemo(() => {
    const colorMap: Record<string, string> = {};
    semanticFieldStats.sortedFields.forEach(([field], index) => {
      colorMap[field] = SEMANTIC_FIELD_PALETTE[index % SEMANTIC_FIELD_PALETTE.length];
    });
    return colorMap;
  }, [semanticFieldStats.sortedFields]);

  const semanticFieldMaxCount = semanticFieldStats.sortedFields[0]?.[1] || 0;

  const semanticFieldNetworkData = useMemo(() => {
    const fields = semanticFieldStats.sortedFields
      .slice(0, semanticFieldMaxFields)
      .map(([field]) => field);

    if (fields.length === 0) {
      return { nodes: [], edges: [], fields };
    }

    const nodes: any[] = [];
    const edges: any[] = [];
    const lemmaNodes = new Set<string>();

    fields.forEach((field) => {
      const color = semanticFieldColors[field] || "#9ca3af";
      nodes.push({
        id: `field_${field}`,
        label: field,
        color: { background: color, border: color },
        font: { color: "#000000", size: 12, face: "sans-serif", align: "center", valign: "middle" },
        size: 30,
        shape: "box",
        widthConstraint: { minimum: 80, maximum: 180 },
        type: "field"
      });

      const lemmas = semanticFieldStats.lemmasByField[field] || [];
      lemmas.slice(0, semanticFieldMaxLemmas).forEach((lemma) => {
        const nodeId = `lemma_${lemma.id}`;
        if (!lemmaNodes.has(nodeId)) {
          const translation = extractLemmaTranslation(lemma.meaning);
          const label = lemmaDisplayMode === "both"
            ? formatLemmaOriginTranslationLabel(lemma.meaning, lemma.transliteration, String(lemma.id), selectedProjectInfo?.type)
            : lemmaDisplayMode === "translation"
              ? formatLemmaTranslationLabel(lemma.meaning, lemma.transliteration, String(lemma.id), selectedProjectInfo?.type)
              : formatLemmaOriginLabelItalic(lemma.transliteration, String(lemma.id), selectedProjectInfo?.type);
          const tooltipParts = [
            lemma.transliteration || String(lemma.id),
            translation ? `-> ${translation}` : "",
            field !== UNKNOWN_LEXICAL_FIELD ? `Field: ${field}` : "Field: Unspecified",
            lemma.concept ? `Concept: ${lemma.concept}` : ""
          ].filter(Boolean);

          nodes.push({
            id: nodeId,
            label,
            color: { background: "white", border: "black" },
            font: {
              color: "#000000",
              size: 11,
              face: lemmaFontFace,
              align: "center",
              valign: "top",
              multi: /<[^>]+>/.test(label) ? "html" : true
            },
            size: 16,
            shape: "circle",
            type: "lemma",
            title: tooltipParts.join("\n")
          });
          lemmaNodes.add(nodeId);
        }

        edges.push({
          from: `field_${field}`,
          to: nodeId,
          width: 1,
          color: { color, opacity: 0.35 }
        });
      });
    });

    return { nodes, edges, fields };
  }, [
    semanticFieldStats,
    semanticFieldColors,
    semanticFieldMaxFields,
    semanticFieldMaxLemmas,
    lemmaDisplayMode,
    lemmaFontFace
  ]);

  const unclassifiedLemmaIds = useMemo(() => {
    if (!showResults || !fullProjectData?.tokens) return [];
    const lemmaIds = new Set<number>();
    const lemmaWithClassifier = new Set<number>();

    Object.values(fullProjectData.tokens).forEach((token) => {
      if (!token) return;
      const lemmaId = Number(token.lemma_id);
      if (!Number.isFinite(lemmaId)) return;
      lemmaIds.add(lemmaId);
      const classifiers = extractClassifiersFromString(token.mdc_w_markup || null);
      if (classifiers.length > 0) {
        lemmaWithClassifier.add(lemmaId);
      }
    });

    const results: number[] = [];
    lemmaIds.forEach((lemmaId) => {
      if (!lemmaWithClassifier.has(lemmaId)) {
        results.push(lemmaId);
      }
    });

    return results.sort((a, b) => a - b);
  }, [showResults, fullProjectData?.tokens]);

  if (!selectedProjectInfo && !dataLoading) {
    return <NotFound />;
  }

  useEffect(() => {
    setUseUnicode(networkDefaults.useUnicode);
    setClfLevels(new Set(networkDefaults.clfLevels));
    setClfTypes(new Set(networkDefaults.clfTypes));
    setUseAllData(networkDefaults.useAllData);
  }, [networkDefaults]);

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

  useEffect(() => {
    if (unifiedDefaultsAppliedRef.current) return;
    if (getAvailableProjects.length === 0) return;
    const preferredProject = urlProjectId || currentProjectId || initialProject;
    if (preferredProject !== UNIFIED_EGYPTIAN_PROJECT_ID) return;
    setSelectedProjectIds((prev) => {
      if (prev.length > 1) return prev;
      return unifiedSelectedProjectIds.length > 0 ? unifiedSelectedProjectIds : prev;
    });
    unifiedDefaultsAppliedRef.current = true;
  }, [
    getAvailableProjects.length,
    unifiedSelectedProjectIds,
    urlProjectId,
    currentProjectId,
    initialProject
  ]);

  // Update URL when project changes
  useEffect(() => {
    if (!location.pathname.includes("/query-report")) return;
    if (primaryProjectId) {
      const targetPath = `/project/${primaryProjectId}/query-report`;
      if (window.location.pathname !== targetPath) {
        navigate(targetPath, { replace: true });
      }
    }
  }, [primaryProjectId, navigate, location.pathname]);

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
      fetch(apiUrl(`/iclassifier/${primaryProjectId}/lemmas`)).then((res) => res.json()),
      fetch(apiUrl(`/iclassifier/${primaryProjectId}/witnesses`)).then((res) => res.json()),
      fetch(apiUrl(`/iclassifier/${primaryProjectId}/classifier-meanings`)).then((res) => res.json()),
      fetch(apiUrl(`/iclassifier/${primaryProjectId}/scripts`)).then((res) => res.json()),
      fetch(apiUrl(`/iclassifier/${primaryProjectId}/classifiers?limit=10000&offset=0`)).then((res) => res.json()),
    ])
      .then(([lemmas, witnesses, meanings, scripts, classifiers]) => {
        if (!isActive) return;
        setLemmaData(lemmas || {});
        setWitnessData(witnesses || {});
        setClassifierMeanings(
          mergeClassifierMeaningsWithFallback({
            projectId: primaryProjectId,
            projectType: selectedProjectInfo?.type,
            classifierMeanings: meanings || {},
            lemmas: lemmas || {}
          })
        );
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
    return extractClassifiersFromString(mdc_w_markup || null);
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
    if (filters.posFilter) params.set("pos", filters.posFilter);
    if (filters.commentFilter) params.set("comment", filters.commentFilter);

    setQueryLoading(true);
    try {
      const response = await fetch(apiUrl(`/iclassifier/${primaryProjectId}/query?${params.toString()}`));
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

  // Build semantic network from filtered results using map-network format
  const networkData = useMemo(() => {
    if (!showResults || queryResults.length === 0) {
      return { nodes: [], edges: [], edgeScale: 1 };
    }

    const tokenMap: Record<number, Token> = {};
    queryResults.forEach((token) => {
      tokenMap[token.id] = token;
    });

    const config = {
      useUnicode,
      classifierDisplayMode,
      lemmaDisplayMode,
      lemmaColorMode,
      classifierFontFace,
      lemmaFontFace,
      projectId: primaryProjectId,
      projectType: selectedProjectInfo?.type,
      classifierMeanings,
      clfLevels,
      clfTypes,
      classifierNodeSize: CLF_NODE_HEIGHT,
      classifierNodeWidth: CLF_NODE_WIDTH,
      classifierNodeHeight: CLF_NODE_HEIGHT,
      classifierNodeRadius: CLF_NODE_RADIUS,
      lemmaPosById: posLegendData.lemmaPosById,
      posColorMap: posLegendData.posColorMap
    };
    const hasClassifierMeta =
      Object.keys(clfData).length > 0 && Object.keys(clfParseData).length > 0;
    const shouldUseAllData = useAllData || !hasClassifierMeta;
    const tokenSource = fullProjectData?.tokens || tokenMap;
    const mapNetwork = shouldUseAllData
      ? createMapNetworkAll(tokenSource, lemmaData, witnessData, config)
      : createMapNetworkByLevelAndType(tokenSource, lemmaData, witnessData, clfData, clfParseData, config);
    const nodes = [...mapNetwork.nodes];
    const edges = [...mapNetwork.edges];
    const existingNodeIds = new Set(nodes.map((node) => node.id));
    const lemmaClassifierPresence: Record<number, { hasClassified: boolean; hasUnclassified: boolean }> = {};

    Object.values(tokenSource).forEach((token: any) => {
      if (!token) return;
      const lemmaId = Number(token.lemma_id);
      if (!Number.isFinite(lemmaId)) return;
      const clfs = extractClassifiersFromString(token.mdc_w_markup || null);
      if (!lemmaClassifierPresence[lemmaId]) {
        lemmaClassifierPresence[lemmaId] = { hasClassified: false, hasUnclassified: false };
      }
      if (clfs.length > 0) {
        lemmaClassifierPresence[lemmaId].hasClassified = true;
      } else {
        lemmaClassifierPresence[lemmaId].hasUnclassified = true;
      }
    });

    const lemmasWithMixedClassification = new Set<number>();
    Object.entries(lemmaClassifierPresence).forEach(([lemmaId, status]) => {
      if (status.hasClassified && status.hasUnclassified) {
        lemmasWithMixedClassification.add(Number(lemmaId));
      }
    });

    edges.forEach((edge: any) => {
      const fromId = String(edge.from);
      const toId = String(edge.to);
      const lemmaId = fromId.startsWith("lemma_")
        ? Number(fromId.replace("lemma_", ""))
        : toId.startsWith("lemma_")
          ? Number(toId.replace("lemma_", ""))
          : null;
      if (lemmaId !== null && lemmasWithMixedClassification.has(lemmaId)) {
        edge.dashes = true;
      }
    });

    const addLemmaNode = (lemmaId: number) => {
      const nodeId = `lemma_${lemmaId}`;
      if (existingNodeIds.has(nodeId)) return;
      const lemma = lemmaData[lemmaId] || fullProjectData?.lemmas?.[lemmaId];
      if (!lemma) return;

      const lemmaLabel = lemmaDisplayMode === "both"
        ? formatLemmaOriginTranslationLabel(lemma.meaning, lemma.transliteration, `${lemmaId}`, selectedProjectInfo?.type)
        : lemmaDisplayMode === "translation"
          ? formatLemmaTranslationLabel(lemma.meaning, lemma.transliteration, `${lemmaId}`, selectedProjectInfo?.type)
          : formatLemmaOriginLabelItalic(lemma.transliteration, `${lemmaId}`, selectedProjectInfo?.type);

      const posColor =
        lemmaColorMode === "pos" && posLegendData.lemmaPosById[lemmaId]
          ? posLegendData.posColorMap[posLegendData.lemmaPosById[lemmaId]]
          : null;
      const lemmaBackground = posColor || "white";
    const lemmaBorder = posColor ? "#000000" : "black";
      const lemmaTitle = posColor && posLegendData.lemmaPosById[lemmaId]
        ? `POS: ${posLegendData.lemmaPosById[lemmaId]}\n\nClick: Toggle display mode | Double-click: Open lemma`
        : "Click: Toggle display mode | Double-click: Open lemma";

      nodes.push({
        id: nodeId,
        label: lemmaLabel,
        color: { background: lemmaBackground, border: lemmaBorder },
        font: {
          color: "#000000",
          size: 12,
          face: lemmaFontFace,
          align: "center",
          valign: "top",
          multi: /<[^>]+>/.test(lemmaLabel) ? "html" : true
        },
        size: 20,
        shape: "circle",
        type: "lemma",
        title: lemmaTitle
      });
      existingNodeIds.add(nodeId);
    };

    const queryLemmaIds = new Set<number>();
    queryResults.forEach((token) => {
      const lemmaId = Number(token.lemma_id);
      if (!Number.isFinite(lemmaId)) return;
      queryLemmaIds.add(lemmaId);
    });
    queryLemmaIds.forEach(addLemmaNode);

    if (unclassifiedLemmaIds.length > 0) {
      unclassifiedLemmaIds.forEach((lemmaId) => {
        addLemmaNode(lemmaId);
      });
    }

    if (fullProjectData?.tokens) {
      const allClassifiers = new Set<string>();
      Object.values(fullProjectData.tokens).forEach((token: any) => {
        if (!token) return;
        const clfs = extractClassifiersFromString(token.mdc_w_markup || null);
        clfs.forEach((clf) => allClassifiers.add(clf));
      });
      allClassifiers.forEach((classifier) => {
        const nodeId = `classifier_${classifier}`;
        if (existingNodeIds.has(nodeId)) return;

        const meaning = classifierMeanings?.[classifier] || "";
        const meaningLabel = formatClassifierMeaningLabel(meaning, primaryProjectId, { html: true });
        const isHieroglyphic = selectedProjectInfo?.type === "hieroglyphic";
        const isLuwianProject = primaryProjectId === "luwiancorpus";
        const unicodeGlyph = useUnicode ? mdc2uni[classifier] : undefined;
        const hasUnicodeGlyph = isHieroglyphic && Boolean(unicodeGlyph);
        const luwianSvgPath =
          isLuwianProject && classifierDisplayMode === "visual"
            ? getLuwianGlyphSvgPath(classifier)
            : null;
        const luwianImage = luwianSvgPath ? wrapClassifierImage(luwianSvgPath) : null;
        let label = "";
        let fontFace = classifierFontFace;
        let fontSize = 12;

        if (classifierDisplayMode === "meaning") {
          label = meaningLabel || classifier;
          fontFace = "sans-serif";
          fontSize = 10;
        } else if (luwianImage) {
          label = "";
        } else if (hasUnicodeGlyph) {
          label = String(unicodeGlyph || "");
          fontSize = 18;
        } else {
          label = classifier;
          fontSize = 11;
        }

        const displayGlyph = hasUnicodeGlyph ? unicodeGlyph : classifier;
        const tooltipMeaning = formatClassifierMeaning(meaning, primaryProjectId);

        nodes.push({
          id: nodeId,
          label: label || "",
          mdc: classifier,
          color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
          font: {
            color: "#000000",
            size: fontSize,
            face: fontFace,
            align: "center",
            valign: "middle",
            multi: /<[^>]+>/.test(label) ? "html" : false
          },
          size: CLF_NODE_HEIGHT,
          shape: luwianImage ? "image" : "box",
          image: luwianImage || undefined,
          brokenImage: luwianImage ? BROKEN_IMAGE_PLACEHOLDER : undefined,
          shapeProperties: luwianImage
            ? { borderDashes: false, useBorderWithImage: false, interpolation: false, useImageSize: true }
            : { borderRadius: CLF_NODE_RADIUS, borderDashes: false },
          widthConstraint: { minimum: CLF_NODE_WIDTH, maximum: CLF_NODE_WIDTH },
          heightConstraint: { minimum: CLF_NODE_HEIGHT, maximum: CLF_NODE_HEIGHT },
          type: "classifier",
          title: `${displayGlyph || classifier}${tooltipMeaning ? ` [${tooltipMeaning}]` : ""}\n\nClick: Toggle display mode | Double-click: Open classifier`
        });
        existingNodeIds.add(nodeId);
      });
    }

    const { edges: scaledEdges, scale } = scaleEdgeWidths(edges);
    return { nodes, edges: scaledEdges, edgeScale: scale };
  }, [
    showResults,
    primaryProjectId,
    queryResults,
    classifierMeanings,
    lemmaData,
    witnessData,
    selectedProjectInfo?.type,
    lemmaDisplayMode,
    lemmaColorMode,
    useUnicode,
    classifierDisplayMode,
    classifierFontFace,
    lemmaFontFace,
    clfLevels,
    clfTypes,
    useAllData,
    clfData,
    clfParseData,
    unclassifiedLemmaIds,
    fullProjectData?.lemmas,
    fullProjectData?.tokens,
    posLegendData,
    scaleEdgeWidths
  ]);

  // Network rendering function using vis.js (legacy approach)
  const renderNetwork = useCallback(async () => {
    if (!visReady || !networkRef.current || !VisNetwork || !VisDataSet || networkData.nodes.length === 0) {
      return;
    }

    // Destroy previous network instance before creating a new one
    if (networkInstanceRef.current) {
      networkInstanceRef.current.destroy();
      networkInstanceRef.current = null;
    }

    try {
      // Normalize nodes to keep vis.js happy when images are missing
      const normalizedNodes = networkData.nodes.map((node: any) => {
        const baseFont = node.font || {
          color: "#000000",
          size: 12,
          face: node.type === "classifier" ? classifierFontFace : lemmaFontFace,
          align: "center",
          valign: "middle"
        };
        return {
          ...node,
          label: node.label == null ? "" : String(node.label),
          font: baseFont,
          brokenImage: node.brokenImage || BROKEN_IMAGE_PLACEHOLDER,
          shapeProperties: {
            borderDashes: false,
            useBorderWithImage: false,
            interpolation: false,
            useImageSize: false,
            ...(node.shapeProperties || {})
          }
        };
      });

      // Create vis.js datasets
      const nodes = new VisDataSet(normalizedNodes);
      const edges = new VisDataSet(networkData.edges);
      
      const visNetworkData = { nodes, edges };

      // Network options (matching legacy configuration)
      const baseOptions = getNetworkOptions();
      const physicsIterations = isComparisonRoute ? 320 : 760;
      const edgeOptions = { ...(baseOptions.edges || {}) } as any;
      delete edgeOptions.length;
      const options = {
        ...baseOptions,
        physics: {
          stabilization: {
            iterations: physicsIterations,
            updateInterval: 25,
            fit: true
          }
        },
        layout: {
          randomSeed: 2,
          improvedLayout: false
        },
        nodes: {
          ...(baseOptions.nodes || {}),
          scaling: {
            min: 10,
            max: 34,
            label: { enabled: true, min: 10, max: 18 }
          },
          shapeProperties: {
            borderDashes: false,
            useBorderWithImage: false,
            interpolation: false,
            useImageSize: false
          }
        },
        edges: {
          ...edgeOptions,
          smooth: {
            enabled: true,
            type: "dynamic",
            roundness: 0.2
          },
          arrows: { to: { enabled: false } }
        }
      };

      // Create the network
      const network = new VisNetwork(networkRef.current, visNetworkData, options);
      networkInstanceRef.current = network;

      // Ensure the network container doesn't exceed parent bounds
      if (networkRef.current && networkRef.current.parentElement) {
        networkRef.current.parentElement.style.maxWidth = "100%";
        networkRef.current.parentElement.style.overflow = "hidden";
        networkRef.current.style.maxWidth = "100%";
        networkRef.current.style.overflow = "hidden";
      }

      // Set up resize observer for query network
      const setupQueryResizeObserver = () => {
        const container = networkRef.current?.parentElement || networkRef.current;
        if (!container || queryNetworkResizeObserverRef.current) return;

        queryNetworkResizeObserverRef.current = new ResizeObserver(() => {
          const width = container.clientWidth;
          const height = container.clientHeight;
          if (width > 0 && height > 0 && typeof network.setSize === "function") {
            network.setSize(`${width}px`, `${height}px`);
          }
        });
        queryNetworkResizeObserverRef.current.observe(container);
      };

      // Handle JSesh rendering for hieroglyphic classifiers (legacy approach)
      if (selectedProjectInfo?.type === "hieroglyphic" && classifierDisplayMode === "visual") {
        const classifierNodes = networkData.nodes.filter((node: any) => node.type === "classifier");
        console.log(`[Network] Processing ${classifierNodes.length} classifier nodes for JSesh rendering`);
        
        await Promise.all(
          classifierNodes.map(async (node: any) => {
            const mdc = node.mdc || node.label;
            console.log(`[Network] Processing classifier node: ${node.id}, mdc: ${mdc}`);

            const normalizedMdc = typeof mdc === "string" ? mdc.trim() : "";
            const glyph = normalizedMdc ? mdc2uni[normalizedMdc] : undefined;
            const hasUnicodeGlyph = typeof glyph === "string" && (glyph.codePointAt(0) || 0) >= 256;
            console.log(`[Network] ${mdc} - hasUnicodeGlyph: ${hasUnicodeGlyph}, useUnicode: ${useUnicode}`);

            // Use JSesh image if no Unicode glyph available OR if useUnicode is false
            if (!useUnicode || !hasUnicodeGlyph) {
              console.log(`[Network] Will fetch JSesh for ${mdc}`);
              const cacheKey = normalizedMdc;
              if (!cacheKey) return;
              const cached = cacheKey ? classifierImageCache.get(cacheKey) : null;
              const cachedImage = cached ? wrapClassifierImage(cached) : null;
              if (cachedImage) {
                console.log(`[Network] Using cached image for ${mdc}`);
                classifierImageCache.set(cacheKey, cachedImage);
                nodes.update({
                  id: node.id,
                  shape: "image",
                  image: cachedImage,
                  brokenImage: BROKEN_IMAGE_PLACEHOLDER,
                  label: "",
                  size: CLF_NODE_HEIGHT,
                  color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
                  shapeProperties: {
                    borderDashes: false,
                    useBorderWithImage: false,
                    interpolation: false,
                    useImageSize: true
                  },
                  widthConstraint: { minimum: CLF_NODE_WIDTH, maximum: CLF_NODE_WIDTH },
                  heightConstraint: { minimum: CLF_NODE_HEIGHT, maximum: CLF_NODE_HEIGHT }
                });
                return;
              }

              const extendedSignData = await fetchExtendedSignDataUrl(cacheKey);
              if (extendedSignData) {
                console.log(`[Network] Using extended sign data for ${mdc}`);
                const wrappedImage = wrapClassifierImage(extendedSignData);
                classifierImageCache.set(cacheKey, wrappedImage);
                nodes.update({
                  id: node.id,
                  shape: "image",
                  image: wrappedImage,
                  brokenImage: BROKEN_IMAGE_PLACEHOLDER,
                  label: "",
                  size: CLF_NODE_HEIGHT,
                  color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
                  shapeProperties: {
                    borderDashes: false,
                    useBorderWithImage: false,
                    interpolation: false,
                    useImageSize: true
                  },
                  widthConstraint: { minimum: CLF_NODE_WIDTH, maximum: CLF_NODE_WIDTH },
                  heightConstraint: { minimum: CLF_NODE_HEIGHT, maximum: CLF_NODE_HEIGHT }
                });
                return;
              }

              console.log(`[Network] Fetching JSesh base64 for ${mdc}`);
              const base64 = await fetchJseshBase64(cacheKey, getJseshRenderHeight(CLF_NODE_HEIGHT), true);
              if (base64) {
                console.log(`[Network] Got JSesh base64 (${base64.length} chars) for ${mdc}`);
                const url = wrapClassifierImage(getJseshImageUrl(base64));
                console.log(`[Network] Created wrapped image URL for ${mdc}:`, url.substring(0, 100) + '...');
                classifierImageCache.set(cacheKey, url);
                nodes.update({
                  id: node.id,
                  shape: "image",
                  image: url,
                  brokenImage: BROKEN_IMAGE_PLACEHOLDER,
                  label: "",
                  size: CLF_NODE_HEIGHT,
                  color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
                  shapeProperties: {
                    borderDashes: false,
                    useBorderWithImage: false,
                    interpolation: false,
                    useImageSize: true
                  },
                  widthConstraint: { minimum: CLF_NODE_WIDTH, maximum: CLF_NODE_WIDTH },
                  heightConstraint: { minimum: CLF_NODE_HEIGHT, maximum: CLF_NODE_HEIGHT }
                });
                console.log(`[Network] Updated node ${node.id} with JSesh image`);
              } else {
                console.warn(`[Network] Failed to get JSesh base64 for ${mdc}`);
              }
            } else {
              console.log(`[Network] Using Unicode glyph for ${mdc}: ${glyph}`);
            }
          })
        );
      }

      // Auto-fit and freeze after stabilization
      let finalized = false;
      const finalize = () => {
        if (finalized) return;
        finalized = true;

        // Set up resize observer
        setupQueryResizeObserver();

        if (typeof network.setSize === "function") {
          const container = networkRef.current;
          if (container) {
            const width = container.clientWidth || window.innerWidth;
            const height = container.clientHeight || 500;
            network.setSize(`${width}px`, `${height}px`);
          }
        }
        network.fit({ animation: { duration: 500, easingFunction: "easeInOutQuad" } });
      };
      
      const fallbackId = window.setTimeout(() => finalize(), 9000);
      network.once("stabilizationIterationsDone", () => {
        window.clearTimeout(fallbackId);
        finalize();
      });

      network.on("doubleClick", (params: any) => {
        if (params.nodes.length === 0) return;
        const nodeId = String(params.nodes[0]);
        if (nodeId.startsWith("classifier_")) {
          const classifier = nodeId.replace("classifier_", "");
          openClassifier(classifier);
        } else if (nodeId.startsWith("lemma_")) {
          const lemmaId = nodeId.replace("lemma_", "");
          openLemma(lemmaId);
        }
      });

    } catch (error) {
      console.error('Failed to render network:', error);
    }
  }, [
    visReady,
    networkData,
    selectedProjectInfo,
    useUnicode,
    classifierDisplayMode,
    lemmaDisplayMode,
    classifierFontFace,
    lemmaFontFace,
    isComparisonRoute,
    openClassifier,
    openLemma
  ]);

  // Re-render network when data changes
  useEffect(() => {
    renderNetwork();
    return () => {
      // Cleanup resize observers when unmounting or data changes
      if (queryNetworkResizeObserverRef.current) {
        queryNetworkResizeObserverRef.current.disconnect();
        queryNetworkResizeObserverRef.current = null;
      }
      if (semanticNetworkResizeObserverRef.current) {
        semanticNetworkResizeObserverRef.current.disconnect();
        semanticNetworkResizeObserverRef.current = null;
      }
    };
  }, [renderNetwork]);

  const semanticStabilizationIterations = isComparisonRoute ? 280 : 650;
  const semanticNetworkPhysics = useMemo(() => ({
    enabled: true,
    stabilization: { iterations: semanticStabilizationIterations, updateInterval: 25, fit: true }
  }), [semanticStabilizationIterations]);

  const semanticNetworkOptions = useMemo(() => {
    const baseOptions = getNetworkOptions();
    const edgeOptions = { ...(baseOptions.edges || {}) } as any;
    delete edgeOptions.length;
    return {
      layout: { improvedLayout: false },
      physics: semanticNetworkPhysics,
      nodes: {
        borderWidth: 1,
        scaling: {
          min: 10,
          max: 34,
          label: { enabled: true, min: 10, max: 18 }
        }
      },
      edges: {
        ...edgeOptions,
        smooth: { enabled: true, type: "dynamic", roundness: 0.2 }
      }
    };
  }, [semanticNetworkPhysics]);

  const toggleSemanticNetworkFreeze = useCallback(() => {
    const network = semanticNetworkInstanceRef.current;
    if (!network) return;
    if (isSemanticNetworkFrozen) {
      network.setOptions({
        physics: { ...semanticNetworkPhysics, enabled: true },
        interaction: getInteractionByFrozenState(false),
      });
      if (typeof network.startSimulation === "function") {
        network.startSimulation();
      }
      setIsSemanticNetworkFrozen(false);
    } else {
      if (typeof network.stopSimulation === "function") {
        network.stopSimulation();
      }
      network.setOptions({
        physics: { enabled: false },
        interaction: getInteractionByFrozenState(true),
      });
      setIsSemanticNetworkFrozen(true);
    }
  }, [isSemanticNetworkFrozen, semanticNetworkPhysics]);

  useEffect(() => {
    if (semanticFieldView !== "network") return;
    if (!visReady || !semanticNetworkRef.current || !VisNetwork || !VisDataSet) return;
    if (semanticFieldNetworkData.nodes.length === 0) return;

    if (semanticNetworkInstanceRef.current) {
      semanticNetworkInstanceRef.current.destroy();
      semanticNetworkInstanceRef.current = null;
    }

    setSemanticNetworkLoading(true);

    const nodes = new VisDataSet(semanticFieldNetworkData.nodes);
    const edges = new VisDataSet(semanticFieldNetworkData.edges);
    const network = new VisNetwork(semanticNetworkRef.current, { nodes, edges }, semanticNetworkOptions);
    semanticNetworkInstanceRef.current = network;
    setIsSemanticNetworkFrozen(false);
    network.setOptions({ interaction: getInteractionByFrozenState(false) });

    // Ensure the network container doesn't exceed parent bounds
    if (semanticNetworkRef.current && semanticNetworkRef.current.parentElement) {
      semanticNetworkRef.current.parentElement.style.maxWidth = "100%";
      semanticNetworkRef.current.parentElement.style.overflow = "hidden";
      semanticNetworkRef.current.style.maxWidth = "100%";
      semanticNetworkRef.current.style.overflow = "hidden";
    }

    // Set up resize observer for semantic network
    const setupSemanticResizeObserver = () => {
      const container = semanticNetworkRef.current?.parentElement || semanticNetworkRef.current;
      if (!container || semanticNetworkResizeObserverRef.current) return;

      semanticNetworkResizeObserverRef.current = new ResizeObserver(() => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width > 0 && height > 0 && typeof network.setSize === "function") {
          network.setSize(`${width}px`, `${height}px`);
        }
      });
      semanticNetworkResizeObserverRef.current.observe(container);
    };

    let finalized = false;
    const finalize = () => {
      if (finalized) return;
      finalized = true;

      // Set up resize observer
      setupSemanticResizeObserver();

      if (typeof network.setSize === "function") {
        const container = semanticNetworkRef.current;
        if (container) {
          const width = container.clientWidth || window.innerWidth;
          const height = container.clientHeight || 460;
          network.setSize(`${width}px`, `${height}px`);
        }
      }
      network.fit({ animation: { duration: 400, easingFunction: "easeInOutQuad" } });
      if (typeof network.stopSimulation === "function") {
        network.stopSimulation();
      }
      network.setOptions({
        physics: { enabled: false },
        interaction: getInteractionByFrozenState(true),
      });
      setIsSemanticNetworkFrozen(true);
      setSemanticNetworkLoading(false);
    };

    const fallbackId = window.setTimeout(() => finalize(), 9000);
    network.once("stabilizationIterationsDone", () => {
      window.clearTimeout(fallbackId);
      finalize();
    });

    let lastClickTime = 0;
    let clickTimeout: any = null;

    network.on("click", (params: any) => {
      if (params.nodes.length === 0) return;
      const nodeId = String(params.nodes[0]);
      const currentTime = Date.now();
      const isDoubleClick = currentTime - lastClickTime < 300;

      if (!isDoubleClick) {
        clickTimeout = window.setTimeout(() => {
          if (!nodeId.startsWith("lemma_")) return;
          const lemmaId = parseInt(nodeId.replace("lemma_", ""), 10);
          const lemma = lemmaData[lemmaId];
          if (!lemma) return;

          const newMode = semanticLemmaDisplayModeRef.current === "origin"
            ? "translation"
            : semanticLemmaDisplayModeRef.current === "translation"
              ? "both"
              : "origin";
          semanticLemmaDisplayModeRef.current = newMode;
          const newLabel = newMode === "both"
            ? formatLemmaOriginTranslationLabel(lemma.meaning, lemma.transliteration, String(lemmaId), selectedProjectInfo?.type)
            : newMode === "translation"
              ? formatLemmaTranslationLabel(lemma.meaning, lemma.transliteration, String(lemmaId), selectedProjectInfo?.type)
              : formatLemmaOriginLabelItalic(lemma.transliteration, String(lemmaId), selectedProjectInfo?.type);

          const nodes = network.body?.data?.nodes;
          if (nodes) {
            nodes.update({
              id: nodeId,
              label: newLabel,
              font: {
                color: "#000000",
                size: 11,
                face: lemmaFontFace,
                align: "center",
                valign: "top",
                multi: /<[^>]+>/.test(newLabel) ? "html" : true
              }
            });
          }
        }, 150);
      } else {
        if (clickTimeout) window.clearTimeout(clickTimeout);
        if (nodeId.startsWith("lemma_")) {
          const lemmaId = nodeId.replace("lemma_", "");
          openLemma(lemmaId);
        }
      }

      lastClickTime = currentTime;
    });
  }, [
    semanticFieldView,
    semanticFieldNetworkData,
    semanticNetworkOptions,
    semanticNetworkPhysics,
    visReady,
    primaryProjectId,
    navigate,
    lemmaData,
    lemmaFontFace
  ]);

  useEffect(() => {
    if (semanticFieldView === "network") return;
    const network = semanticNetworkInstanceRef.current;
    if (network) {
      if (typeof network.stopSimulation === "function") {
        network.stopSimulation();
      }
      network.setOptions({
        physics: { enabled: false },
        interaction: getInteractionByFrozenState(true),
      });
    }
    setIsSemanticNetworkFrozen(true);
  }, [semanticFieldView]);

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

  const toggleLevel = useCallback((level: number, checked: boolean) => {
    setClfLevels((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(level);
      } else {
        next.delete(level);
      }
      return next;
    });
  }, []);

  const toggleType = useCallback((type: string, checked: boolean) => {
    setClfTypes((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(type);
      } else {
        next.delete(type);
      }
      return next;
    });
  }, []);

  const handleClearFilters = () => {
    setFilters({
      project: primaryProjectId,
      lemmas: [],
      witnesses: [],
      scripts: [],
      tokenType: "all",
      classifierFilter: "",
      regexPattern: "",
      posFilter: "",
      commentFilter: "",
    });
    setClfLevels(new Set(networkDefaults.clfLevels));
    setClfTypes(new Set(networkDefaults.clfTypes));
    setUseAllData(networkDefaults.useAllData);
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
      <div className="max-w-[1600px] mx-auto" id="query-report-content">
        <div className="mb-6">
          <h1 className="text-4xl font-bold page-accent-text mb-2">
            <i>iClassifier</i> Advanced Query Builder
          </h1>
          <p className="text-gray-600">
            Create your own networks and reports querying across projects by using built in paramaters or by using the regular expressions search box
          </p>
        </div>
        {dataError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
            {dataError}
          </div>
        )}

        {/* Dataset Selector */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
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
                let values = Array.from(e.target.selectedOptions).map((option) => option.value);
                if (values.includes(UNIFIED_EGYPTIAN_PROJECT_ID)) {
                  const expanded = new Set(values);
                  unifiedSelectedProjectIds.forEach((id) => expanded.add(id));
                  values = Array.from(expanded);
                }
                if (values.length === 0) {
                  const fallback = primaryProjectId || getAvailableProjects[0]?.id;
                  setSelectedProjectIds(fallback ? [fallback] : []);
                  return;
                }
                setSelectedProjectIds(values);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <span className="text-xs font-semibold text-blue-700">
                      selected project
                    </span>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <h2 className="text-xl font-semibold text-black mb-4">
            Query Filters
          </h2>

          {/* Witness/Source Selection */}
          <div className="mb-4">
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
          <div className="mb-4">
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
          <div className="mb-4">
            <h3 className="font-semibold text-black mb-3">Choose Script Types:</h3>
            <div className="flex flex-wrap gap-2">
              {allScripts.map((script) => (
                <button
                  key={script}
                  onClick={() => handleToggleScript(script)}
                  className={cn(
                    "px-3 py-2 rounded text-sm font-medium transition-colors",
                    filters.scripts.includes(script)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                  )}
                >
                  {getThesaurusLabel(selectedProjectInfo?.type, "scripts", script) || script}
                </button>
              ))}
            </div>
          </div>

          {/* Classifier Filter */}
          <div className="mb-4">
            <h3 className="font-semibold text-black mb-3">Filter by classifiers:</h3>
            <select
              value={filters.classifierFilter}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  classifierFilter: e.target.value,
                }))
              }
              className={cn(
                "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                selectedProjectInfo?.type === "cuneiform" && "cuneiform-unicode"
              )}
            >
              <option value="">All Classifiers</option>
              {allClassifiers.map((classifier) => (
                <option key={classifier} value={classifier}>
                  {formatClassifierLabelText(
                    classifier,
                    classifierMeanings,
                    getClassifierBaseLabel(classifier),
                    primaryProjectId
                  )}
                </option>
              ))}
            </select>
          </div>

          {/* Token Annotation Filters */}
          <div className="mb-4">
            <h3 className="font-semibold text-black mb-3">Token annotation filters:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  POS tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={filters.posFilter}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      posFilter: e.target.value,
                    }))
                  }
                  placeholder="e.g., N, V, PN"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comments contains
                </label>
                <input
                  type="text"
                  value={filters.commentFilter}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      commentFilter: e.target.value,
                    }))
                  }
                  placeholder="e.g., determinative"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Comment search checks both token comments and sign comments.
            </p>
          </div>

          {/* Network Filters */}
          <div className="mb-4">
            <h3 className="font-semibold text-black mb-3">Network Filters</h3>
            <p className="text-sm text-gray-600 mb-3">
              These settings affect the semantic network only.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold">Information Types</span>
                  <button
                    onClick={() => window.open('/user-manual#information-types', '_blank')}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                    title="Learn more about Information Types"
                    type="button"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Select classifier information levels to include
                </p>
                <div className="space-y-2">
                  {CLASSIFIER_LEVEL_LABELS.map(([level, label]) => (
                    <div key={level} className="flex items-center space-x-2">
                      <Checkbox
                        id={`query-level-${level}`}
                        checked={clfLevels.has(level as number)}
                        onCheckedChange={(checked) => toggleLevel(level as number, checked as boolean)}
                        disabled={useAllData}
                      />
                      <Label
                        htmlFor={`query-level-${level}`}
                        className={cn("text-sm", useAllData && "text-gray-400")}
                      >
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold">Classifier Types</span>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Select classifier types to include
                </p>
                <div className="space-y-2">
                  {CLASSIFIER_TYPE_LABELS_WITH_ANYTHING.map(([type, label]) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`query-type-${type}`}
                        checked={clfTypes.has(type)}
                        onCheckedChange={(checked) => toggleType(type, checked as boolean)}
                        disabled={useAllData}
                      />
                      <Label
                        htmlFor={`query-type-${type}`}
                        className={cn("text-sm", useAllData && "text-gray-400")}
                      >
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center space-x-2">
              <Checkbox
                id="query-use-all-data"
                checked={useAllData}
                onCheckedChange={(checked) => setUseAllData(checked as boolean)}
              />
              <Label htmlFor="query-use-all-data" className="text-sm">
                Draw with all data (include unanalysed classifiers)
              </Label>
            </div>
            <div className="mt-3 flex items-center space-x-2">
              <Checkbox
                id="query-pos-color"
                checked={lemmaColorMode === "pos"}
                onCheckedChange={(checked) => setLemmaColorMode(checked ? "pos" : "default")}
              />
              <Label htmlFor="query-pos-color" className="text-sm">
                Color lemma nodes by POS gloss
              </Label>
            </div>
            {useAllData && (
              <p className="mt-2 text-xs text-gray-500">
                Classifier information filters are ignored when drawing with all data.
              </p>
            )}
          </div>

          {/* Regex Search */}
          <div className="mb-4 pb-4 border-t border-gray-200 pt-4">
            <h3 className="font-semibold text-black mb-3">
              Regular Expression Search Box
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Example for {selectedProjectInfo?.name || "this dataset"}:{" "}
              <code className="bg-gray-100 px-2 py-1 rounded text-xs">{regexExample}</code>
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Combine regex with the POS and comments filters above to target specific sequences and annotations.
            </p>
            <textarea
              placeholder={`Enter regex pattern (e.g., ${regexExample})`}
              value={filters.regexPattern}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  regexPattern: e.target.value,
                }))
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
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
                const shouldRunNow = showResults && queryPage === 1;
                setShowResults(true);
                setQueryPage(1);
                if (shouldRunNow) {
                  runQuery(1);
                }
              }}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Run Query ({showResults ? queryTotal : 0} results)
            </button>
            <button
              onClick={handleClearFilters}
              className="px-3 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Semantic Field Overview */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-black flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Semantic Field Overview
              </h2>
              <p className="text-sm text-gray-600">
                Lemma distribution by lexical field (from lemmas table). {semanticFieldStats.totalLemmas.toLocaleString()} lemmas | {semanticFieldStats.sortedFields.length} fields
              </p>
              <p className="text-xs text-gray-500 italic">
                *Counting general lexicon and excluding proper names (Toponyms, Personal names, Divine names).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                <Checkbox
                  checked={excludeProperNames}
                  onCheckedChange={(checked) => setExcludeProperNames(Boolean(checked))}
                />
                General lexicon only (exclude PN, TN, DN)
              </label>
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm">
                <button
                  onClick={() => setSemanticFieldView("distribution")}
                  className={cn(
                    "px-3 py-1 rounded-md font-medium transition-colors",
                    semanticFieldView === "distribution"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  Distribution
                </button>
                <button
                  onClick={() => setSemanticFieldView("network")}
                  className={cn(
                    "px-3 py-1 rounded-md font-medium transition-colors",
                    semanticFieldView === "network"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  <span>Field Map</span>
                </button>
              </div>
            </div>
          </div>

          {semanticFieldStats.sortedFields.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">
              No lexical field data found in the lemmas table for this project.
            </p>
          ) : semanticFieldView === "distribution" ? (
            <div className="mt-4 max-h-[420px] overflow-y-auto rounded-lg border border-gray-200 p-3 space-y-2">
              {semanticFieldStats.sortedFields.map(([field, count]) => {
                const width = semanticFieldMaxCount ? (count / semanticFieldMaxCount) * 100 : 0;
                const color = semanticFieldColors[field] || "#9ca3af";
                return (
                  <div key={field} className="flex items-center gap-3">
                    <div className="w-36 text-xs font-medium text-gray-700 truncate">
                      {field}
                    </div>
                    <div className="flex-1">
                      <div className="h-2 rounded-sm bg-gray-100">
                        <div
                          className="h-2 rounded-sm"
                          style={{ width: `${width}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 w-12 text-right">
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              ref={semanticNetworkCardRef}
              className={semanticNetworkFullscreenActive ? "mt-4 space-y-3 flex flex-col h-screen w-screen max-h-none max-w-none" : "mt-4 space-y-3"}
            >
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <label htmlFor="semantic-field-count" className="font-semibold text-gray-700">
                    Fields shown
                  </label>
                  <select
                    id="semantic-field-count"
                    value={semanticFieldMaxFields}
                    onChange={(e) => setSemanticFieldMaxFields(parseInt(e.target.value, 10))}
                    className="rounded border border-gray-200 bg-white px-2 py-1 text-xs"
                  >
                    {[6, 12, 20, 30].map((value) => (
                      <option key={value} value={value}>
                        Top {value}
                      </option>
                    ))}
                    <option value={Math.max(semanticFieldStats.sortedFields.length, 1)}>
                      All
                    </option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="semantic-lemma-count" className="font-semibold text-gray-700">
                    Lemmas per field
                  </label>
                  <select
                    id="semantic-lemma-count"
                    value={semanticFieldMaxLemmas}
                    onChange={(e) => setSemanticFieldMaxLemmas(parseInt(e.target.value, 10))}
                    className="rounded border border-gray-200 bg-white px-2 py-1 text-xs"
                  >
                    {[15, 30, 50, 75].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                    <option value={200}>200</option>
                  </select>
                </div>
                <button
                  onClick={() =>
                    semanticNetworkFullscreenActive
                      ? exitFullscreen()
                      : goFullscreen(semanticNetworkCardRef.current)
                  }
                  className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {semanticNetworkFullscreenActive ? "Exit fullscreen" : "Fullscreen"}
                </button>
              </div>

              <div className="flex items-center justify-start">
                <button
                  onClick={toggleSemanticNetworkFreeze}
                  className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  {isSemanticNetworkFrozen ? "Unfreeze" : "Freeze"}
                </button>
              </div>

              <div className={semanticNetworkFullscreenActive ? "relative flex-1 min-h-0" : "w-full h-[450px] overflow-hidden"}>
                <div
                  ref={semanticNetworkRef}
                  className="w-full h-full border border-gray-200 rounded-lg bg-white"
                  style={{ position: "relative", touchAction: "none", overflow: "hidden", width: "100%", height: "100%", display: "block", boxSizing: "border-box" }}
                />
                {semanticNetworkLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                    <span className="text-sm text-gray-500">Building semantic field map...</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                {semanticFieldNetworkData.fields.map((field) => (
                  <span key={field} className="inline-flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-sm border border-gray-300"
                      style={{ backgroundColor: semanticFieldColors[field] || "#9ca3af" }}
                    />
                    <span>{field}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results Section */}
        {showResults && (
          <>
            {queryLoading && (
              <div className="mb-3 text-sm text-gray-500">Running query…</div>
            )}
            {/* Semantic Network Visualization */}
            {queryResults.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                <h2 className="text-xl font-semibold text-black mb-3">
                  Semantic Network (Classifier-Lemma Relationships)
                </h2>
                <p className="text-sm text-gray-600 mb-3">
                  Edges show classifier-lemma and classifier-classifier associations; unclassified lemmas appear as isolated nodes
                </p>
                {/* Display mode toggle */}
                <div className="mb-3">
                  <DisplayModeControls
                    classifierDisplayMode={classifierDisplayMode}
                    onClassifierDisplayModeChange={setClassifierDisplayMode}
                    lemmaDisplayMode={lemmaDisplayMode}
                    onLemmaDisplayModeChange={setLemmaDisplayMode}
                    projectType={selectedProjectInfo?.type}
                    useUnicode={useUnicode}
                    onUnicodeToggle={setUseUnicode}
                    compact={location.pathname.startsWith("/compare/")}
                  />
                </div>
                {networkData.nodes.length > 0 ? (
                  <div
                    ref={queryNetworkCardRef}
                    className={queryNetworkFullscreenActive
                      ? "relative border border-gray-200 rounded-none overflow-hidden bg-gray-50 flex flex-col h-screen w-screen max-h-none max-w-none"
                      : "relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50"}
                  >
                    {/* vis.js Network Container (Legacy approach) */}
                    <div
                      ref={networkRef}
                      style={queryNetworkFullscreenActive ? { width: "100%", height: "100%", display: "block", overflow: "hidden", boxSizing: "border-box" } : { width: "100%", height: "450px", display: "block", overflow: "hidden", boxSizing: "border-box" }}
                      className={cn("bg-white", queryNetworkFullscreenActive && "flex-1 min-h-0")}
                    />
                    {networkData.edgeScale > 1 && (
                      <div className="absolute bottom-2 right-2 rounded border border-gray-200 bg-white/90 px-2 py-1 text-xs text-gray-600">
                        Edge scale: ÷{networkData.edgeScale.toFixed(1)}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500 px-3 pb-3">
                      <button
                        onClick={() => downloadNetworkPNG(networkInstanceRef.current, 96, "query-network-96dpi.png").catch(console.error)}
                        className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition-colors text-sm"
                      >
                        PNG 96
                      </button>
                      <button
                        onClick={() => downloadNetworkPNG(networkInstanceRef.current, 300, "query-network-300dpi.png").catch(console.error)}
                        className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition-colors text-sm"
                      >
                        PNG 300
                      </button>
                      <button
                        onClick={() => downloadNetworkSVGVector(networkInstanceRef.current, "query-network.svg")}
                        className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition-colors text-sm"
                      >
                        SVG
                      </button>
                      <button
                        onClick={() =>
                          queryNetworkFullscreenActive
                            ? exitFullscreen()
                            : goFullscreen(queryNetworkCardRef.current)
                        }
                        className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition-colors text-sm"
                      >
                        {queryNetworkFullscreenActive ? "Exit fullscreen" : "Fullscreen"}
                      </button>
                      <button
                        onClick={() => downloadNetworkDataWorkbook(networkData.nodes, networkData.edges, "query-network-data.xls")}
                        className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition-colors text-sm"
                      >
                        Data
                      </button>
                    </div>
                    <div className="px-3 pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-white border border-black rounded-full"></div>
                            <span>Lemmas</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: JSESH_NODE_COLOR, border: `1px solid ${JSESH_NODE_COLOR}` }}></div>
                            <span>Classifiers</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-8 h-0.5" style={{ backgroundColor: LEMMA_CLASSIFIER_EDGE_COLOR }}></div>
                            <span>Lemma-Classifier edges</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-8 h-0.5" style={{ backgroundColor: CLASSIFIER_COOCCURRENCE_EDGE_COLOR }}></div>
                            <span>Co-occurring classifiers in multiple classification</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-8 border-t-2 border-dashed" style={{ borderColor: LEMMA_CLASSIFIER_EDGE_COLOR }}></div>
                            <span>Dotted lemma-classifier edges mark lemmas that occur both with and without classifiers in the corpus</span>
                          </div>
                        </div>
                        <span>Drag nodes • Scroll to zoom • Click to navigate</span>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-gray-600">
                        <div>Disconnected nodes represent lemmas that are written without classifiers in this corpus.</div>
                        <div>Dotted edges mark lemma-classifier links where the lemma appears both with and without classifiers in this corpus.</div>
                      </div>
                    </div>
                    {lemmaColorMode === "pos" && posLegendData.posList.length > 0 && (
                      <div className="px-3 pb-3">
                        <div className="text-xs font-semibold text-gray-600 mb-2">POS key</div>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                          {posLegendData.posList.map((pos) => (
                            <span key={pos} className="inline-flex items-center gap-2">
                              <span
                                className="inline-block h-3 w-3 rounded-full border border-gray-400"
                                style={{ backgroundColor: posLegendData.posColorMap[pos] || "#9ca3af" }}
                              />
                              <span>{pos}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-600 text-center py-6">
                    No semantic relationships found
                  </p>
                )}
              </div>
            )}

            {/* Results Table */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-black">
                  Query Results ({queryTotal} tokens)
                </h2>
                {queryResults.length > 0 && (
                  <button
                    onClick={handleDownloadResults}
                    className="flex items-center gap-2 px-3 py-2 bg-black text-white rounded-lg font-medium hover:bg-black/90 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                )}
              </div>

              {queryResults.length === 0 ? (
                <p className="text-gray-600 text-center py-6">
                  No tokens match your query filters. Try adjusting your criteria.
                </p>
              ) : (
                <>
                  <div className={cn("overflow-x-auto border border-gray-200 rounded-lg", isComparisonRoute && "max-h-96 overflow-y-auto")}>
                    <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-black text-white">
                        <th className="px-3 py-3 text-left">Token ID</th>
                        <th className="px-3 py-3 text-left">Lemma</th>
                        <th className="px-3 py-3 text-left">Meaning</th>
                        <th className="px-3 py-3 text-left">MDC</th>
                        <th className="px-3 py-3 text-left">Source Text</th>
                        <th className="px-3 py-3 text-left">Script</th>
                        <th className="px-3 py-3 text-left">Classifiers</th>
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
                          <td className="px-3 py-3">{token.id}</td>
                          <td className="px-3 py-3 font-medium">
                            <em className="italic">{lemmaData[token.lemma_id]?.transliteration}</em>
                          </td>
                          <td className="px-3 py-3">
                            {lemmaData[token.lemma_id]?.meaning}
                          </td>
                          <td className="px-3 py-3 text-xs font-mono">
                            {token.mdc}
                          </td>
                          <td className="px-3 py-3 text-sm font-medium">
                            {token.witness_id}
                          </td>
                          <td className="px-3 py-3">
                            {witnessData[token.witness_id]?.script}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1">
                              {extractClassifiers(token.mdc_w_markup).map(
                                (classifier) => (
                                  <span
                                    key={classifier}
                                    className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                                  >
                                    <ClassifierLabel
                                      classifier={classifier}
                                      meanings={classifierMeanings}
                                      displayLabel={getClassifierBaseLabel(classifier)}
                                      className="text-blue-700"
                                      meaningClassName="text-blue-600/80"
                                      projectType={selectedProjectInfo?.type}
                                      projectId={primaryProjectId}
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
                    <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
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
          <div className="max-w-[1600px] mx-auto">
              <Citation
                type="query"
                projectName={projects.find((p) => p.id === filters.project)?.name || "Unknown"}
                authors={projects.find((p) => p.id === filters.project)?.authors || "Unknown"}
                projectId={filters.project}
              />
            </div>

            {/* Action Buttons - Bottom */}
            <div className="mt-8 pt-6 border-t border-gray-300 flex justify-center gap-3">
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
