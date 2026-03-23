import { useState, useMemo, useEffect, useRef, useCallback, memo, useLayoutEffect } from "react";
import { useSearchParams, useNavigate, useParams, useLocation } from "react-router-dom";
import { BarChart3, Search as SearchIcon, Copy, Check, Plus, X } from "lucide-react";
import SidebarLayout from "@/components/SidebarLayout";
import { useClassifierMeanings, useClassifierMetadata, useLemmaSummaries, useLemmas, useTokens, useTokensByClassifier, useWitnesses } from "@/lib/api";
import {
  DEFAULT_NETWORK_CLF_LEVELS,
  DEFAULT_NETWORK_CLF_TYPES,
  classifierTypeMatchesSelection,
  projects,
} from "@/lib/sampleData";
import { useCurrentProjectId } from "@/lib/projectContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import WitnessSelector from "@/components/filters/WitnessSelector";
import ScriptSelector from "@/components/filters/ScriptSelector";
import POSSelector from "@/components/filters/POSSelector";
import LevelSelector from "@/components/filters/LevelSelector";
import TypeSelector from "@/components/filters/TypeSelector";
import {
  extractClassifiersFromString,
  colourClassifiers,
  extractLemmaTranslation,
  formatLemmaOriginLabelItalic,
  formatLemmaOriginTranslationLabel,
  formatLemmaTranslationLabel,
  getExtendedSignUrl,
  fetchExtendedSignDataUrl,
  scaleEdgeWidths,
  JSESH_NODE_COLOR,
  LEMMA_CLASSIFIER_EDGE_COLOR,
  CLASSIFIER_COOCCURRENCE_EDGE_COLOR,
  CLF_NODE_WIDTH,
  CLF_NODE_HEIGHT,
  CLF_NODE_RADIUS,
  getLemmaNodeFontFace,
  wrapClassifierImage,
} from "@/lib/networkUtils";
import NotFound from "@/pages/NotFound";
import { fetchJseshBase64, getJseshImageUrl, getJseshRenderHeight } from "@/lib/jsesh";
import { getThesaurusLabel } from "@/lib/thesauri";
import { mdc2uni } from "@/lib/mdc2uni";
import { mergeClassifierMeaningsWithFallback } from "@/lib/classifierMeaningFallback";
import { formatClassifierMeaning, formatClassifierMeaningLabel } from "@/lib/classifierMeaningFormat";
import { getLuwianGlyphSvgPath } from "@/lib/luwianGlyphs";
import { downloadNetworkDataWorkbook, downloadNetworkJPEG, downloadNetworkPNG, downloadNetworkSVGVector } from "@/lib/networkExport";
import Citation from "@/components/Citation";
import ReportActions from "@/components/ReportActions";
import NetworkLoader from "@/components/NetworkLoader";
import ClassifierLabel from "@/components/ClassifierLabel";
import { getClassifierMeaning } from "@/lib/classifierLabel";
import DisplayModeControls from "@/components/DisplayModeControls";
import NetworkLegend from "@/components/NetworkLegend";
import { useProjectContextOverride } from "@/context/ProjectContextOverride";
import { useCompareNavigation } from "@/hooks/useCompareNavigation";
import { cn } from "@/lib/utils";

// Dynamically import vis-network for client-side rendering
let VisNetwork: any = null;
let VisDataSet: any = null;
const classifierImageCache = new Map<string, string>(); // cache extended/JSesh images
const BROKEN_IMAGE_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'/%3E";
const DEFAULT_NETWORK_FRAME_SIZE = 900;
const CLASSIFIER_LEMMA_NODE_SIZE = 26;
const CLASSIFIER_LEMMA_FONT_SIZE = 14;
const getInteractionByFrozenState = (frozen: boolean) => ({
  dragNodes: !frozen,
  dragView: !frozen,
  zoomView: !frozen,
});

const UNILITERAL_TO_GARDINER: Record<string, string> = {
  A: "G1",
  i: "M17",
  y: "Z4",
  w: "G43",
  b: "G41",
  p: "Q3",
  f: "I9",
  m: "G17",
  n: "N35",
  r: "D21",
  h: "V28",
  H: "F32",
  x: "N28",
  X: "N29",
  s: "S29",
  S: "S33",
  q: "N29",
  k: "V31",
  g: "X1",
  t: "X1",
  T: "X1",
  d: "D46",
  D: "D46",
  z: "O34"
};

const normalizeMdcChunk = (chunk: string) => {
  return chunk
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, "")
    .trim();
};

const mdcToUnicode = (mdc: string) => {
  if (!mdc) return "";
  const pieces = mdc.split(/[-:.*+=| ]+/).map(normalizeMdcChunk).filter(Boolean);
  const glyphs: string[] = [];

  pieces.forEach((piece) => {
    if (mdc2uni[piece]) {
      glyphs.push(mdc2uni[piece]);
      return;
    }

    const gardinerCodes = piece.match(/[A-Za-z]{1,2}\d+[A-Za-z]?/g);
    if (gardinerCodes && gardinerCodes.length > 0) {
      gardinerCodes.forEach((code) => {
        if (mdc2uni[code]) {
          glyphs.push(mdc2uni[code]);
        }
      });
      return;
    }

    if (piece.length === 1) {
      const gardiner = UNILITERAL_TO_GARDINER[piece];
      if (gardiner && mdc2uni[gardiner]) {
        glyphs.push(mdc2uni[gardiner]);
      }
      return;
    }

    piece.split("").forEach((char) => {
      const gardiner = UNILITERAL_TO_GARDINER[char];
      if (gardiner && mdc2uni[gardiner]) {
        glyphs.push(mdc2uni[gardiner]);
      }
    });
  });

  return glyphs.join("");
};

const TokenGlyph = memo(({ mdc }: { mdc: string }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    fetchJseshBase64(mdc, getJseshRenderHeight(44), true)
      .then((base64) => {
        if (!isActive) return;
        setImageUrl(base64 ? getJseshImageUrl(base64) : null);
      })
      .catch(() => {
        if (isActive) setImageUrl(null);
      });
    return () => {
      isActive = false;
    };
  }, [mdc]);

  if (!imageUrl) {
    return null;
  }

  return (
    <img
      src={imageUrl}
      alt="Hieroglyphic token"
      className="h-8"
    />
  );
});

TokenGlyph.displayName = "TokenGlyph";

function getTokenCommentId(token: any): string | null {
  if (!token?.comments) return null;
  const commentsStr = String(token.comments);

  try {
    const parsed = JSON.parse(commentsStr);
    if (parsed?.id && typeof parsed.id === "string") {
      return parsed.id;
    }
  } catch {
    // Not JSON, continue
  }

  return null;
}

function getTlaSentenceId(token: any): string | null {
  const direct =
    token?.tla_sentence_id ||
    token?.tla_sentence ||
    token?.tla_sentenceid ||
    token?.tla_sentence_uid;
  if (direct && typeof direct === "string") return direct;

  const textFields = [
    token?.coordinates_in_txt,
    token?.other,
    token?.comments,
  ]
    .filter((value) => typeof value === "string")
    .join(" ");

  const match = textFields.match(/sentence\/([A-Za-z0-9]+)/i);
  if (match?.[1]) return match[1];

  return null;
}

interface ClassifierStats {
  [key: string]: number;
}

export default function ClassifierReport() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId: urlProjectId, classifierId: urlClassifierId } = useParams();
  const [searchParams] = useSearchParams();
  const currentProjectId = useCurrentProjectId();
  const { overrideProjectId } = useProjectContextOverride();
  const { setCompareTarget, getCompareParam } = useCompareNavigation();
  const isComparisonRoute = location.pathname.startsWith("/compare/");
  const isComparisonOverride = Boolean(overrideProjectId);
  const actionButtonSize = isComparisonRoute ? "sm" : "default";
  const pageWidthClass = isComparisonRoute ? "max-w-full w-full" : "max-w-[1600px] mx-auto w-full";
  const pagePaddingClass = isComparisonRoute ? "px-3 sm:px-3" : "";
  const inSplitComparison = isComparisonRoute || isComparisonOverride;
  const stabilizationIterations = isComparisonRoute ? 60 : 120;

  const scheduleIdle = useCallback((work: () => void, timeout = 500): number => {
    if (typeof window === "undefined") {
      return setTimeout(work, 0) as unknown as number;
    }
    const requestIdle = (window as any).requestIdleCallback as
      | ((cb: () => void, options?: { timeout: number }) => number)
      | undefined;
    if (requestIdle) {
      return requestIdle(work, { timeout });
    }
    return window.setTimeout(work, 0);
  }, []);

  const cancelIdle = useCallback((id: number) => {
    const cancelIdleCb = (window as any).cancelIdleCallback as ((cb: number) => void) | undefined;
    if (cancelIdleCb) {
      cancelIdleCb(id);
    } else {
      window.clearTimeout(id);
    }
  }, []);
  
  // Get project ID from URL params
  const selectedProjectId = urlProjectId || currentProjectId;
  const compareClassifier = getCompareParam("classifier");
  const classifierFromUrl = urlClassifierId || compareClassifier || searchParams.get("classifier");

  // Project selection state
  const [selectedProject, setSelectedProject] = useState(selectedProjectId);

  // Sync selectedProject with URL changes and initialize compare mode from URL
  useEffect(() => {
    if (selectedProjectId && selectedProjectId !== selectedProject) {
      setSelectedProject(selectedProjectId);
    }

    // Check for compare parameter in URL
    const compareParam = searchParams.get("compare");
    if (compareParam) {
      setIsCompareMode(true);
      setComparisonProjectId(compareParam);
    }
  }, [selectedProjectId, selectedProject, searchParams]);

  // Get project info
  const selectedProjectInfo = projects.find(p => p.id === selectedProject);
  const defaultUnicode = (selectedProjectInfo?.type ?? "hieroglyphic") !== "hieroglyphic";

  const openLemma = useCallback(
    (lemmaId: string | number) => {
      const numericId = typeof lemmaId === "number" ? lemmaId : parseInt(String(lemmaId), 10);
      if (setCompareTarget({ type: "lemma", lemmaId: Number.isFinite(numericId) ? numericId : undefined })) return;
      navigate(`/project/${selectedProject}/lemma/${lemmaId}`);
    },
    [navigate, selectedProject, setCompareTarget]
  );

  const openClassifier = useCallback(
    (classifier: string) => {
      if (setCompareTarget({ type: "classifier", classifier })) return;
      navigate(`/project/${selectedProject}/classifier/${encodeURIComponent(classifier)}`);
    },
    [navigate, selectedProject, setCompareTarget]
  );

  // Compare mode state
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [comparisonProjectId, setComparisonProjectId] = useState<string | null>(null);

  // State management - reset when project changes
  const [selectedClassifier, setSelectedClassifier] = useState<string | null>(classifierFromUrl);
  const [classifierSearchQuery, setClassifierSearchQuery] = useState("");
  const [isClassifierSearchFocused, setIsClassifierSearchFocused] = useState(false);

  // Filter states
  const [selectedWitnesses, setSelectedWitnesses] = useState<Set<string>>(new Set());
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set());
  const [selectedPOS, setSelectedPOS] = useState<Set<string>>(new Set());
  const [appliedWitnesses, setAppliedWitnesses] = useState<Set<string>>(new Set());
  const [appliedScripts, setAppliedScripts] = useState<Set<string>>(new Set());
  const [appliedPOS, setAppliedPOS] = useState<Set<string>>(new Set());
  
  // Classifier filtering
  const [clfTypes, setClfTypes] = useState<Set<string>>(new Set(DEFAULT_NETWORK_CLF_TYPES));
  const [clfLevels, setClfLevels] = useState<Set<number>>(new Set(DEFAULT_NETWORK_CLF_LEVELS));
  const [clfPosition, setClfPosition] = useState("any");
  const [isFilterMenuExpanded, setIsFilterMenuExpanded] = useState(false);
  const [classifierSortBy, setClassifierSortBy] = useState<"count" | "id" | "category">("count");

  const [lemmaMapMode, setLemmaMapMode] = useState<"counts" | "percentages">("counts");
  const [useUnicode, setUseUnicode] = useState(defaultUnicode);
  const [classifierDisplayMode, setClassifierDisplayMode] = useState<"visual" | "meaning">("visual");
  const [lemmaDisplayMode, setLemmaDisplayMode] = useState<"origin" | "translation" | "both">("both");
  const [isHostLemmaListExpanded, setIsHostLemmaListExpanded] = useState(false);
  const [isTokenListExpanded, setIsTokenListExpanded] = useState(false);

  // Statistics
  const [lemmaDict, setLemmaDict] = useState<ClassifierStats>({});
  const [lemmaTotalDict, setLemmaTotalDict] = useState<ClassifierStats>({});
  const [lemmaPercentDict, setLemmaPercentDict] = useState<Record<string, [number, string]>>({});
  const [lemmaMeanings, setLemmaMeanings] = useState<Record<string, string>>({});
  const [comDict, setComDict] = useState<ClassifierStats>({});
  const [clfDict, setClfDict] = useState<ClassifierStats>({});
  const [scrDict, setScrDict] = useState<ClassifierStats>({});
  const [posDict, setPosDict] = useState<ClassifierStats>({});
  const [ordDict, setOrdDict] = useState<ClassifierStats>({});

  // Network graphs
  const lemmaNetworkRef = useRef<HTMLDivElement>(null);
  const lemmaNetworkFrameRef = useRef<HTMLDivElement>(null);
  const clfNetworkRef = useRef<HTMLDivElement>(null);
  const clfNetworkFrameRef = useRef<HTMLDivElement>(null);
  const lemmaNetworkCardRef = useRef<HTMLDivElement>(null);
  const clfNetworkCardRef = useRef<HTMLDivElement>(null);
  const hostLemmaCardRef = useRef<HTMLDivElement>(null);
  const hostLemmaListRef = useRef<HTMLDivElement>(null);
  const lemmaNetworkInstance = useRef<any>(null);
  const clfNetworkInstance = useRef<any>(null);
  const lemmaNetworkTokenRef = useRef(0);
  const clfNetworkTokenRef = useRef(0);
  const lemmaNetworkResizeObserverRef = useRef<ResizeObserver | null>(null);
  const clfNetworkResizeObserverRef = useRef<ResizeObserver | null>(null);
  const [visReady, setVisReady] = useState(false);
  const [lemmaNetworkData, setLemmaNetworkData] = useState<{ nodes: any[]; edges: any[] }>({
    nodes: [],
    edges: []
  });
  const [clfNetworkData, setClfNetworkData] = useState<{ nodes: any[]; edges: any[] }>({
    nodes: [],
    edges: []
  });
  const [isLemmaNetworkFullscreen, setIsLemmaNetworkFullscreen] = useState(false);
  const [isClfNetworkFullscreen, setIsClfNetworkFullscreen] = useState(false);
  const lemmaNetworkFullscreenActive =
    typeof document !== "undefined" && document.fullscreenElement === lemmaNetworkCardRef.current
      ? isLemmaNetworkFullscreen
      : false;
  const clfNetworkFullscreenActive =
    typeof document !== "undefined" && document.fullscreenElement === clfNetworkCardRef.current
      ? isClfNetworkFullscreen
      : false;
  const [lemmaEdgeScale, setLemmaEdgeScale] = useState(1);
  const [clfEdgeScale, setClfEdgeScale] = useState(1);
  const [showLemmaNodeModes, setShowLemmaNodeModes] = useState(false);
  const [showClassifierNodeModes, setShowClassifierNodeModes] = useState(false);
  const defaultClassifierSetRef = useRef(false);
  const [isLemmaNetworkFrozen, setIsLemmaNetworkFrozen] = useState(false);
  const [isClfNetworkFrozen, setIsClfNetworkFrozen] = useState(false);
  const [hostLemmaCardHeight, setHostLemmaCardHeight] = useState<number | null>(null);
  const statsContentRef = useRef<HTMLDivElement>(null);
  const [statsContentHeight, setStatsContentHeight] = useState<number | null>(null);
  const [hostLemmaHasOverflow, setHostLemmaHasOverflow] = useState(false);

  // Refs to track current display modes for click handlers
  const lemmaDisplayModeRef = useRef(lemmaDisplayMode);
  const classifierDisplayModeRef = useRef(classifierDisplayMode);

  // Update refs whenever display modes change (without triggering network recreation)
  useEffect(() => {
    lemmaDisplayModeRef.current = lemmaDisplayMode;
  }, [lemmaDisplayMode]);

  useEffect(() => {
    classifierDisplayModeRef.current = classifierDisplayMode;
  }, [classifierDisplayMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    import("vis-network/standalone").then((vis) => {
      if (cancelled) return;
      VisNetwork = vis.Network;
      VisDataSet = vis.DataSet;
      setVisReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset filters when project changes
  useEffect(() => {
    setSelectedWitnesses(new Set());
    setSelectedScripts(new Set());
    setSelectedPOS(new Set());
    setAppliedWitnesses(new Set());
    setAppliedScripts(new Set());
    setAppliedPOS(new Set());
    setClfTypes(new Set(DEFAULT_NETWORK_CLF_TYPES));
    setClfLevels(new Set(DEFAULT_NETWORK_CLF_LEVELS));
    setClfPosition("any");
    setLemmaMapMode("counts");
    setUseUnicode(defaultUnicode);
    setClassifierSearchQuery("");
    setIsClassifierSearchFocused(false);
    setSelectedClassifier(null);
    defaultClassifierSetRef.current = false;
  }, [selectedProject, defaultUnicode]);

  // Update URL when project or classifier changes
  useEffect(() => {
    if (!location.pathname.includes("/classifier")) return;
    if (selectedProject) {
      const basePath = `/project/${selectedProject}/classifier`;
      const currentPath = window.location.pathname;
      const targetPath = selectedClassifier ? `${basePath}/${encodeURIComponent(selectedClassifier)}` : basePath;
      
      if (currentPath !== targetPath) {
        navigate(targetPath, { replace: true });
      }
    }
  }, [selectedProject, selectedClassifier, navigate, location.pathname]);

  const { data: lemmaData, loading: lemmaLoading, error: lemmaError } = useLemmas(selectedProject);
  const { data: lemmaSummaryData } = useLemmaSummaries(selectedProject, { withCounts: true, limit: 200000, offset: 0 });
  const { data: witnessData, loading: witnessLoading, error: witnessError } = useWitnesses(selectedProject);
  const { data: classifierData, loading: classifierLoading, error: classifierError } = useClassifierMetadata(selectedProject);
  const { data: classifierMeanings, loading: meaningsLoading, error: meaningsError } = useClassifierMeanings(selectedProject);
  const hasUsableClassifierMeta = useMemo(() => {
    return classifierData.some((meta: any) => {
      const tokenId = Number(meta?.token_id);
      if (!Number.isFinite(tokenId)) return false;
      const key = selectedProjectInfo?.type === "anatolian"
        ? (meta?.classifier || meta?.gardiner_number || meta?.clf || meta?.mdc)
        : (meta?.gardiner_number || meta?.clf || meta?.classifier || meta?.mdc);
      return Boolean(key);
    });
  }, [classifierData, selectedProjectInfo?.type]);
  const forceTokenFallback = selectedProject === "luwiancorpus" || selectedProject === "rinap";
  const shouldUseTokenFallback = !classifierLoading && (forceTokenFallback || !hasUsableClassifierMeta || Boolean(classifierError));
  const { data: tokenData, loading: tokenLoading } = useTokens(selectedProject, shouldUseTokenFallback);
  const hasClassifierMeta = hasUsableClassifierMeta && !shouldUseTokenFallback;

  const mergedClassifierMeanings = useMemo(() => {
    return mergeClassifierMeaningsWithFallback({
      projectId: selectedProject,
      projectType: selectedProjectInfo?.type,
      classifierMeanings,
      lemmas: lemmaData
    });
  }, [selectedProject, selectedProjectInfo?.type, classifierMeanings, lemmaData]);

  const lemmaTotalsById = useMemo(() => {
    const totals: Record<number, number> = {};
    lemmaSummaryData.items.forEach((lemma: any) => {
      const lemmaId = Number(lemma?.id);
      if (!Number.isFinite(lemmaId)) return;
      const count = Number(lemma?.token_count || 0);
      totals[lemmaId] = Number.isFinite(count) ? count : 0;
    });
    return totals;
  }, [lemmaSummaryData.items]);

  const classifierCountsFromTokens = useMemo(() => {
    if (!shouldUseTokenFallback) return {};
    const counts: Record<string, number> = {};
    Object.values(tokenData || {}).forEach((token: any) => {
      const clfs = extractClassifiersFromString(token.mdc_w_markup || "");
      clfs.forEach((clf) => {
        counts[clf] = (counts[clf] || 0) + 1;
      });
    });
    return counts;
  }, [shouldUseTokenFallback, tokenData]);

  // Load data for comparison project
  const { data: comparisonLemmaData = {}, loading: comparisonLemmaLoading } = useLemmas(comparisonProjectId || "");
  const { data: comparisonWitnessData = {}, loading: comparisonWitnessLoading } = useWitnesses(comparisonProjectId || "");
  const { data: comparisonClassifierData = [], loading: comparisonClassifierLoading } = useClassifierMetadata(comparisonProjectId || "");
  const { data: comparisonClassifierMeanings = {}, loading: comparisonMeaningsLoading } = useClassifierMeanings(comparisonProjectId || "");
  const comparisonProjectType = projects.find((project) => project.id === comparisonProjectId)?.type;

  const mergedComparisonClassifierMeanings = useMemo(() => {
    if (!comparisonProjectId) return comparisonClassifierMeanings;
    return mergeClassifierMeaningsWithFallback({
      projectId: comparisonProjectId,
      projectType: comparisonProjectType,
      classifierMeanings: comparisonClassifierMeanings,
      lemmas: comparisonLemmaData
    });
  }, [comparisonProjectId, comparisonProjectType, comparisonClassifierMeanings, comparisonLemmaData]);

  const loading = lemmaLoading || witnessLoading || classifierLoading || meaningsLoading || (shouldUseTokenFallback && tokenLoading);
  const error = lemmaError || witnessError || classifierError || meaningsError;

  const comparisonLoading = comparisonLemmaLoading || comparisonWitnessLoading || comparisonClassifierLoading || comparisonMeaningsLoading;

  // Get comparison project info
  const comparisonProjectInfo = comparisonProjectId ? projects.find(p => p.id === comparisonProjectId) : null;

  const classifierMetaByToken = useMemo(() => {
    const index: Record<number, Record<string, any>> = {};
    classifierData.forEach((meta: any) => {
      const tokenId = Number(meta.token_id);
      if (!Number.isFinite(tokenId)) return;
      if (!index[tokenId]) {
        index[tokenId] = {};
      }
      // For Luwian/anatolian projects, the main field is 'classifier', not 'gardiner_number'
      const classifierKey = selectedProjectInfo?.type === "anatolian"
        ? (meta.classifier || meta.gardiner_number || meta.clf || meta.mdc)
        : (meta.gardiner_number || meta.clf || meta.classifier || meta.mdc);
      if (!classifierKey) return;
      if (!index[tokenId][classifierKey]) {
        index[tokenId][classifierKey] = meta;
      }
    });
    return index;
  }, [classifierData, selectedProjectInfo?.type]);

  const getTokenClassifiers = useCallback((token: any) => {
    if (!hasClassifierMeta) {
      return extractClassifiersFromString(token.mdc_w_markup);
    }
    const meta = classifierMetaByToken[token.id];
    if (meta && Object.keys(meta).length > 0) {
      return Object.keys(meta);
    }
    return extractClassifiersFromString(token.mdc_w_markup);
  }, [classifierMetaByToken, hasClassifierMeta]);

  const classifierSummary = useMemo(() => {
    const summary: Record<string, { type?: string; level?: number; position?: string }> = {};
    classifierData.forEach((meta: any) => {
      // For Luwian/anatolian projects, the main field is 'classifier', not 'gardiner_number'
      const key = selectedProjectInfo?.type === "anatolian"
        ? (meta.classifier || meta.gardiner_number || meta.clf || meta.mdc)
        : (meta.gardiner_number || meta.clf || meta.classifier || meta.mdc);
      if (!key || summary[key]) return;
      const parsedLevel = parseInt(String(meta.clf_level), 10);
      summary[key] = {
        type: meta.clf_type,
        level: Number.isFinite(parsedLevel) ? parsedLevel : undefined,
        position: meta.clf_position
      };
    });
    return summary;
  }, [classifierData, selectedProjectInfo?.type]);

  const projectType = selectedProjectInfo?.type || "hieroglyphic";
  const classifierTextClass = projectType === "cuneiform" ? "cuneiform-unicode" : undefined;

  const formatClassifierId = useCallback((mdc: string | null | undefined) => {
    if (!mdc) return "";
    if (projectType !== "hieroglyphic") return mdc;
    const trimmed = String(mdc).trim();
    const varaMatch = trimmed.match(/^(?:US\\d+)?([A-Za-z0-9]+)VARA([A-Za-z0-9]*)$/i);
    if (varaMatch) {
      const suffix = varaMatch[2] ? varaMatch[2].toLowerCase() : "";
      return `${varaMatch[1]}*vara${suffix}`;
    }
    return trimmed;
  }, [projectType]);

  const getClassifierDisplay = useCallback((mdc: string) => {
    if (projectType !== "hieroglyphic") return mdc;
    if (!useUnicode) return mdc;
    return mdc2uni[mdc] || mdc;
  }, [projectType, useUnicode]);

  const getClassifierBaseLabel = useCallback((mdc: string) => {
    if (projectType !== "hieroglyphic") return mdc;
    const glyph = getClassifierDisplay(mdc);
    const displayId = formatClassifierId(mdc);
    return `${glyph} ${displayId}`;
  }, [projectType, getClassifierDisplay, formatClassifierId]);

  // For network nodes - show either visual (glyph/JSesh) or meaning label based on mode
  const getClassifierNodeLabel = useCallback((mdc: string) => {
    // For non-Egyptian projects, use the display mode to decide between ID and meaning
    if (projectType !== "hieroglyphic") {
      if (classifierDisplayMode === "meaning") {
        const label = formatClassifierMeaningLabel(mergedClassifierMeanings?.[mdc], selectedProject, { html: true });
        if (label) return label;
        return "";
      }
      if (selectedProject === "luwiancorpus") {
        const luwianSvg = getLuwianGlyphSvgPath(mdc);
        if (luwianSvg) return "";
      }
      // Visual mode for non-Egyptian: show the classifier ID
      return mdc;
    }

    // For Egyptian projects
    if (classifierDisplayMode === "meaning") {
      // Show meaning label in small caps in square brackets
      const label = formatClassifierMeaningLabel(mergedClassifierMeanings?.[mdc], selectedProject, { html: true });
      if (label) return label;
      // No meaning available - show empty label
      return "";
    }

    // Visual mode for hieroglyphic: Show ONLY the glyph (Unicode if available) or empty label for JSesh
    if (useUnicode) {
      const glyph = mdc2uni[mdc];
      return glyph ? `${glyph}` : "";
    }
    // When using JSesh/MdC, the image will be displayed - show empty label (no code)
    return "";
  }, [projectType, useUnicode, classifierDisplayMode, mergedClassifierMeanings, selectedProject]);

  if (!selectedProjectInfo && !loading) {
    return <NotFound />;
  }

  // Get all classifiers from metadata
  const allClassifiers = useMemo(() => {
    if (shouldUseTokenFallback) {
      return Object.keys(classifierCountsFromTokens).sort();
    }
    const classifierSet = new Set<string>();
    classifierData.forEach((meta: any) => {
      // For Luwian/anatolian projects, the main field is 'classifier', not 'gardiner_number'
      const key = selectedProjectInfo?.type === "anatolian"
        ? (meta?.classifier || meta?.gardiner_number || meta?.clf || meta?.mdc)
        : (meta?.gardiner_number || meta?.clf || meta?.classifier || meta?.mdc);
      if (key) {
        classifierSet.add(String(key));
      }
    });
    return Array.from(classifierSet).sort();
  }, [classifierData, selectedProjectInfo?.type, shouldUseTokenFallback, classifierCountsFromTokens]);

  const classifierCounts = useMemo(() => {
    if (shouldUseTokenFallback) {
      return classifierCountsFromTokens;
    }
    const counts: Record<string, number> = {};
    classifierData.forEach((meta: any) => {
      // For Luwian/anatolian projects, the main field is 'classifier', not 'gardiner_number'
      const key = selectedProjectInfo?.type === "anatolian"
        ? (meta?.classifier || meta?.gardiner_number || meta?.clf || meta?.mdc)
        : (meta?.gardiner_number || meta?.clf || meta?.classifier || meta?.mdc);
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [classifierData, selectedProjectInfo?.type, shouldUseTokenFallback, classifierCountsFromTokens]);

  const classifierSearchIndex = useMemo(() => {
    if (shouldUseTokenFallback) {
      const index: Record<string, Set<string>> = {};
      Object.keys(classifierCountsFromTokens).forEach((classifierKey) => {
        const bucket = new Set<string>();
        bucket.add(classifierKey);
        if (selectedProjectInfo?.type === "hieroglyphic") {
          const glyph = mdc2uni[String(classifierKey)];
          if (glyph) bucket.add(glyph);
        }
        const meaningLabel = getClassifierMeaning(classifierKey, mergedClassifierMeanings, selectedProject);
        if (meaningLabel) bucket.add(meaningLabel);
        index[classifierKey] = bucket;
      });
      const flattened: Record<string, string> = {};
      Object.entries(index).forEach(([key, tokens]) => {
        flattened[key] = Array.from(tokens).join(" ").toLowerCase();
      });
      return flattened;
    }
    const index: Record<string, Set<string>> = {};
    const addToken = (bucket: Set<string>, value: unknown) => {
      if (value === null || value === undefined) return;
      const token = String(value).trim();
      if (token) bucket.add(token);
    };

    classifierData.forEach((meta: any) => {
      const key = selectedProjectInfo?.type === "anatolian"
        ? (meta?.classifier || meta?.gardiner_number || meta?.clf || meta?.mdc)
        : (meta?.gardiner_number || meta?.clf || meta?.classifier || meta?.mdc);
      if (!key) return;
      const classifierKey = String(key);
      if (!index[classifierKey]) {
        index[classifierKey] = new Set();
      }
      const bucket = index[classifierKey];

      addToken(bucket, classifierKey);
      addToken(bucket, meta?.gardiner_number);
      addToken(bucket, meta?.gardiner);
      addToken(bucket, meta?.classifier);
      addToken(bucket, meta?.clf);
      addToken(bucket, meta?.mdc);
      addToken(bucket, meta?.unicode);
      addToken(bucket, meta?.unicode_char);
      addToken(bucket, meta?.unicode_character);

      Object.entries(meta || {}).forEach(([field, value]) => {
        if (!/(unicode|gardiner)/i.test(field)) return;
        addToken(bucket, value);
      });

      if (selectedProjectInfo?.type === "hieroglyphic") {
        const glyphCandidates = [
          classifierKey,
          meta?.mdc,
          meta?.gardiner_number,
          meta?.clf,
          meta?.classifier
        ];
        glyphCandidates.forEach((candidate) => {
          if (!candidate) return;
          const glyph = mdc2uni[String(candidate)];
          if (glyph) addToken(bucket, glyph);
        });
      }
    });

    Object.keys(index).forEach((classifierKey) => {
      const meaningLabel = getClassifierMeaning(classifierKey, mergedClassifierMeanings, selectedProject);
      if (meaningLabel) {
        addToken(index[classifierKey], meaningLabel);
      }
    });

    const flattened: Record<string, string> = {};
    Object.entries(index).forEach(([key, tokens]) => {
      flattened[key] = Array.from(tokens).join(" ").toLowerCase();
    });
    return flattened;
  }, [
    classifierData,
    selectedProjectInfo?.type,
    mergedClassifierMeanings,
    selectedProject,
    shouldUseTokenFallback,
    classifierCountsFromTokens
  ]);

  useEffect(() => {
    if (!classifierFromUrl) return;

    const normalized = allClassifiers.length
      ? allClassifiers.find((classifier) => classifier.toLowerCase() === classifierFromUrl.toLowerCase()) || classifierFromUrl
      : classifierFromUrl;

    if (normalized !== selectedClassifier) {
      setSelectedClassifier(normalized);
    }
  }, [classifierFromUrl, selectedClassifier, allClassifiers]);

  useEffect(() => {
    if (selectedClassifier || defaultClassifierSetRef.current) return;
    const sorted = Object.entries(classifierCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      setSelectedClassifier(sorted[0][0]);
      defaultClassifierSetRef.current = true;
    }
  }, [classifierCounts, selectedClassifier]);

  // Filter classifiers based on search
  // #hh: check about marking semantic and extracting phonetic (15.1.26)
  const filteredClassifiers = useMemo(() => {
    const query = classifierSearchQuery.trim().toLowerCase();
    let filtered = allClassifiers;
    if (query) {
      filtered = allClassifiers.filter((clf) => {
        if (clf.toLowerCase().includes(query)) return true;
        const searchText = classifierSearchIndex[clf];
        if (searchText && searchText.includes(query)) return true;
        const summaryType = classifierSummary[clf]?.type;
        if (summaryType && summaryType.toLowerCase().includes(query)) return true;
        return false;
      });
    }

    // Apply sorting preference
    if (classifierSortBy === "id") {
      // # add here if there is a certain order to the classifier list in this script/language
      // For now, sort alphabetically by classifier ID
      return filtered.sort((a, b) => a.localeCompare(b));
    }
    // Default: sort by count (most attested first)
    return filtered.sort((a, b) => (classifierCounts[b] || 0) - (classifierCounts[a] || 0));
  }, [classifierSearchQuery, allClassifiers, classifierSummary, classifierCounts, classifierSortBy, selectedProjectInfo?.type]);

  const selectedWitnessIds = useMemo(() => Array.from(appliedWitnesses), [appliedWitnesses]);
  const selectedScriptIds = useMemo(() => Array.from(appliedScripts), [appliedScripts]);

  const { data: classifierTokensResponse } = useTokensByClassifier(
    selectedProject,
    selectedClassifier,
    {
      witnessIds: selectedWitnessIds,
      scripts: selectedScriptIds,
      limit: 20000,
      offset: 0,
    }
  );

  const availablePOS = useMemo(() => {
    const posSet = new Set<string>();
    classifierTokensResponse.items.forEach((token: any) => {
      if (token?.pos) {
        posSet.add(String(token.pos));
      }
    });
    return Array.from(posSet).sort();
  }, [classifierTokensResponse.items]);

  const lemmaLabelToId = useMemo(() => {
    const map = new Map<string, number>();
    Object.values(lemmaData).forEach((lemma: any) => {
      const label = formatLemmaLabel(lemma);
      map.set(label, lemma.id);
    });
    return map;
  }, [lemmaData]);

  const tokensFilteredByMeta = useMemo(() => {
    return classifierTokensResponse.items.filter((token: any) => {
      if (appliedPOS.size > 0 && !appliedPOS.has(String(token.pos))) {
        return false;
      }
      return true;
    });
  }, [classifierTokensResponse.items, appliedPOS]);

  // Get tokens for selected classifier with filtering
  const tokensForClassifier = useMemo(() => {
    if (!selectedClassifier) return [];

    const tokens = tokensFilteredByMeta.filter((token: any) => {
      const clfs = getTokenClassifiers(token);
      if (!clfs.includes(selectedClassifier)) return false;

      // Type and level filtering (if classifier data available)
      if (hasClassifierMeta && (clfTypes.size > 0 || clfLevels.size > 0)) {
        const clfInfo = classifierMetaByToken[token.id]?.[selectedClassifier];
        if (!clfInfo) return false;
        if (clfTypes.size > 0 && !classifierTypeMatchesSelection(clfInfo.clf_type, clfTypes)) {
          return false;
        }
        // Check if token's level is in the selected levels set
        if (clfLevels.size > 0) {
          const parsedLevel = parseInt(String(clfInfo.clf_level), 10);
          if (!Number.isFinite(parsedLevel) || !clfLevels.has(parsedLevel)) return false;
        }
      }

      if (clfPosition !== "any") {
        const position = getClassifierPosition(selectedClassifier, token.mdc_w_markup || "");
        if (position !== clfPosition) return false;
      }

      return true;
    });

    return tokens.sort((a: any, b: any) => a.id - b.id);
  }, [selectedClassifier, tokensFilteredByMeta, classifierMetaByToken, clfLevels, clfPosition, clfTypes, getTokenClassifiers, hasClassifierMeta])

  // Calculate statistics when classifier or filters change
  useEffect(() => {
    if (!selectedClassifier || !tokensForClassifier.length) {
      setLemmaDict({});
      setLemmaTotalDict({});
      setLemmaPercentDict({});
      setLemmaMeanings({});
      setComDict({});
      setClfDict({});
      setScrDict({});
      setPosDict({});
      setOrdDict({});
      return;
    }

    let cancelled = false;
    const idleId = scheduleIdle(() => {
      if (cancelled) return;
      const newLemmaDict: ClassifierStats = {};
      const newLemmaTotals: ClassifierStats = {};
      const newLemmaPercent: Record<string, [number, string]> = {};
      const newLemmaMeanings: Record<string, string> = {};
      const newComDict: ClassifierStats = {};
      const newClfDict: ClassifierStats = {};
      const newScrDict: ClassifierStats = {};
      const newPosDict: ClassifierStats = {};
      const newOrdDict: ClassifierStats = {};
      const lemmaIdByKey: Record<string, number> = {};

      tokensFilteredByMeta.forEach((token: any) => {
        if (token.lemma_id && lemmaData[token.lemma_id]) {
          const lemmaLabel = formatLemmaLabel(lemmaData[token.lemma_id]);
          newLemmaTotals[lemmaLabel] = (newLemmaTotals[lemmaLabel] || 0) + 1;
        }
      });
      
      tokensForClassifier.forEach((token: any) => {
        const clfs = getTokenClassifiers(token);

        // Lemma statistics
        if (token.lemma_id && lemmaData[token.lemma_id]) {
          const lemma = lemmaData[token.lemma_id];
          const lemmaKey = formatLemmaLabel(lemma);
          lemmaIdByKey[lemmaKey] = token.lemma_id;
          newLemmaDict[lemmaKey] = (newLemmaDict[lemmaKey] || 0) + 1;
          newLemmaMeanings[lemmaKey] = extractLemmaMeaning(lemma.meaning);
        }

        const positionIndex = clfs.indexOf(selectedClassifier);
        if (positionIndex >= 0) {
          const position = positionIndex + 1;
          newOrdDict[position] = (newOrdDict[position] || 0) + 1;
        }
        
        // Classifier combinations
        if (clfs.length > 1) {
          const filteredClfs = clfs.filter((clf) => {
            if (!hasClassifierMeta || (clfTypes.size === 0 && clfLevels.size === 0)) return true;
            const clfInfo = classifierMetaByToken[token.id]?.[clf];
            if (!clfInfo) return false;
            if (clfTypes.size > 0 && !classifierTypeMatchesSelection(clfInfo.clf_type, clfTypes)) {
              return false;
            }
            // Check if classifier's level is in the selected levels set
            if (clfLevels.size > 0) {
              const parsedLevel = parseInt(String(clfInfo.clf_level), 10);
              if (!Number.isFinite(parsedLevel) || !clfLevels.has(parsedLevel)) return false;
            }
            return true;
          });

          if (filteredClfs.length > 1) {
            const combination = filteredClfs.join('+');
            newComDict[combination] = (newComDict[combination] || 0) + 1;
          }

          filteredClfs.forEach((clf) => {
            if (clf === selectedClassifier) return;
            newClfDict[clf] = (newClfDict[clf] || 0) + 1;
          });
        }
        
        // Script statistics
        const witness = witnessData[token.witness_id];
        if (witness?.script) {
          const scriptLabel = getThesaurusLabel(projectType, "scripts", witness.script);
          newScrDict[scriptLabel] = (newScrDict[scriptLabel] || 0) + 1;
        }
        
        // POS statistics
        if (token.pos) {
          newPosDict[token.pos] = (newPosDict[token.pos] || 0) + 1;
        }
      });

      Object.keys(newLemmaDict).forEach((lemmaKey) => {
        const lemmaId = lemmaIdByKey[lemmaKey];
        const total = (lemmaId && lemmaTotalsById[lemmaId] != null)
          ? lemmaTotalsById[lemmaId]
          : newLemmaTotals[lemmaKey];
        if (!total) return;
        const count = newLemmaDict[lemmaKey];
        const percentage = Math.round((count / total) * 100);
        newLemmaPercent[lemmaKey] = [percentage, `${count} / ${total}`];
      });
      
      setLemmaDict(newLemmaDict);
      setLemmaTotalDict(newLemmaTotals);
      setLemmaPercentDict(newLemmaPercent);
      setLemmaMeanings(newLemmaMeanings);
      setComDict(newComDict);
      setClfDict(newClfDict);
      setScrDict(newScrDict);
      setPosDict(newPosDict);
      setOrdDict(newOrdDict);
    }, 1000);

    return () => {
      cancelled = true;
      cancelIdle(idleId as number);
    };
  }, [
    selectedClassifier,
    tokensForClassifier,
    tokensFilteredByMeta,
    lemmaData,
    witnessData,
    clfLevels,
    clfTypes,
    classifierMetaByToken,
    getTokenClassifiers,
    projectType,
    lemmaTotalsById,
    scheduleIdle,
    cancelIdle
  ]);

  const createLemmaNetwork = useCallback(() => {
    if (!visReady || !lemmaNetworkRef.current || !VisNetwork || !VisDataSet || !selectedClassifier) return;

    if (lemmaNetworkInstance.current) {
      lemmaNetworkInstance.current.destroy();
    }

    const networkToken = ++lemmaNetworkTokenRef.current;
    setIsLemmaNetworkFrozen(false);

    let pendingImages = 0;
    let stabilized = false;
    let imagesReady = true;
    let finalized = false;
    let fallbackId = 0;

    const startImageLoad = () => {
      pendingImages += 1;
      imagesReady = false;
    };

    const finishImageLoad = () => {
      pendingImages = Math.max(pendingImages - 1, 0);
      if (pendingImages === 0) {
        imagesReady = true;
      }
      // Redraw after image update so frozen network shows the new image
      try { network.redraw(); } catch { /* network may be destroyed */ }
      maybeFinalize();
    };

    let finalize = () => {};
    const maybeFinalize = () => {
      if (lemmaNetworkTokenRef.current !== networkToken) return;
      if (finalized || !stabilized || !imagesReady) return;
      finalize();
    };

    const nodes = new VisDataSet();
    const edgeList: any[] = [];
    const lemmaFont = getLemmaNodeFontFace(projectType);
    const classifierFont = projectType === "hieroglyphic" ? (useUnicode ? "eot" : "hierofont") : lemmaFont;

    const baseLabel = getClassifierNodeLabel(selectedClassifier);
    const isLuwianProject = selectedProject === "luwiancorpus";
    const luwianSvgPath =
      isLuwianProject && classifierDisplayMode === "visual"
        ? getLuwianGlyphSvgPath(selectedClassifier)
        : null;
    const luwianImage = luwianSvgPath ? wrapClassifierImage(luwianSvgPath) : null;
    const centerLabel = luwianImage
      ? ""
      : baseLabel || (classifierDisplayMode === "visual" ? formatClassifierId(selectedClassifier) : "");
    const centerFontFace = classifierDisplayMode === "meaning" ? "sans-serif" : classifierFont;
    const centerFontSize = classifierDisplayMode === "meaning" ? 10 : 18;
    const centerNodeId = "center";
    nodes.add({
      id: centerNodeId,
      label: centerLabel,
      mdc: selectedClassifier,
      color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
      font: {
        face: centerFontFace,
        size: centerFontSize,
        color: "#000000",
        align: "center",
        valign: "middle",
        multi: /<[^>]+>/.test(String(centerLabel)) ? "html" : false
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
      title: `${getClassifierBaseLabel(selectedClassifier)}`,
    });

    const shouldUseImage = projectType === "hieroglyphic" && classifierDisplayMode === "visual" && (!useUnicode || !mdc2uni[selectedClassifier]);
    if (shouldUseImage) {
      const cached = classifierImageCache.get(selectedClassifier);
      if (cached) {
        const wrapped = wrapClassifierImage(cached);
        classifierImageCache.set(selectedClassifier, wrapped);
        nodes.update({
          id: centerNodeId,
          shape: "image",
          image: wrapped,
          brokenImage: BROKEN_IMAGE_PLACEHOLDER,
          label: "",
          size: CLF_NODE_HEIGHT,
          color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
          shapeProperties: { borderDashes: false, useBorderWithImage: false, interpolation: false, useImageSize: true },
          widthConstraint: { minimum: CLF_NODE_WIDTH, maximum: CLF_NODE_WIDTH },
          heightConstraint: { minimum: CLF_NODE_HEIGHT, maximum: CLF_NODE_HEIGHT },
        });
      } else {
        const loadCenterImage = async () => {
          startImageLoad();
          try {
            const extendedData = await fetchExtendedSignDataUrl(selectedClassifier);
            if (extendedData) {
              const wrapped = wrapClassifierImage(extendedData);
              classifierImageCache.set(selectedClassifier, wrapped);
              if (lemmaNetworkTokenRef.current !== networkToken) return;
              nodes.update({
                id: centerNodeId,
                shape: "image",
                image: wrapped,
                brokenImage: BROKEN_IMAGE_PLACEHOLDER,
                label: "",
                size: CLF_NODE_HEIGHT,
                color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
                shapeProperties: { borderDashes: false, useBorderWithImage: false, interpolation: false, useImageSize: true },
                widthConstraint: { minimum: CLF_NODE_WIDTH, maximum: CLF_NODE_WIDTH },
                heightConstraint: { minimum: CLF_NODE_HEIGHT, maximum: CLF_NODE_HEIGHT },
              });
              return;
            }
            const base64 = await fetchJseshBase64(selectedClassifier, getJseshRenderHeight(CLF_NODE_HEIGHT), true);
            if (!base64) return;
            const url = wrapClassifierImage(getJseshImageUrl(base64));
            classifierImageCache.set(selectedClassifier, url);
            if (lemmaNetworkTokenRef.current !== networkToken) return;
            nodes.update({
              id: centerNodeId,
              shape: "image",
              image: url,
              brokenImage: BROKEN_IMAGE_PLACEHOLDER,
              label: "",
              size: CLF_NODE_HEIGHT,
              color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
              shapeProperties: { borderDashes: false, useBorderWithImage: false, interpolation: false, useImageSize: true },
              widthConstraint: { minimum: CLF_NODE_WIDTH, maximum: CLF_NODE_WIDTH },
              heightConstraint: { minimum: CLF_NODE_HEIGHT, maximum: CLF_NODE_HEIGHT },
            });
          } catch {
            // ignore image load failures
          } finally {
            finishImageLoad();
          }
        };
        void loadCenterImage();
      }
    }

    const currentDict = lemmaMapMode === "counts" ? lemmaDict : lemmaPercentDict;
    let idCounter = 2;
    Object.entries(currentDict).forEach(([lemmaLabel, value]) => {
      const lemmaId = lemmaLabelToId.get(lemmaLabel);
      const nodeId = lemmaId ? `lemma_${lemmaId}` : `lemma_${idCounter}`;

      // Always show transliteration as label
      const { base } = splitLemmaLabel(lemmaLabel);
      const lemma = lemmaId ? lemmaData[lemmaId] : null;
      const label = lemma
        ? (lemmaDisplayMode === "both"
          ? formatLemmaOriginTranslationLabel(lemma.meaning, lemma.transliteration, base, projectType)
          : lemmaDisplayMode === "translation"
            ? formatLemmaTranslationLabel(lemma.meaning, lemma.transliteration, base, projectType)
            : formatLemmaOriginLabelItalic(lemma.transliteration, base, projectType))
        : formatLemmaOriginLabelItalic(base, base, projectType);

      // Build tooltip showing translation
      let tooltip = label;
      if (lemmaId && lemmaData[lemmaId]) {
        const translation = extractLemmaMeaning(lemmaData[lemmaId].meaning);
        if (translation) {
          tooltip = `${label}\n→ ${translation}`;
        }
      }

      const percentage = Array.isArray(value) ? value[0] : null;
      const edgeWidth = lemmaMapMode === "counts"
        ? (value as number)
        : Math.max((percentage || 0) / 20, 1);
      const nodeFill = lemmaMapMode === "percentages" && typeof percentage === "number"
        ? getHueByPercentage(percentage)
        : "white";
      const edgeColor = "#000000";

        nodes.add({
          id: nodeId,
          label,
          shape: "circle",
          size: CLASSIFIER_LEMMA_NODE_SIZE,
          color: { background: nodeFill, border: "black" },
          font: {
            face: lemmaFont,
            size: CLASSIFIER_LEMMA_FONT_SIZE,
            align: 'center',
            valign: 'top',
            color: '#000000',
            multi: /<[^>]+>/.test(label) ? "html" : true
          },
          type: "lemma",
          title: tooltip,
        });

      edgeList.push({
        from: centerNodeId,
        to: nodeId,
        color: { color: edgeColor },
        width: edgeWidth,
      });
      idCounter += 1;
    });

    const options = {
      interaction: {
        dragNodes: true,
        zoomView: true,
        dragView: true,
      },
      edges: {
        smooth: { enabled: true, type: "dynamic", roundness: 0.18 },
        length: 135,
      },
      physics: {
        barnesHut: {
          centralGravity: 0.18,
          springLength: 135,
          springConstant: 0.04,
          damping: 0.25,
          avoidOverlap: 0.65,
        },
        stabilization: { iterations: stabilizationIterations, fit: false }
      },
    };

    const isCentralityRankMode = lemmaMapMode === "percentages";
    const { edges: scaledEdges, scale } = scaleEdgeWidths(edgeList);
    setLemmaEdgeScale(scale);
    const getNodeOffset = (node: any, edgeWidth: number) => {
      if (!node) return 0;
      const strokeOffset = isCentralityRankMode && Number.isFinite(edgeWidth)
        ? Math.max(edgeWidth / 2, 0)
        : 0;
      const shape = node?.shape || "circle";
      if (shape === "circle" || shape === "dot" || shape === "ellipse") {
        const radius = Number(node?.size) || 20;
        return radius + strokeOffset;
      }
      const widthConstraint = node?.widthConstraint?.minimum ?? node?.widthConstraint?.maximum;
      const heightConstraint = node?.heightConstraint?.minimum ?? node?.heightConstraint?.maximum;
      const width = Number(widthConstraint ?? (node?.size ? node.size * 2 : CLF_NODE_WIDTH));
      const height = Number(heightConstraint ?? (node?.size ? node.size * 2 : CLF_NODE_HEIGHT));
      return Math.max(width, height) / 2 + strokeOffset;
    };
    const edgesWithOffsets = scaledEdges.map((edge) => {
      const edgeWidth = Number(edge.width);
      const fromNode = nodes.get?.(edge.from);
      const toNode = nodes.get?.(edge.to);
      const fromOffset = getNodeOffset(fromNode, edgeWidth);
      const toOffset = getNodeOffset(toNode, edgeWidth);
      return {
        ...edge,
        endPointOffset: {
          from: fromOffset,
          to: toOffset,
        },
      };
    });
    const edges = new VisDataSet(edgesWithOffsets);
    const network = new VisNetwork(lemmaNetworkRef.current, { nodes, edges }, options);
    lemmaNetworkInstance.current = network;
    setLemmaNetworkData({ nodes: nodes.get(), edges: edgesWithOffsets });

    // Ensure the network container doesn't exceed parent bounds
    if (lemmaNetworkRef.current && lemmaNetworkRef.current.parentElement) {
      lemmaNetworkRef.current.parentElement.style.maxWidth = "100%";
      lemmaNetworkRef.current.parentElement.style.overflow = "hidden";
      lemmaNetworkRef.current.style.maxWidth = "100%";
      lemmaNetworkRef.current.style.overflow = "hidden";
    }

    // Set up resize observer for lemma network
    const setupLemmaResizeObserver = () => {
      const container = lemmaNetworkFrameRef.current;
      if (!container || lemmaNetworkResizeObserverRef.current) return;

      lemmaNetworkResizeObserverRef.current = new ResizeObserver(() => {
        try {
          const width = container.clientWidth;
          const height = container.clientHeight;
          if (width > 0 && height > 0 && network && typeof network.setSize === "function") {
            network.setSize(`${width}px`, `${height}px`);
          }
        } catch { /* network may have been destroyed */ }
      });
      lemmaNetworkResizeObserverRef.current.observe(container);
    };

    finalize = () => {
      if (lemmaNetworkTokenRef.current !== networkToken) return;
      if (finalized) return;
      finalized = true;
      window.clearTimeout(fallbackId);

      // Set up resize observer
      setupLemmaResizeObserver();

      if (network && typeof network.setSize === "function") {
        const frame = lemmaNetworkFrameRef.current;
        const container = lemmaNetworkRef.current;
        const width = frame?.clientWidth || container?.clientWidth || DEFAULT_NETWORK_FRAME_SIZE;
        const height = frame?.clientHeight || container?.clientHeight || DEFAULT_NETWORK_FRAME_SIZE;
        network.setSize(`${width}px`, `${height}px`);
      }
      if (network) {
        network.fit({ animation: false });
        if (typeof network.stopSimulation === "function") {
          network.stopSimulation();
        }
        network.setOptions({
          physics: { enabled: false },
          interaction: getInteractionByFrozenState(true),
        });
        network.redraw();
      }
      setIsLemmaNetworkFrozen(true);
    };
    fallbackId = window.setTimeout(() => {
      if (lemmaNetworkTokenRef.current !== networkToken) return;
      stabilized = true;
      imagesReady = true;
      finalize();
    }, 6000);
    network.once("stabilizationIterationsDone", () => {
      stabilized = true;
      maybeFinalize();
    });

    let lastClickTime = 0;
    let clickTimeout: any = null;
    let mouseDownTime = 0;
    let isLongPress = false;

    // Track mouse down to detect long press
    network.on("selectNode", (params: any) => {
      mouseDownTime = Date.now();
      isLongPress = false;
    });

    // Helper function to update all lemma nodes to a specific mode
    const updateAllLemmaNodes = (mode: 'origin' | 'translation' | 'both') => {
      const net = lemmaNetworkInstance.current;
      if (!net) return;

      const nodes = net.body?.data?.nodes;
      if (!nodes) return;

      const allNodeIds = nodes.getIds() as string[];
      const updates: any[] = [];

      allNodeIds.forEach((nodeId: string) => {
        if (nodeId.startsWith("lemma_")) {
          const lemmaId = nodeId.replace("lemma_", "");
          const lemma = lemmaData[parseInt(lemmaId, 10)];
          if (!lemma) return;

          const newLabel = mode === 'both'
            ? formatLemmaOriginTranslationLabel(lemma.meaning, lemma.transliteration, String(lemmaId), projectType)
            : mode === 'translation'
              ? formatLemmaTranslationLabel(lemma.meaning, lemma.transliteration, String(lemmaId), projectType)
              : formatLemmaOriginLabelItalic(lemma.transliteration, String(lemmaId), projectType);

          const lemmaFont = getLemmaNodeFontFace(projectType);

          updates.push({
            id: nodeId,
            label: newLabel,
            font: {
              face: lemmaFont,
              size: CLASSIFIER_LEMMA_FONT_SIZE,
              align: 'center',
              valign: 'top',
              color: '#000000',
              multi: /<[^>]+>/.test(newLabel) ? "html" : true
            }
          });
        }
      });

      if (updates.length > 0) {
        net.setOptions({ physics: false });
        nodes.update(updates);
        net.setOptions({ physics: { enabled: false } });
        setLemmaDisplayMode(mode);
      }
    };

    network.on("click", (params: any) => {
      if (params.nodes.length === 0) return;

      const nodeId = String(params.nodes[0]);
      const currentTime = Date.now();
      const pressDuration = currentTime - mouseDownTime;
      const isDoubleClick = currentTime - lastClickTime < 300;
      const isLongPressClick = pressDuration > 500; // Long press if held for 500ms+

      if (isLongPressClick) {
        // Long press - update ALL nodes to translation mode
        if (clickTimeout) clearTimeout(clickTimeout);
        updateAllLemmaNodes('translation');
        isLongPress = true;
      } else if (!isDoubleClick) {
        // Single click - toggle individual node mode
        clickTimeout = setTimeout(() => {
          if (nodeId.startsWith("lemma_")) {
            const newMode = lemmaDisplayModeRef.current === 'origin'
              ? 'translation'
              : lemmaDisplayModeRef.current === 'translation'
                ? 'both'
                : 'origin';
            const lemmaId = nodeId.replace("lemma_", "");
            const lemma = lemmaData[parseInt(lemmaId, 10)];
            if (!lemma) return;

            // Get the new label based on mode
            const newLabel = newMode === 'both'
              ? formatLemmaOriginTranslationLabel(lemma.meaning, lemma.transliteration, String(lemmaId), projectType)
              : newMode === 'translation'
                ? formatLemmaTranslationLabel(lemma.meaning, lemma.transliteration, String(lemmaId), projectType)
                : formatLemmaOriginLabelItalic(lemma.transliteration, String(lemmaId), projectType);

            // Disable physics, update node label, and update state
            const net = lemmaNetworkInstance.current;
            if (net) {
              // Temporarily disable physics
              net.setOptions({ physics: false });

              // Update node label directly without redrawing
              const nodes = net.body?.data?.nodes;
              if (nodes) {
                const lemmaFont = getLemmaNodeFontFace(projectType);
                nodes.update({
                  id: nodeId,
                  label: newLabel,
                  font: {
                    face: lemmaFont,
                    size: CLASSIFIER_LEMMA_FONT_SIZE,
                    align: 'center',
                    valign: 'top',
                    color: '#000000',
                    multi: /<[^>]+>/.test(newLabel) ? "html" : true
                  }
                });
              }

              // Keep physics disabled
              net.setOptions({ physics: { enabled: false } });
            }

            // Update state for consistency (won't trigger network recreation because display modes are not in network creation dependencies)
            setLemmaDisplayMode(newMode);
          }
        }, 150);
      } else {
        // Double click - navigate
        if (clickTimeout) clearTimeout(clickTimeout);

        if (nodeId.startsWith("lemma_")) {
          const lemmaId = nodeId.replace("lemma_", "");
          setClassifierSearchQuery("");
          setIsClassifierSearchFocused(false);
          openLemma(lemmaId);
        }
      }

      lastClickTime = currentTime;
    });
  }, [
    selectedClassifier,
    lemmaDict,
    lemmaPercentDict,
    lemmaMapMode,
    lemmaLabelToId,
    projectType,
    useUnicode,
    lemmaData,
    getClassifierDisplay,
    getClassifierBaseLabel,
    getClassifierNodeLabel,
    formatClassifierId,
    openLemma,
    visReady,
  ]);

  const createClfNetwork = useCallback(() => {
    if (!visReady || !clfNetworkRef.current || !VisNetwork || !VisDataSet || !selectedClassifier) return;

    if (clfNetworkInstance.current) {
      clfNetworkInstance.current.destroy();
    }

    const networkToken = ++clfNetworkTokenRef.current;
    setIsClfNetworkFrozen(false);

    let pendingImages = 0;
    let stabilized = false;
    let imagesReady = true;
    let finalized = false;
    let fallbackId = 0;

    const startImageLoad = () => {
      pendingImages += 1;
      imagesReady = false;
    };

    const finishImageLoad = () => {
      pendingImages = Math.max(pendingImages - 1, 0);
      if (pendingImages === 0) {
        imagesReady = true;
      }
      // Redraw after image update so frozen network shows the new image
      try { network.redraw(); } catch { /* network may be destroyed */ }
      maybeFinalize();
    };

    let finalize = () => {};
    const maybeFinalize = () => {
      if (clfNetworkTokenRef.current !== networkToken) return;
      if (finalized || !stabilized || !imagesReady) return;
      finalize();
    };

    const nodes = new VisDataSet();
    const edgeList: any[] = [];
    const lemmaFont = getLemmaNodeFontFace(projectType);
    const classifierFont = projectType === "hieroglyphic" ? (useUnicode ? "eot" : "hierofont") : lemmaFont;
    const isLuwianProject = selectedProject === "luwiancorpus";

    const rawCenterLabel = getClassifierNodeLabel(selectedClassifier);
    let nodeLabel = typeof rawCenterLabel === "string" ? rawCenterLabel : "";
    const luwianCenterSvgPath =
      isLuwianProject && classifierDisplayMode === "visual"
        ? getLuwianGlyphSvgPath(selectedClassifier)
        : null;
    const luwianCenterImage = luwianCenterSvgPath ? wrapClassifierImage(luwianCenterSvgPath) : null;
    if (luwianCenterImage) {
      nodeLabel = "";
    } else if (!nodeLabel && classifierDisplayMode === "visual") {
      nodeLabel = formatClassifierId(selectedClassifier);
    }
    const centerFontFace = classifierDisplayMode === "meaning" ? "sans-serif" : classifierFont;
    const centerFontSize = classifierDisplayMode === "meaning" ? 10 : 18;
    const needsCenterJsesh = projectType === "hieroglyphic"
      && classifierDisplayMode === "visual"
      && !(useUnicode && mdc2uni[selectedClassifier]);
    const centerExtendedSignUrl = needsCenterJsesh ? getExtendedSignUrl(selectedClassifier) : null;
    if (needsCenterJsesh && !centerExtendedSignUrl && !nodeLabel) {
      nodeLabel = formatClassifierId(selectedClassifier);
    }
    const centerNodeId = "center";
    nodes.add({
      id: centerNodeId,
      label: nodeLabel,
      mdc: selectedClassifier,
      color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
      font: {
        face: centerFontFace,
        size: centerFontSize,
        color: "#000000",
        align: "center",
        valign: "middle",
        multi: /<[^>]+>/.test(String(nodeLabel ?? "")) ? "html" : false
      },
      size: CLF_NODE_HEIGHT,
      shape: luwianCenterImage ? "image" : "box",
      image: luwianCenterImage || undefined,
      brokenImage: luwianCenterImage ? BROKEN_IMAGE_PLACEHOLDER : undefined,
      shapeProperties: luwianCenterImage
        ? { borderDashes: false, useBorderWithImage: false, interpolation: false, useImageSize: true }
        : { borderRadius: CLF_NODE_RADIUS, borderDashes: false },
      widthConstraint: { minimum: CLF_NODE_WIDTH, maximum: CLF_NODE_WIDTH },
      heightConstraint: { minimum: CLF_NODE_HEIGHT, maximum: CLF_NODE_HEIGHT },
      title: `${getClassifierBaseLabel(selectedClassifier)}`,
    });

    const shouldUseImage = needsCenterJsesh;
    if (shouldUseImage) {
      const cached = classifierImageCache.get(selectedClassifier);
      if (cached) {
        const wrapped = wrapClassifierImage(cached);
        classifierImageCache.set(selectedClassifier, wrapped);
        nodes.update({
          id: centerNodeId,
          shape: "image",
          image: wrapped,
          brokenImage: BROKEN_IMAGE_PLACEHOLDER,
          label: "",
          size: CLF_NODE_HEIGHT,
          color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
          shapeProperties: { borderDashes: false, useBorderWithImage: false, interpolation: false, useImageSize: true },
          widthConstraint: { minimum: CLF_NODE_WIDTH, maximum: CLF_NODE_WIDTH },
          heightConstraint: { minimum: CLF_NODE_HEIGHT, maximum: CLF_NODE_HEIGHT },
        });
      } else {
        const loadCenterImage = async () => {
          startImageLoad();
          try {
            if (centerExtendedSignUrl) {
              const extendedData = await fetchExtendedSignDataUrl(selectedClassifier);
              if (extendedData) {
                const wrapped = wrapClassifierImage(extendedData);
                classifierImageCache.set(selectedClassifier, wrapped);
                if (clfNetworkTokenRef.current !== networkToken) return;
                nodes.update({
                  id: centerNodeId,
                  shape: "image",
                  image: wrapped,
                  brokenImage: BROKEN_IMAGE_PLACEHOLDER,
                  label: "",
                  size: CLF_NODE_HEIGHT,
                  color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
                  shapeProperties: { borderDashes: false, useBorderWithImage: false, interpolation: false, useImageSize: true },
                  widthConstraint: { minimum: CLF_NODE_WIDTH, maximum: CLF_NODE_WIDTH },
                  heightConstraint: { minimum: CLF_NODE_HEIGHT, maximum: CLF_NODE_HEIGHT },
                });
                return;
              }
            }
            const base64 = await fetchJseshBase64(selectedClassifier, getJseshRenderHeight(CLF_NODE_HEIGHT), true);
            if (!base64) return;
            const url = wrapClassifierImage(getJseshImageUrl(base64));
            classifierImageCache.set(selectedClassifier, url);
            if (clfNetworkTokenRef.current !== networkToken) return;
            nodes.update({
              id: centerNodeId,
              shape: "image",
              image: url,
              brokenImage: BROKEN_IMAGE_PLACEHOLDER,
              label: "",
              size: CLF_NODE_HEIGHT,
              color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
              shapeProperties: { borderDashes: false, useBorderWithImage: false, interpolation: false, useImageSize: true },
              widthConstraint: { minimum: CLF_NODE_WIDTH, maximum: CLF_NODE_WIDTH },
              heightConstraint: { minimum: CLF_NODE_HEIGHT, maximum: CLF_NODE_HEIGHT },
            });
          } catch {
            // ignore image load failures
          } finally {
            finishImageLoad();
          }
        };
        void loadCenterImage();
      }
    }

    let idCounter = 2;
    Object.entries(clfDict).forEach(([clf, count]) => {
      const normalizedClf = clf.trim();
      // Always show visual mode (glyph or MDC) - not dependent on display mode state
      const isHieroglyphic = projectType === "hieroglyphic";
      const hasUnicodeGlyph = isHieroglyphic && useUnicode && Boolean(mdc2uni[normalizedClf]);
      const needsJseshGlyph = isHieroglyphic
        && classifierDisplayMode === "visual"
        && !hasUnicodeGlyph;
      const luwianSvgPath =
        isLuwianProject && classifierDisplayMode === "visual"
          ? getLuwianGlyphSvgPath(clf)
          : null;
      const luwianImage = luwianSvgPath ? wrapClassifierImage(luwianSvgPath) : null;
      const cachedImage = needsJseshGlyph ? classifierImageCache.get(normalizedClf) : null;
      const wrappedImage = cachedImage ? wrapClassifierImage(cachedImage) : null;
      if (wrappedImage && wrappedImage !== cachedImage) {
        classifierImageCache.set(clf, wrappedImage);
      }
      let label = '';
      if (classifierDisplayMode === "meaning") {
        label = formatClassifierMeaningLabel(mergedClassifierMeanings?.[clf], selectedProject, { html: true }) || '';
      } else if (luwianImage) {
        label = '';
      } else if (!isHieroglyphic) {
        label = clf;
      } else if (hasUnicodeGlyph) {
        label = mdc2uni[normalizedClf] || '';
      } else if (!wrappedImage) {
        label = formatClassifierId(normalizedClf);
      }

      const nodeId = `clf_${idCounter}`;

      // Build tooltip showing meaning (plain text)
      const meaning = formatClassifierMeaning(mergedClassifierMeanings?.[clf], selectedProject);
      const meaningLabelText = meaning ? `[${meaning}]` : '';
      let tooltip = classifierDisplayMode === "meaning" ? meaningLabelText : label;
      if (meaning) {
        tooltip = `${meaningLabelText}\n→ ${meaning}`;
      }

      const fontFace = classifierDisplayMode === "meaning" ? "sans-serif" : classifierFont;
      const fontSize = classifierDisplayMode === "meaning" ? 10 : (hasUnicodeGlyph ? 18 : 11);
      const nodeImage = luwianImage || wrappedImage;

      nodes.add({
        id: nodeId,
        label: nodeImage ? "" : label,
        mdc: clf,
        color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
        font: {
          face: fontFace,
          size: fontSize,
          color: "#000000",
          align: "center",
          valign: "middle",
          multi: /<[^>]+>/.test(label) ? "html" : false
        },
        size: CLF_NODE_HEIGHT,
        shape: nodeImage ? "image" : "box",
        image: nodeImage || undefined,
        brokenImage: nodeImage ? BROKEN_IMAGE_PLACEHOLDER : undefined,
        shapeProperties: nodeImage
          ? { borderDashes: false, useBorderWithImage: false, interpolation: false, useImageSize: true }
          : { borderRadius: CLF_NODE_RADIUS, borderDashes: false },
        widthConstraint: { minimum: CLF_NODE_WIDTH, maximum: CLF_NODE_WIDTH },
        heightConstraint: { minimum: CLF_NODE_HEIGHT, maximum: CLF_NODE_HEIGHT },
        title: tooltip,
      });

      edgeList.push({
        from: centerNodeId,
        to: nodeId,
        width: count,
        length: 5.0 / Math.max(count, 1),
        color: { color: CLASSIFIER_COOCCURRENCE_EDGE_COLOR },
      });

      if (needsJseshGlyph && !wrappedImage) {
        const loadClassifierImage = async () => {
          startImageLoad();
          try {
            const extendedData = await fetchExtendedSignDataUrl(clf);
            if (extendedData) {
              const wrapped = wrapClassifierImage(extendedData);
                classifierImageCache.set(normalizedClf, wrapped);
              if (clfNetworkTokenRef.current !== networkToken) return;
              nodes.update({
                id: nodeId,
                shape: "image",
                image: wrapped,
                brokenImage: BROKEN_IMAGE_PLACEHOLDER,
                label: "",
                size: CLF_NODE_HEIGHT,
                color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
                shapeProperties: { borderDashes: false, useBorderWithImage: false, interpolation: false, useImageSize: true },
                widthConstraint: { minimum: CLF_NODE_WIDTH, maximum: CLF_NODE_WIDTH },
                heightConstraint: { minimum: CLF_NODE_HEIGHT, maximum: CLF_NODE_HEIGHT },
              });
              return;
            }
            const base64 = await fetchJseshBase64(normalizedClf, getJseshRenderHeight(CLF_NODE_HEIGHT), true);
            if (!base64) return;
            const url = wrapClassifierImage(getJseshImageUrl(base64));
            classifierImageCache.set(normalizedClf, url);
            if (clfNetworkTokenRef.current !== networkToken) return;
            nodes.update({
              id: nodeId,
              shape: "image",
              image: url,
              brokenImage: BROKEN_IMAGE_PLACEHOLDER,
              label: "",
              size: CLF_NODE_HEIGHT,
              color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
              shapeProperties: { borderDashes: false, useBorderWithImage: false, interpolation: false, useImageSize: true },
              widthConstraint: { minimum: CLF_NODE_WIDTH, maximum: CLF_NODE_WIDTH },
              heightConstraint: { minimum: CLF_NODE_HEIGHT, maximum: CLF_NODE_HEIGHT },
            });
          } catch {
            // ignore image load failures
          } finally {
            finishImageLoad();
          }
        };
        void loadClassifierImage();
      }

      idCounter += 1;
    });

    const options = {
      nodes: {
        shape: "box",
        shapeProperties: { borderRadius: CLF_NODE_RADIUS, borderDashes: false },
      },
      edges: {
        smooth: { enabled: true, type: "dynamic", roundness: 0.18 },
        length: 130,
      },
      interaction: {
        hover: true,
        dragNodes: true,
        zoomView: true,
        dragView: true,
      },
      physics: {
        enabled: true,
        barnesHut: {
          centralGravity: 0.18,
          springLength: 130,
          springConstant: 0.04,
          damping: 0.25,
          avoidOverlap: 0.65,
        },
        stabilization: { iterations: stabilizationIterations, fit: false }
      },
    };

    nodes.forEach((node: any) => {
      if (typeof node.label !== "string") {
        nodes.update({ id: node.id, label: "" });
      }
    });
    const { edges: scaledEdges, scale } = scaleEdgeWidths(edgeList);
    setClfEdgeScale(scale);
    const edges = new VisDataSet(scaledEdges);
    const network = new VisNetwork(clfNetworkRef.current, { nodes, edges }, options);
    clfNetworkInstance.current = network;
    setClfNetworkData({ nodes: nodes.get(), edges: scaledEdges });

    // Ensure the network container doesn't exceed parent bounds
    if (clfNetworkRef.current && clfNetworkRef.current.parentElement) {
      clfNetworkRef.current.parentElement.style.maxWidth = "100%";
      clfNetworkRef.current.parentElement.style.overflow = "hidden";
      clfNetworkRef.current.style.maxWidth = "100%";
      clfNetworkRef.current.style.overflow = "hidden";
    }

    // Set up resize observer for classifier network
    const setupClfResizeObserver = () => {
      const container = clfNetworkFrameRef.current;
      if (!container || clfNetworkResizeObserverRef.current) return;

      clfNetworkResizeObserverRef.current = new ResizeObserver(() => {
        try {
          const width = container.clientWidth;
          const height = container.clientHeight;
          if (width > 0 && height > 0 && network && typeof network.setSize === "function") {
            network.setSize(`${width}px`, `${height}px`);
          }
        } catch { /* network may have been destroyed */ }
      });
      clfNetworkResizeObserverRef.current.observe(container);
    };

    finalize = () => {
      if (clfNetworkTokenRef.current !== networkToken) return;
      if (finalized) return;
      finalized = true;
      window.clearTimeout(fallbackId);

      // Set up resize observer
      setupClfResizeObserver();

      if (network && typeof network.setSize === "function") {
        const frame = clfNetworkFrameRef.current;
        const container = clfNetworkRef.current;
        const width = frame?.clientWidth || container?.clientWidth || DEFAULT_NETWORK_FRAME_SIZE;
        const height = frame?.clientHeight || container?.clientHeight || DEFAULT_NETWORK_FRAME_SIZE;
        network.setSize(`${width}px`, `${height}px`);
      }
      if (network) {
        network.fit({ animation: false });
        if (typeof network.stopSimulation === "function") {
          network.stopSimulation();
        }
        network.setOptions({
          physics: { enabled: false },
          interaction: getInteractionByFrozenState(true),
        });
        network.redraw();
      }
      setIsClfNetworkFrozen(true);
    };
    fallbackId = window.setTimeout(() => {
      if (clfNetworkTokenRef.current !== networkToken) return;
      stabilized = true;
      imagesReady = true;
      finalize();
    }, 7000);
    network.once("stabilizationIterationsDone", () => {
      stabilized = true;
      maybeFinalize();
    });

    let clfLastClickTime = 0;
    let clfClickTimeout: any = null;

    network.on("click", (params: any) => {
      if (params.nodes.length === 0) return;

      const nodeId = String(params.nodes[0]);
      const currentTime = Date.now();
      const isDoubleClick = currentTime - clfLastClickTime < 300;

      if (!isDoubleClick) {
        // Single click - toggle mode
        clfClickTimeout = setTimeout(() => {
          // Disable physics before updating
          network.setOptions({ physics: false });

          if (nodeId === centerNodeId) {
            // Toggle classifier display mode for center node
            const newMode = classifierDisplayModeRef.current === 'visual' ? 'meaning' : 'visual';

            // Update center node label
            const nodeData = nodes.get(centerNodeId);
            const clf = nodeData?.mdc || selectedClassifier;
            if (clf) {
              let newLabel = '';
              if (newMode === 'meaning') {
                newLabel = formatClassifierMeaningLabel(mergedClassifierMeanings?.[clf], selectedProject, { html: true }) || '';
              } else {
                const glyph = useUnicode && mdc2uni[clf] ? mdc2uni[clf] : '';
                newLabel = glyph;
              }
              nodes.update({
                id: centerNodeId,
                label: newLabel,
                font: {
                  face: newMode === "meaning" ? "sans-serif" : classifierFont,
                  size: newMode === "meaning" ? 10 : 18,
                  color: "#000000",
                  align: "center",
                  valign: "middle",
                  multi: /<[^>]+>/.test(newLabel) ? "html" : false
                }
              });
            }

            setClassifierDisplayMode(newMode);
          } else {
            // Toggle display mode for other classifier nodes
            const newMode = classifierDisplayModeRef.current === 'visual' ? 'meaning' : 'visual';

            const nodeData = nodes.get(nodeId);
            const clf = nodeData?.mdc;
            if (clf) {
              // Get new label based on mode
              let newLabel = '';
              if (newMode === 'meaning') {
                newLabel = formatClassifierMeaningLabel(mergedClassifierMeanings?.[clf], selectedProject, { html: true }) || '';
              } else {
                const glyph = useUnicode && mdc2uni[clf] ? mdc2uni[clf] : '';
                newLabel = glyph;
              }

              nodes.update({
                id: nodeId,
                label: newLabel,
                font: {
                  face: newMode === "meaning" ? "sans-serif" : classifierFont,
                  size: newMode === "meaning" ? 10 : 18,
                  color: "#000000",
                  align: "center",
                  valign: "middle",
                  multi: /<[^>]+>/.test(newLabel) ? "html" : false
                }
              });
            }

            setClassifierDisplayMode(newMode);
          }
        }, 150);
      } else {
        // Double click - navigate
        if (clfClickTimeout) clearTimeout(clfClickTimeout);

        if (nodeId === centerNodeId) return;

        const nodeData = nodes.get(nodeId);
        const mdc = nodeData?.mdc || nodeData?.label;
        if (!mdc) return;

        // Navigate to classifier on double-click
        openClassifier(String(mdc));
      }

      clfLastClickTime = currentTime;
    });
  }, [
    selectedClassifier,
    clfDict,
    projectType,
    useUnicode,
    navigate,
    selectedProject,
    mergedClassifierMeanings,
    classifierDisplayMode,
    formatClassifierId,
    openClassifier,
    visReady,
  ]);

  useEffect(() => {
    if (!selectedClassifier) return;
    const idleId = scheduleIdle(() => {
      createLemmaNetwork();
    }, 1500);
    return () => {
      cancelIdle(idleId);
      // Cleanup resize observer when unmounting or data changes
      if (lemmaNetworkResizeObserverRef.current) {
        lemmaNetworkResizeObserverRef.current.disconnect();
        lemmaNetworkResizeObserverRef.current = null;
      }
    };
  }, [visReady, selectedClassifier, lemmaDict, lemmaPercentDict, lemmaMapMode, useUnicode, createLemmaNetwork, scheduleIdle, cancelIdle]);

  // Handle lemma display mode changes - update all nodes in the network
  useEffect(() => {
    if (!selectedClassifier || !lemmaNetworkInstance.current) return;

    const net = lemmaNetworkInstance.current;
    const nodes = net.body?.data?.nodes;
    if (!nodes) return;

    const allNodeIds = nodes.getIds() as string[];
    const updates: any[] = [];

    allNodeIds.forEach((nodeId: string) => {
      if (nodeId.startsWith("lemma_")) {
        const lemmaId = nodeId.replace("lemma_", "");
        const lemma = lemmaData[parseInt(lemmaId, 10)];
        if (!lemma) return;

        const newLabel = lemmaDisplayMode === 'both'
          ? formatLemmaOriginTranslationLabel(lemma.meaning, lemma.transliteration, String(lemmaId), projectType)
          : lemmaDisplayMode === 'translation'
            ? formatLemmaTranslationLabel(lemma.meaning, lemma.transliteration, String(lemmaId), projectType)
            : formatLemmaOriginLabelItalic(lemma.transliteration, String(lemmaId), projectType);

        const lemmaFont = getLemmaNodeFontFace(projectType);

        updates.push({
          id: nodeId,
          label: newLabel,
          font: {
            face: lemmaFont,
            size: CLASSIFIER_LEMMA_FONT_SIZE,
            align: 'center',
            valign: 'top',
            color: '#000000',
            multi: /<[^>]+>/.test(newLabel) ? "html" : true
          }
        });
      }
    });

    if (updates.length > 0) {
      net.setOptions({ physics: false });
      nodes.update(updates);
      net.setOptions({ physics: { enabled: false } });
    }
  }, [selectedClassifier, lemmaDisplayMode, lemmaData, projectType]);

  useEffect(() => {
    if (!selectedClassifier) return;
    const idleId = scheduleIdle(() => {
      createClfNetwork();
    }, 1500);
    return () => {
      cancelIdle(idleId);
      // Cleanup resize observer when unmounting or data changes
      if (clfNetworkResizeObserverRef.current) {
        clfNetworkResizeObserverRef.current.disconnect();
        clfNetworkResizeObserverRef.current = null;
      }
    };
  }, [visReady, selectedClassifier, clfDict, useUnicode, createClfNetwork, scheduleIdle, cancelIdle]);

  // Sort statistics for display
  const sortedLemmaStats = useMemo(() => {
    return Object.entries(lemmaDict).sort((a, b) => b[1] - a[1]);
  }, [lemmaDict]);

  const sortedComStats = useMemo(() => {
    return Object.entries(comDict).sort((a, b) => b[1] - a[1]);
  }, [comDict]);

  const sortedScrStats = useMemo(() => {
    return Object.entries(scrDict).sort((a, b) => b[1] - a[1]);
  }, [scrDict]);

  const sortedPosStats = useMemo(() => {
    return Object.entries(posDict).sort((a, b) => b[1] - a[1]);
  }, [posDict]);

  const sortedClfStats = useMemo(() => {
    return Object.entries(clfDict).sort((a, b) => b[1] - a[1]);
  }, [clfDict]);

  const sortedOrdStats = useMemo(() => {
    return Object.entries(ordDict).sort((a, b) => b[1] - a[1]);
  }, [ordDict]);

  const sortedLemmaPercentStats = useMemo(() => {
    return Object.entries(lemmaPercentDict).sort((a, b) => b[1][0] - a[1][0]);
  }, [lemmaPercentDict]);

  const hostLemmaListText = useMemo(() => {
    if (sortedLemmaStats.length === 0) return "";
    const header = ["Lemma", "Number of examples", "Percentage", "Counts"].join("\t");
    const rows = sortedLemmaStats.map(([lemma, count]) => {
      const percentData = lemmaPercentDict?.[lemma];
      const percentValue = percentData?.[0];
      const percentCount = percentData?.[1];
      return [
        lemma,
        String(count ?? ""),
        typeof percentValue === "number" ? `${percentValue}%` : "",
        percentCount ?? ""
      ].join("\t");
    });
    return [header, ...rows].join("\n");
  }, [sortedLemmaStats, lemmaPercentDict]);

  const tokenListText = useMemo(() => {
    if (!tokensForClassifier.length) return "";
    const header = ["Token", "Syntactic relation", "Lemma", "Text", "Coordinates", "POS"].join("\t");
    const rows = tokensForClassifier.map((token: any) => {
      const tokenMdc = token.mdc || token.mdc_w_markup || "";
      const tokenContext = String(token.syntactic_relation || "").trim();
      const lemma = token.lemma_id ? lemmaData[token.lemma_id] : null;
      const lemmaLabel = lemma ? formatLemmaLabel(lemma) : "";
      const witness = witnessData[token.witness_id];
      const witnessLabel = witness ? (witness.name || witness.id) : "";
      const coords = token.coordinates_in_witness || "";
      const pos = token.pos || "";
      return [tokenMdc, tokenContext, lemmaLabel, witnessLabel, coords, pos].join("\t");
    });
    return [header, ...rows].join("\n");
  }, [tokensForClassifier, lemmaData, witnessData]);

  useLayoutEffect(() => {
    const target = lemmaNetworkCardRef.current;
    if (!target || lemmaNetworkFullscreenActive) {
      setHostLemmaCardHeight(null);
      return;
    }
    const update = () => {
      const height = Math.round(target.scrollHeight || 0);
      if (height > 0) {
        setHostLemmaCardHeight(height);
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(target);
    return () => observer.disconnect();
  }, [lemmaNetworkFullscreenActive]);

  useLayoutEffect(() => {
    const target = statsContentRef.current;
    if (!target) {
      setStatsContentHeight(null);
      return;
    }
    const update = () => {
      const height = Math.round(target.getBoundingClientRect().height || 0);
      if (height > 0) {
        setStatsContentHeight(height);
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);


  useLayoutEffect(() => {
    if (isHostLemmaListExpanded) return;
    const listEl = hostLemmaListRef.current;
    if (!listEl) return;
    const checkOverflow = () => {
      const overflow = listEl.scrollHeight > listEl.clientHeight + 1;
      setHostLemmaHasOverflow(overflow);
    };
    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(listEl);
    return () => observer.disconnect();
  }, [sortedLemmaStats, isHostLemmaListExpanded, hostLemmaCardHeight, isComparisonRoute]);


  // Handle classifier selection
  const handleClassifierSelect = (classifier: string) => {
    setIsFilterMenuExpanded(false);
    if (selectedProject) {
      openClassifier(classifier);
      // Scroll to report content after selection
      setTimeout(() => {
        const reportContent = document.querySelector('[id="classifier-report-content"]');
        if (reportContent) {
          reportContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  const applyWitnessSelection = () => {
    setAppliedWitnesses(new Set(selectedWitnesses));
  };

  const applyPOSSelection = () => {
    setAppliedPOS(new Set(selectedPOS));
  };

  const applyScriptSelection = () => {
    setAppliedScripts(new Set(selectedScripts));
  };

  const toggleBackground = (element: HTMLDivElement | null) => {
    if (!element) return;
    const current = element.style.backgroundColor || "white";
    element.style.backgroundColor = current === "white" ? "black" : "white";
  };

  const goFullScreen = (element: HTMLDivElement | null) => {
    if (!element) return;
    if (element.requestFullscreen) {
      element.requestFullscreen();
    }
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  const openReportType = useCallback(
    (type: "project" | "network" | "lemma" | "classifier" | "query") => {
      if (setCompareTarget({ type })) return;
      if (type === "project") {
        navigate(`/project/${selectedProject}`);
      } else if (type === "network") {
        navigate(`/project/${selectedProject}/network`);
      } else if (type === "lemma") {
        navigate(`/project/${selectedProject}/lemma`);
      } else if (type === "classifier") {
        navigate(`/project/${selectedProject}/classifier`);
      } else if (type === "query") {
        navigate(`/project/${selectedProject}/query-report`);
      }
    },
    [navigate, selectedProject, setCompareTarget]
  );

  const toggleLemmaNetworkFreeze = useCallback(() => {
    if (lemmaNetworkInstance.current) {
      if (isLemmaNetworkFrozen) {
        lemmaNetworkInstance.current.setOptions({
          physics: { enabled: true },
          interaction: getInteractionByFrozenState(false),
        });
        if (typeof lemmaNetworkInstance.current.startSimulation === "function") {
          lemmaNetworkInstance.current.startSimulation();
        }
      } else {
        if (typeof lemmaNetworkInstance.current.stopSimulation === "function") {
          lemmaNetworkInstance.current.stopSimulation();
        }
        if (typeof lemmaNetworkInstance.current.fit === "function") {
          lemmaNetworkInstance.current.fit({ animation: false });
        }
        lemmaNetworkInstance.current.setOptions({
          physics: { enabled: false },
          interaction: getInteractionByFrozenState(true),
        });
      }
      lemmaNetworkInstance.current.redraw();
      setIsLemmaNetworkFrozen(!isLemmaNetworkFrozen);
    }
  }, [isLemmaNetworkFrozen]);

  const toggleClfNetworkFreeze = useCallback(() => {
    if (clfNetworkInstance.current) {
      if (isClfNetworkFrozen) {
        clfNetworkInstance.current.setOptions({
          physics: { enabled: true },
          interaction: getInteractionByFrozenState(false),
        });
        if (typeof clfNetworkInstance.current.startSimulation === "function") {
          clfNetworkInstance.current.startSimulation();
        }
      } else {
        if (typeof clfNetworkInstance.current.stopSimulation === "function") {
          clfNetworkInstance.current.stopSimulation();
        }
        if (typeof clfNetworkInstance.current.fit === "function") {
          clfNetworkInstance.current.fit({ animation: false });
        }
        clfNetworkInstance.current.setOptions({
          physics: { enabled: false },
          interaction: getInteractionByFrozenState(true),
        });
      }
      clfNetworkInstance.current.redraw();
      setIsClfNetworkFrozen(!isClfNetworkFrozen);
    }
  }, [isClfNetworkFrozen]);

  const isSearchActive = Boolean(classifierSearchQuery || isClassifierSearchFocused);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsLemmaNetworkFullscreen(document.fullscreenElement === lemmaNetworkCardRef.current);
      setIsClfNetworkFullscreen(document.fullscreenElement === clfNetworkCardRef.current);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.fullscreenElement === lemmaNetworkCardRef.current) {
        exitFullscreen();
      }
      if (document.fullscreenElement === clfNetworkCardRef.current) {
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
  }, []);

  useEffect(() => {
    if (lemmaNetworkInstance.current) {
      if (typeof lemmaNetworkInstance.current.setSize === "function") {
        lemmaNetworkInstance.current.setSize("100%", "100%");
      }
      if (typeof lemmaNetworkInstance.current.redraw === "function") {
        lemmaNetworkInstance.current.redraw();
      }
      if (typeof lemmaNetworkInstance.current.fit === "function") {
        lemmaNetworkInstance.current.fit({ animation: false });
      }
    }
  }, [lemmaNetworkFullscreenActive]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    if (!lemmaNetworkFrameRef.current) return;
    const frame = lemmaNetworkFrameRef.current;
    const observer = new ResizeObserver(() => {
      const net = lemmaNetworkInstance.current;
      if (!net) return;
      if (typeof net.setSize === "function") {
        net.setSize("100%", "100%");
      }
      if (typeof net.redraw === "function") {
        net.redraw();
      }
      if (typeof net.fit === "function") {
        net.fit({ animation: false });
      }
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (clfNetworkInstance.current) {
      if (typeof clfNetworkInstance.current.setSize === "function") {
        clfNetworkInstance.current.setSize("100%", "100%");
      }
      if (typeof clfNetworkInstance.current.redraw === "function") {
        clfNetworkInstance.current.redraw();
      }
      if (typeof clfNetworkInstance.current.fit === "function") {
        clfNetworkInstance.current.fit({ animation: false });
      }
    }
  }, [clfNetworkFullscreenActive]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    if (!clfNetworkFrameRef.current) return;
    const frame = clfNetworkFrameRef.current;
    const observer = new ResizeObserver(() => {
      const net = clfNetworkInstance.current;
      if (!net) return;
      if (typeof net.setSize === "function") {
        net.setSize("100%", "100%");
      }
      if (typeof net.redraw === "function") {
        net.redraw();
      }
      if (typeof net.fit === "function") {
        net.fit({ animation: false });
      }
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-64">
          <NetworkLoader title="Loading classifier data..." />
        </div>
      </SidebarLayout>
    );
  }

  if (error) {
    return (
      <SidebarLayout>
        <div className="text-center py-8">
          <p className="text-red-600">Error loading data: {error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-3"
          >
            Retry
          </Button>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="w-full flex flex-col">
        <div className={cn(pageWidthClass, pagePaddingClass)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size={actionButtonSize}
                onClick={() => navigate("/")}
                className="flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Select Project
              </Button>
              <div className="flex items-center gap-3">
                {selectedProjectInfo?.image && (
                  <img
                    src={selectedProjectInfo.image}
                    alt={selectedProjectInfo.name}
                    className="w-8 h-8 rounded object-cover"
                  />
                )}
                <div>
                  <h1 className="text-3xl font-bold page-accent-text">Classifier Report</h1>
                  <div className="text-gray-600">
                    {selectedProjectInfo && (
                      <span className="ml-2">
                        <Badge variant="secondary">{selectedProjectInfo.name}</Badge>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {!inSplitComparison && !isCompareMode && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size={actionButtonSize}
                  onClick={() => openReportType("lemma")}
                  className="border-amber-500 text-amber-600 hover:bg-amber-50"
                >
                  <span className="mr-2 inline-flex items-center justify-center text-base">
                    𓆣
                  </span>
                  Lemma Report
                </Button>
                <Button
                  variant="outline"
                  size={actionButtonSize}
                  onClick={() => openReportType("network")}
                  className="border-red-900 text-red-900 hover:bg-red-50"
                >
                  <span className="w-4 h-4 mr-2 inline-flex items-center justify-center text-base">
                    𓂀
                  </span>
                  Network Map
                </Button>
              </div>
            )}
          </div>
        </div>

        <div
          className={cn(
            isComparisonRoute ? "" : "sticky top-0 z-40"
          )}
        >
          <div className={cn(pageWidthClass, pagePaddingClass, "py-2")}>
            <div className="space-y-2">
              {selectedClassifier && (
                <Card id="classifier-overview" className="w-full">
                  <CardContent className="px-3 py-2">
                    <h2 className="text-2xl font-semibold leading-none tracking-tight text-gray-900">
                      Classifier:{" "}
                      <ClassifierLabel
                        classifier={selectedClassifier}
                        meanings={mergedClassifierMeanings}
                        displayLabel={formatClassifierId(selectedClassifier)}
                        projectType={projectType}
                        projectId={selectedProject}
                        showGlyph={projectType === "hieroglyphic"}
                        className="font-normal text-blue-900"
                        glyphClassName="text-[1.1em]"
                        glyphImageClassName="h-[1.1em] w-[1.1em]"
                        meaningClassName="text-base font-normal text-blue-900"
                      />
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {tokensForClassifier.length} token{tokensForClassifier.length !== 1 ? "s" : ""} found
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card className="w-full">
                <CardContent className="px-3 py-2">

              {isFilterMenuExpanded && (
                <div className="mb-2 space-y-3 border-b pb-3">
                  <TypeSelector
                    selectedTypes={clfTypes}
                    onTypesChange={setClfTypes}
                  />
                  <LevelSelector
                    selectedLevels={clfLevels}
                    onLevelsChange={setClfLevels}
                    maxLevel={5}
                  />
                  <WitnessSelector
                    witnessData={witnessData}
                    selectedWitnesses={selectedWitnesses}
                    setSelectedWitnesses={setSelectedWitnesses}
                    projectType={projectType}
                  />
                  <Button variant="outline" onClick={applyWitnessSelection}>
                    Apply witness selection
                  </Button>
                  <POSSelector
                    availablePOS={availablePOS}
                    selectedPOS={selectedPOS}
                    onSelectionChange={setSelectedPOS}
                  />
                  <Button variant="outline" onClick={applyPOSSelection}>
                    Apply part-of-speech selection
                  </Button>
                  <ScriptSelector
                    witnessData={witnessData}
                    selectedScripts={selectedScripts}
                    setSelectedScripts={setSelectedScripts}
                    projectType={projectType}
                  />
                  <Button variant="outline" onClick={applyScriptSelection}>
                    Apply script selection
                  </Button>
                </div>
              )}

              <div className="text-base font-semibold text-gray-900">
                Select a classifier
              </div>
              <div className="mt-2 flex flex-wrap items-start gap-3">
                <div className="min-w-[220px] flex-1 sm:flex-none">
                  {selectedClassifier ? (
                    <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
                      <ClassifierLabel
                        classifier={selectedClassifier}
                        meanings={mergedClassifierMeanings}
                        displayLabel={formatClassifierId(selectedClassifier)}
                        projectType={projectType}
                        projectId={selectedProject}
                        showGlyph={projectType === "hieroglyphic"}
                        className="text-base font-normal text-blue-900"
                        meaningClassName="text-xs font-normal text-blue-900"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center rounded-md border border-dashed border-gray-300 px-3 py-2 text-[11px] uppercase tracking-wide text-gray-400">
                      No classifier selected
                    </div>
                  )}
                </div>
                <div className="min-w-[220px] flex-1">
                  <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Search classifiers..."
                      value={classifierSearchQuery}
                      onChange={(e) => setClassifierSearchQuery(e.target.value)}
                      onFocus={() => setIsClassifierSearchFocused(true)}
                      onBlur={() => {
                        // Delay blur to allow click handlers to fire on buttons
                        setTimeout(() => setIsClassifierSearchFocused(false), 100);
                      }}
                      className="h-9 pl-9 text-sm"
                    />
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsFilterMenuExpanded(!isFilterMenuExpanded)}
                      className={cn(
                        "border-0 hover:opacity-90",
                        isFilterMenuExpanded ? "text-black" : "text-red-900 hover:text-black"
                      )}
                      style={{ backgroundColor: JSESH_NODE_COLOR }}
                    >
                      {isFilterMenuExpanded ? (
                        <span className="inline-flex items-center gap-1.5">
                          <X className="h-4 w-4" />
                          Hide filters
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <SearchIcon className="h-4 w-4" />
                          Show filters
                          <Plus className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {isSearchActive && (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={classifierSortBy === "count" ? "default" : "outline"}
                      size="sm"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setClassifierSortBy("count");
                      }}
                    >
                      Sort by Frequency
                    </Button>
                    <Button
                      variant={classifierSortBy === "id" ? "default" : "outline"}
                      size="sm"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setClassifierSortBy("id");
                      }}
                    >
                      Sort by Classifier List
                    </Button>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                    {filteredClassifiers.slice(0, 150).map((classifier) => {
                      const isSelected = selectedClassifier === classifier;
                      const classifierInfo = classifierSummary[classifier];
                      return (
                        <button
                          key={classifier}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleClassifierSelect(classifier);
                            setIsClassifierSearchFocused(false);
                            setClassifierSearchQuery("");
                          }}
                          className={`w-full border-b border-gray-100 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-gray-100 ${
                            isSelected ? "bg-red-50 border-red-200" : ""
                          }`}
                        >
                          <ClassifierLabel
                            classifier={classifier}
                            meanings={mergedClassifierMeanings}
                            displayLabel={formatClassifierId(classifier)}
                            projectType={projectType}
                            projectId={selectedProject}
                            showGlyph={projectType === "hieroglyphic"}
                            className="font-medium"
                          />
                          {classifierInfo?.type && (
                            <span className="ml-2 rounded bg-gray-100 px-1 text-xs text-gray-700">
                              {classifierInfo.type}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {filteredClassifiers.length === 0 && (
                      <div className="px-3 py-3 text-center text-gray-500">
                        No classifiers found matching your search.
                      </div>
                    )}
                  </div>
                </div>
              )}

                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {isCompareMode && !isComparisonRoute && (
          <div className={cn(pageWidthClass, pagePaddingClass)}>
            <Card className="mb-3">
              <CardHeader className="pb-3">
                <CardTitle>Select project to compare:</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={comparisonProjectId || ""} onValueChange={(value) => setComparisonProjectId(value || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a project to compare" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>
        )}

        <div
          className={cn("space-y-3 flex-1", pageWidthClass, pagePaddingClass)}
          id="classifier-report-content"
        >

        <Card id="classifier-filters" className="mt-3">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-3">
              <img src="/favicon-32x32.png" alt="iClassifier logo" className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-semibold leading-none tracking-tight">On this page</h2>
                <div className="text-sm text-gray-600">Jump to sections</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <a href="#classifier-overview" className="text-blue-600 hover:underline">Classifier overview</a>
              <a href="#lemma-cooccurrence" className="text-blue-600 hover:underline">
                The <span className={classifierTextClass}>{formatClassifierId(selectedClassifier)}</span> category in {selectedProjectInfo?.name}
              </a>
              <a href="#lemma-classification-network" className="text-blue-600 hover:underline">Multiple Classification Network</a>
              <a href="#classifier-tokens" className="text-blue-600 hover:underline">Tokens</a>
              <a href="#classifier-statistics" className="text-blue-600 hover:underline">Statistics</a>
              <a href="#classifier-filters" className="text-blue-600 hover:underline">Filters</a>
            </div>
          </CardContent>
        </Card>

        {selectedClassifier && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] gap-3 items-start">
              <Card
                id="lemma-cooccurrence"
                ref={lemmaNetworkCardRef}
                className={lemmaNetworkFullscreenActive ? "flex flex-col h-screen w-screen max-h-none max-w-none rounded-none" : ""}
              >
                <CardHeader>
                  <CardTitle>
                    The <span className={classifierTextClass}>{formatClassifierId(selectedClassifier)}</span> category in {selectedProjectInfo?.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className={lemmaNetworkFullscreenActive ? "space-y-3 flex flex-col min-h-0" : "space-y-3"}>
                  <div className="flex items-center justify-start gap-3">
                    <Button
                      variant="outline"
                      className="font-bold"
                      onClick={() => toggleLemmaNetworkFreeze()}
                    >
                      {isLemmaNetworkFrozen ? "Unfreeze network" : "Freeze network"}
                    </Button>
                    <NetworkLegend showLemmaToggle={true} showClassifierToggle={false} />
                  </div>
                  <div
                    ref={lemmaNetworkFrameRef}
                    className={cn(lemmaNetworkFullscreenActive ? "relative flex-1 min-h-0" : "network-frame-fixed")}
                    style={
                      lemmaNetworkFullscreenActive
                        ? undefined
                        : ({ "--network-frame-size": "900px" } as React.CSSProperties)
                    }
                  >
                    <div
                      ref={lemmaNetworkRef}
                      className={isLemmaNetworkFullscreen
                        ? "w-full border border-gray-200 rounded-lg bg-white h-full"
                        : "w-full h-full border border-gray-200 rounded-lg bg-white"}
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "block",
                        overflow: "hidden",
                        boxSizing: "border-box"
                      }}
                    />
                    <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white/90 shadow-sm"
                        onClick={() => setShowLemmaNodeModes((prev) => !prev)}
                      >
                        Change node modes
                      </Button>
                      {showLemmaNodeModes && (
                        <div className="max-w-[340px] rounded-lg border border-gray-200 bg-white/95 p-2 shadow-lg">
                          <DisplayModeControls
                            classifierDisplayMode={classifierDisplayMode}
                            onClassifierDisplayModeChange={setClassifierDisplayMode}
                            lemmaDisplayMode={lemmaDisplayMode}
                            onLemmaDisplayModeChange={setLemmaDisplayMode}
                            projectType={projectType}
                            useUnicode={useUnicode}
                            onUnicodeToggle={setUseUnicode}
                            compact
                          />
                        </div>
                      )}
                    </div>
                    {lemmaEdgeScale > 1 && (
                      <div className="absolute bottom-2 right-2 rounded border border-gray-200 bg-white/90 px-2 py-1 text-xs text-gray-600">
                        Edge scale: ÷{lemmaEdgeScale.toFixed(1)}
                      </div>
                    )}
                  </div>
                  {lemmaMapMode === "percentages" && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="text-xs text-gray-600">
                        Node hue shows lemma centrality percentile (approx.).
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-700">
                        {[
                          { label: "90-100%", color: getHueByPercentage(95) },
                          { label: "80-90%", color: getHueByPercentage(85) },
                          { label: "70-80%", color: getHueByPercentage(75) },
                          { label: "60-70%", color: getHueByPercentage(65) },
                          { label: "50-60%", color: getHueByPercentage(55) },
                          { label: "<=50%", color: getHueByPercentage(40) },
                        ].map((stop) => (
                          <span key={stop.label} className="inline-flex items-center gap-1">
                            <span
                              className="inline-block h-3 w-3 rounded-sm border border-gray-300"
                              style={{ backgroundColor: stop.color }}
                            />
                            <span>{stop.label}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setLemmaMapMode(lemmaMapMode === "counts" ? "percentages" : "counts")}
                    >
                      {lemmaMapMode === "counts"
                        ? "Switch to edge width by lemma centrality rank"
                        : "Switch to edge width by no. of examples"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => downloadNetworkPNG(lemmaNetworkInstance.current, 96, `classifier-lemma-network-96dpi.png`).catch(console.error)}
                    >
                      PNG 96
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => downloadNetworkPNG(lemmaNetworkInstance.current, 300, `classifier-lemma-network-300dpi.png`).catch(console.error)}
                    >
                      PNG 300
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => downloadNetworkSVGVector(lemmaNetworkInstance.current, "classifier-lemma-network.svg")}
                    >
                      SVG
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => downloadNetworkDataWorkbook(lemmaNetworkData.nodes, lemmaNetworkData.edges, "classifier-lemma-network-data.xls")}
                    >
                      Data
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => toggleBackground(lemmaNetworkRef.current)}
                    >
                      Switch background color
                    </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          lemmaNetworkFullscreenActive
                            ? exitFullscreen()
                            : goFullScreen(lemmaNetworkCardRef.current)
                      }
                    >
                      {lemmaNetworkFullscreenActive ? "Exit fullscreen" : "Go fullscreen"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card
                ref={hostLemmaCardRef}
                className={cn("flex flex-col min-h-0 overflow-hidden transition-none")}
                style={
                  !isHostLemmaListExpanded && hostLemmaCardHeight
                    ? { height: `${hostLemmaCardHeight}px`, maxHeight: `${hostLemmaCardHeight}px` }
                    : undefined
                }
              >
                <CardHeader className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>Host lemmas</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!hostLemmaListText) return;
                          navigator.clipboard?.writeText(hostLemmaListText);
                        }}
                        disabled={!hostLemmaListText}
                      >
                        Copy lemma list
                      </Button>
                      {(hostLemmaHasOverflow || isHostLemmaListExpanded) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsHostLemmaListExpanded((prev) => !prev);
                            const target = lemmaNetworkCardRef.current;
                            if (target) {
                              const height = Math.round(target.scrollHeight || 0);
                              if (height > 0) {
                                setHostLemmaCardHeight(height);
                              }
                            }
                          }}
                        >
                          {isHostLemmaListExpanded ? "Collapse lemma list" : "Extend lemma list"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 flex flex-col">
                  {sortedLemmaStats.length === 0 ? (
                    <div>No data</div>
                  ) : (
                    <div
                      ref={hostLemmaListRef}
                      className={cn(
                        "flex-1 min-h-0",
                        !isHostLemmaListExpanded && "overflow-auto"
                      )}
                    >
                      <Table className="w-fit font-serif text-sm leading-tight">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-7 px-2">Lemma</TableHead>
                            <TableHead className="text-right h-7 px-2">Number of examples</TableHead>
                            <TableHead className="text-right h-7 px-2">Percentage</TableHead>
                            <TableHead className="text-right h-7 px-2">Counts</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedLemmaStats.map(([lemma, count]) => {
                            const lemmaId = lemmaLabelToId.get(lemma);
                            const percentData = lemmaPercentDict?.[lemma];
                            const percentValue = percentData?.[0];
                            const percentCount = percentData?.[1];
                            return (
                              <TableRow key={lemma}>
                                <TableCell className="py-1 leading-tight px-2">
                                  {lemmaId ? (
                                    <button
                                      onClick={() => openLemma(lemmaId)}
                                      className="block w-full whitespace-normal break-words text-left text-blue-600 hover:underline"
                                    >
                                      <em className={projectType === "hieroglyphic" ? "italic" : "not-italic"}>{lemma}</em>
                                    </button>
                                  ) : (
                                    <span className="block w-full whitespace-normal break-words text-left">
                                      <em className={projectType === "hieroglyphic" ? "italic" : "not-italic"}>{lemma}</em>
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right px-2 py-1 leading-tight">{count}</TableCell>
                                <TableCell className="text-right px-2 py-1 leading-tight">
                                  {typeof percentValue === "number" ? `${percentValue}%` : "-"}
                                </TableCell>
                                <TableCell className="text-right px-2 py-1 leading-tight">
                                  {percentCount ?? "-"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] gap-3 items-start">
              <Card
                id="lemma-classification-network"
                ref={clfNetworkCardRef}
                className={clfNetworkFullscreenActive ? "flex flex-col h-screen w-screen max-h-none max-w-none rounded-none" : ""}
              >
                <CardHeader>
                  <CardTitle>Multiple Classification Network</CardTitle>
                </CardHeader>
                <CardContent className={clfNetworkFullscreenActive ? "space-y-3 flex flex-col min-h-0" : "space-y-3"}>
                  <div className="flex items-center justify-start gap-3">
                    <Button
                      variant="outline"
                      className="font-bold"
                      onClick={() => toggleClfNetworkFreeze()}
                    >
                      {isClfNetworkFrozen ? "Unfreeze network" : "Freeze network"}
                    </Button>
                    <NetworkLegend showLemmaToggle={false} showClassifierToggle={true} />
                  </div>
                  <div
                    ref={clfNetworkFrameRef}
                    className={cn(clfNetworkFullscreenActive ? "relative flex-1 min-h-0" : "network-frame-fixed")}
                    style={
                      clfNetworkFullscreenActive
                        ? undefined
                        : ({ "--network-frame-size": "900px" } as React.CSSProperties)
                    }
                  >
                    <div
                      ref={clfNetworkRef}
                      className={isClfNetworkFullscreen
                        ? "w-full border border-gray-200 rounded-lg bg-white h-full"
                        : "w-full h-full border border-gray-200 rounded-lg bg-white"}
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "block",
                        overflow: "hidden",
                        boxSizing: "border-box"
                      }}
                    />
                    <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white/90 shadow-sm"
                        onClick={() => setShowClassifierNodeModes((prev) => !prev)}
                      >
                        Change node modes
                      </Button>
                      {showClassifierNodeModes && (
                        <div className="max-w-[340px] rounded-lg border border-gray-200 bg-white/95 p-2 shadow-lg">
                          <DisplayModeControls
                            classifierDisplayMode={classifierDisplayMode}
                            onClassifierDisplayModeChange={setClassifierDisplayMode}
                            lemmaDisplayMode={lemmaDisplayMode}
                            onLemmaDisplayModeChange={setLemmaDisplayMode}
                            projectType={projectType}
                            useUnicode={useUnicode}
                            onUnicodeToggle={setUseUnicode}
                            showLemmaNodes={false}
                            compact
                          />
                        </div>
                      )}
                    </div>
                    {clfEdgeScale > 1 && (
                      <div className="absolute bottom-2 right-2 rounded border border-gray-200 bg-white/90 px-2 py-1 text-xs text-gray-600">
                        Edge scale: ÷{clfEdgeScale.toFixed(1)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => downloadNetworkPNG(clfNetworkInstance.current, 96, `classifier-cooccur-network-96dpi.png`).catch(console.error)}
                    >
                      PNG 96
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => downloadNetworkPNG(clfNetworkInstance.current, 300, `classifier-cooccur-network-300dpi.png`).catch(console.error)}
                    >
                      PNG 300
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => downloadNetworkSVGVector(clfNetworkInstance.current, "classifier-cooccur-network.svg")}
                    >
                      SVG
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => downloadNetworkDataWorkbook(clfNetworkData.nodes, clfNetworkData.edges, "classifier-cooccur-network-data.xls")}
                    >
                      Data
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => toggleBackground(clfNetworkRef.current)}
                    >
                      Switch background color
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        clfNetworkFullscreenActive
                          ? exitFullscreen()
                          : goFullScreen(clfNetworkCardRef.current)
                    }
                  >
                    {clfNetworkFullscreenActive ? "Exit fullscreen" : "Go fullscreen"}
                  </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:self-start">
                <CardHeader>
                  <CardTitle>Classifier combinations</CardTitle>
                </CardHeader>
                <CardContent>
                  {sortedComStats.length === 0 ? (
                    <div>No data</div>
                  ) : (
                    <Table className="w-fit">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-9 px-2">Classifier combination</TableHead>
                          <TableHead className="text-right h-9 px-2">Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedComStats.map(([com, count]) => (
                          <TableRow key={com}>
                            <TableCell className="px-2 py-2">
                              {com.split("+").map((clf, index) => (
                                <span key={`${com}-${clf}`}>
                                  <button
                                    onClick={() => openClassifier(clf)}
                                    className="text-blue-600 hover:underline"
                                  >
                                    <ClassifierLabel
                                      classifier={clf}
                                      meanings={mergedClassifierMeanings}
                                      displayLabel={formatClassifierId(clf)}
                                      projectType={projectType}
                                      projectId={selectedProject}
                                      showGlyph={projectType === "hieroglyphic"}
                                      className="text-blue-600"
                                      meaningClassName="text-blue-500/80"
                                    />
                                  </button>
                                  {index < com.split("+").length - 1 && <span className="text-gray-500"> + </span>}
                                </span>
                              ))}
                            </TableCell>
                            <TableCell className="text-right px-2 py-2">{count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
                <CardHeader className="pt-2">
                  <CardTitle>Co-occuring classifiers</CardTitle>
                </CardHeader>
                <CardContent>
                  {sortedClfStats.length === 0 ? (
                    <div>No data</div>
                  ) : (
                    <Table className="w-fit">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-9 px-2">Classifier</TableHead>
                          <TableHead className="text-right h-9 px-2">Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedClfStats.map(([clf, count]) => (
                          <TableRow key={clf}>
                            <TableCell className="px-2 py-2">
                              <button
                                onClick={() => openClassifier(clf)}
                                className="text-blue-600 hover:underline"
                              >
                                <ClassifierLabel
                                  classifier={clf}
                                  meanings={mergedClassifierMeanings}
                                  displayLabel={formatClassifierId(clf)}
                                  projectType={projectType}
                                  projectId={selectedProject}
                                  showGlyph={projectType === "hieroglyphic"}
                                  className="text-blue-600"
                                  meaningClassName="text-blue-500/80"
                                />
                              </button>
                            </TableCell>
                            <TableCell className="text-right px-2 py-2">{count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            <div id="classifier-statistics" className="grid grid-cols-1 lg:grid-cols-[max-content_minmax(0,1fr)] gap-3 items-start">
              <Card className="h-full flex flex-col lg:w-fit lg:max-w-none">
                <CardHeader>
                  <CardTitle>POS, order, and script statistics</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                <div ref={statsContentRef} className="grid grid-cols-1 gap-3 max-h-96 overflow-auto">
                    <div>
                      <div className="text-sm font-semibold text-gray-700 mb-2">
                        POS co-occurrence statistics
                      </div>
                      {sortedPosStats.length === 0 ? (
                        <div>No data</div>
                      ) : (
                        <Table className="w-fit">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="h-9 px-2">Part of speech</TableHead>
                              <TableHead className="text-right h-9 px-2">Count</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedPosStats.map(([pos, count]) => (
                              <TableRow key={pos}>
                                <TableCell className="px-2 py-2">{pos}</TableCell>
                                <TableCell className="text-right px-2 py-2">{count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-gray-700 mb-2">Order statistics</div>
                      {sortedOrdStats.length === 0 ? (
                        <div>No data</div>
                      ) : (
                        <Table className="w-fit">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="h-9 px-2">Classifier position</TableHead>
                              <TableHead className="text-right h-9 px-2">Count</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedOrdStats.map(([position, count]) => (
                              <TableRow key={position}>
                                <TableCell className="px-2 py-2">{position}</TableCell>
                                <TableCell className="text-right px-2 py-2">{count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-gray-700 mb-2">Script statistics</div>
                      {sortedScrStats.length === 0 ? (
                        <div>No data</div>
                      ) : (
                        <Table className="w-fit">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="h-9 px-2">Script</TableHead>
                              <TableHead className="text-right h-9 px-2">Count</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedScrStats.map(([script, count]) => (
                              <TableRow key={script}>
                                <TableCell className="px-2 py-2">{script}</TableCell>
                                <TableCell className="text-right px-2 py-2">{count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                id="classifier-tokens"
                className={cn("flex flex-col min-h-0 overflow-hidden transition-none lg:min-w-0")}
              >
                <CardHeader className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>Tokens for this classifier</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!tokenListText) return;
                          navigator.clipboard?.writeText(tokenListText);
                        }}
                        disabled={!tokenListText}
                      >
                        Copy token list
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsTokenListExpanded((prev) => !prev)}
                      >
                        {isTokenListExpanded ? "Collapse token list" : "Extend token list"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 flex flex-col">
                  {tokensForClassifier.length === 0 ? (
                    <div>No data</div>
                  ) : (
                    <div
                      className={cn(
                        "flex-1 min-h-0 overflow-auto",
                        !isTokenListExpanded && "max-h-96"
                      )}
                      style={
                        !isTokenListExpanded && statsContentHeight
                          ? { height: `${statsContentHeight}px`, maxHeight: `${statsContentHeight}px` }
                          : undefined
                      }
                    >
                      <ul className="space-y-2">
                        {tokensForClassifier.map((token: any, index: number) => {
                          // Build classifier metadata map for coloring
                          const clfMetadataMap: Record<string, any> = {};
                          classifierData.forEach((meta: any) => {
                            const key = selectedProjectInfo?.type === "anatolian"
                              ? (meta.classifier || meta.gardiner_number || meta.clf || meta.mdc)
                              : (meta.gardiner_number || meta.clf || meta.classifier || meta.mdc);
                            if (key && !clfMetadataMap[key]) {
                              clfMetadataMap[key] = meta;
                            }
                          });

                          const coloredMarkup = colourClassifiers(token.mdc_w_markup, clfMetadataMap, projectType);
                          const witness = witnessData[token.witness_id];
                          const lemma = token.lemma_id ? lemmaData[token.lemma_id] : null;
                          const scriptLabel = witness?.script
                            ? getThesaurusLabel(projectType, "scripts", witness.script)
                            : "";

                          const unicodeMdc = projectType === "hieroglyphic"
                            ? mdcToUnicode(token.mdc || token.mdc_w_markup || "")
                            : "";
                          const tokenMdc = token.mdc || token.mdc_w_markup || "";
                          const tokenContext = String(token.syntactic_relation || "").trim();
                          const tlaSentenceId = getTlaSentenceId(token);
                          const tokenId = getTokenCommentId(token);
                          const tlaContextHref = tokenId
                            ? `https://thesaurus-linguae-aegyptiae.de/sentence/token/${tokenId}`
                            : tlaSentenceId
                              ? `https://thesaurus-linguae-aegyptiae.de/sentence/${tlaSentenceId}`
                              : null;

                          return (
                            <li key={`${token.id}-${index}`} className="border-l-2 border-red-200 pl-3">
                              {projectType === "hieroglyphic" ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <TokenGlyph mdc={tokenMdc} />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-auto p-1 text-gray-600 hover:text-gray-900"
                                      onClick={() => {
                                        navigator.clipboard.writeText(token.mdc);
                                      }}
                                      title="Copy token code"
                                    >
                                      <Copy className="w-4 h-4" />
                                    </Button>
                                    {tlaContextHref && (
                                      <a
                                        href={tlaContextHref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline"
                                      >
                                        See example in context (TLA)
                                      </a>
                                    )}
                                  </div>
                                  {/* Unicode display - commented out but not removed */}
                                  {/* {unicodeMdc && (
                                    <div className="egyptian-unicode text-lg text-gray-800 font-medium">
                                      {unicodeMdc}
                                    </div>
                                  )} */}
                                  <div
                                    className="font-mono text-sm"
                                    dangerouslySetInnerHTML={{ __html: coloredMarkup || token.mdc }}
                                  />
                                </div>
                              ) : (
                                <div
                                  className="font-mono text-sm"
                                  dangerouslySetInnerHTML={{ __html: coloredMarkup || token.mdc }}
                                />
                              )}
                              {tokenContext && (
                                <div className="mt-1 text-[11px] italic text-gray-500">
                                  {tokenContext}
                                </div>
                              )}
                              <div className="text-xs text-gray-500 mt-1">
                                {lemma && (
                                  <span>
                                    Lemma:{" "}
                                    <button
                                      onClick={() => openLemma(token.lemma_id)}
                                      className="text-blue-600 hover:underline"
                                    >
                                      <em className="italic">{formatLemmaLabel(lemma)}</em>
                                    </button>{" "}
                                    •{" "}
                                  </span>
                                )}
                                {witness && (
                                  <span>
                                    Text: {witness.name || witness.id}
                                    {scriptLabel ? ` (${scriptLabel})` : ""}
                                  </span>
                                )}
                                {token.coordinates_in_witness && <span> • {token.coordinates_in_witness}</span>}
                                {token.pos && <span> • POS: {token.pos}</span>}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <Citation
              type="classifier"
              projectName={selectedProjectInfo?.name || "Unknown"}
              authors={selectedProjectInfo?.authors || "Unknown"}
              projectId={selectedProject}
              classifierId={selectedClassifier}
            />

            {/* Comparison Info Panel */}
            {isCompareMode && comparisonProjectId && comparisonProjectInfo && (
              <Card className="mt-4 border-l-4 border-l-yellow-400">
                <CardHeader>
                  <CardTitle>Comparison: {comparisonProjectInfo.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {comparisonLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <NetworkLoader title="Loading comparison project data..." />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {comparisonProjectInfo.image && (
                        <img
                          src={comparisonProjectInfo.image}
                          alt={comparisonProjectInfo.name}
                          className="w-16 h-16 rounded object-cover"
                        />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-600">Project Type:</div>
                        <div className="text-sm">{comparisonProjectInfo.type}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600">Description:</div>
                        <div className="text-sm">{comparisonProjectInfo.description}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600">Classifiers Found:</div>
                        <div className="text-sm">{comparisonClassifierData.length}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600">Lemmas Found:</div>
                        <div className="text-sm">{Object.keys(comparisonLemmaData).length}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600">Witnesses Found:</div>
                        <div className="text-sm">{Object.keys(comparisonWitnessData).length}</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-300 flex justify-center gap-3">
          <ReportActions
            reportId="classifier-report-content"
            reportType="classifier"
            projectId={selectedProject || ""}
            classifierId={selectedClassifier || undefined}
          />
        </div>
        </div>
      </div>
    </SidebarLayout>
  );
}

function formatLemmaLabel(lemma: { transliteration?: string; meaning?: string }) {
  const base = lemma?.transliteration || "?";
  const translation = extractLemmaMeaning(lemma.meaning);
  if (!translation) return base;
  return `${base} '${translation}'`;
}

function extractLemmaMeaning(meaning: string | null | undefined) {
  if (!meaning) return "";

  // Use the one-word translation extraction from networkUtils
  const translation = extractLemmaTranslation(meaning);
  return translation || "";
}

function splitLemmaLabel(label: string) {
  const match = label.match(/^(.*?)\s+'(.+)'$/);
  if (match) {
    return { base: match[1], meaning: match[2] };
  }
  return { base: label, meaning: "" };
}

function getHueByPercentage(percentage: number) {
  const base = { r: 239, g: 68, b: 68 };
  let alpha = 0.12;
  if (percentage > 90) {
    alpha = 0.4;
  } else if (percentage > 80) {
    alpha = 0.32;
  } else if (percentage > 70) {
    alpha = 0.26;
  } else if (percentage > 60) {
    alpha = 0.2;
  } else if (percentage > 50) {
    alpha = 0.16;
  }
  const mix = (channel: number) => Math.round(alpha * channel + (1 - alpha) * 255);
  return `rgb(${mix(base.r)}, ${mix(base.g)}, ${mix(base.b)})`;
}

function extractClassifiers(mdcWithMarkup: string | null): string[] {
  if (!mdcWithMarkup) return [];

  const classifiers: string[] = [];
  let inClassifier = false;
  let current = "";

  for (let i = 0; i < mdcWithMarkup.length; i++) {
    const char = mdcWithMarkup[i];

    if (char === "~") {
      if (inClassifier) {
        if (current) classifiers.push(current);
        current = "";
        inClassifier = false;
      } else {
        inClassifier = true;
      }
    } else if (inClassifier) {
      current += char;
    }
  }

  return classifiers;
}

function findClassifierMetadata(
  clf: string,
  tokenId: number,
  clfData: any[] = []
): { clf_type: string; clf_level: string; clf_position?: string } {
  // clfData is an array from the API
  if (!Array.isArray(clfData) || clfData.length === 0) {
    return { clf_type: "", clf_level: "", clf_position: "any" };
  }

  for (const item of clfData) {
    if (item.gardiner_number === clf && item.token_id === tokenId) {
      return item;
    }
  }
  return { clf_type: "", clf_level: "", clf_position: "any" };
}

function getClassifierPosition(clf: string, mdcWithMarkup: string): string {
  const clfs = extractClassifiers(mdcWithMarkup);
  const position = clfs.indexOf(clf);
  if (position === 0) return "pre";
  if (position === clfs.length - 1) return "post";
  return "inner";
}

function getClassifierPositionIndex(clf: string, mdcWithMarkup: string): number {
  const clfs = extractClassifiers(mdcWithMarkup);
  return clfs.indexOf(clf);
}

function downloadCSV(data: Array<Record<string, any>>, filename: string) {
  if (data.length === 0) {
    alert("No data to export");
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (typeof value === "string" && value.includes(",")) {
            return `"${value}"`;
          }
          return value || "";
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
