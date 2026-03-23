import { useState, useMemo, useEffect, memo, useCallback, useRef } from "react";
import WitnessSelector from "@/components/filters/WitnessSelector";
import ScriptSelector from "@/components/filters/ScriptSelector";
import { useSearchParams, useNavigate, useParams, useLocation } from "react-router-dom";
import { Search as SearchIcon, BarChart3, Network as NetworkIcon, Play, Pause, Copy, Check } from "lucide-react";
import SidebarLayout from "@/components/SidebarLayout";
import { useLemmaSummaries, useWitnesses, useClassifierMeanings, useClassifierMetadata, useTokensByLemma, useTokensByIds } from "@/lib/api";
import {
  DEFAULT_NETWORK_CLF_LEVELS,
  DEFAULT_NETWORK_CLF_TYPES,
  classifierTypeMatchesSelection,
  normalizeClassifierLevelNumber,
  projects,
} from "@/lib/sampleData";
import { useCurrentProjectId } from "@/lib/projectContext";
import { useCompareNavigation } from "@/hooks/useCompareNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import LevelSelector from "@/components/filters/LevelSelector";
import TypeSelector from "@/components/filters/TypeSelector";
import { cn } from "@/lib/utils";
import {
  extractClassifiersFromString,
  colourClassifiers,
  createLemmaNetwork,
  getLegacyMapOptions,
  scaleEdgeWidths,
  formatLemmaOriginLabelItalic,
  formatLemmaTranslationLabel,
  formatLemmaOriginTranslationLabel,
  getLemmaNodeFontFace,
  fetchExtendedSignDataUrl,
  JSESH_NODE_COLOR,
  BROKEN_IMAGE_PLACEHOLDER,
  CLF_NODE_WIDTH,
  CLF_NODE_HEIGHT,
  CLF_NODE_RADIUS,
  wrapClassifierImage
} from "@/lib/networkUtils";
import NotFound from "@/pages/NotFound";
import { fetchJseshBase64, getJseshImageUrl, getJseshRenderHeight } from "@/lib/jsesh";
import { fetchDictionaryEntry, DictionaryEntry } from "@/lib/dictionary";
import { getThesaurusLabel } from "@/lib/thesauri";
import { formatClassifierMeaningLabel } from "@/lib/classifierMeaningFormat";
import { downloadNetworkDataWorkbook, downloadNetworkJPEG, downloadNetworkPNG, downloadNetworkSVGVector } from "@/lib/networkExport";
import Citation from "@/components/Citation";
import ReportActions from "@/components/ReportActions";
import NetworkLoader from "@/components/NetworkLoader";
import ClassifierLabel from "@/components/ClassifierLabel";
import DisplayModeControls from "@/components/DisplayModeControls";
import NetworkLegend from "@/components/NetworkLegend";
import { mdc2uni } from "@/lib/mdc2uni";
import { mergeClassifierMeaningsWithFallback } from "@/lib/classifierMeaningFallback";
import { API_BASE_URL } from "@/lib/apiBase";

// Dynamically import vis-network for client-side rendering
let VisNetwork: any = null;
let VisDataSet: any = null;

const API_BASE = API_BASE_URL;
const classifierImageCache = new Map<string, string>();
const LEMMA_NETWORK_EDGE_COLOR = "#0B1D3A";
const DEFAULT_NETWORK_FRAME_SIZE = 900;
const normalizeMdcKey = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const getInteractionByFrozenState = (frozen: boolean) => ({
  dragNodes: !frozen,
  dragView: !frozen,
  zoomView: !frozen,
});

function formatLemmaMeaningForPage(
  meaning: string | null | undefined,
  projectType?: string
) {
  const raw = String(meaning || "").trim();
  if (!raw) return "";
  if (projectType !== "hieroglyphic") return raw;

  const markerPattern = /\b([a-z]{2})\s*:/gi;
  const matches = Array.from(raw.matchAll(markerPattern));
  if (matches.length === 0) return raw;

  const segments: Record<string, string> = {};
  const order: string[] = [];

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    if (match.index == null) continue;
    const code = String(match[1] || "").toLowerCase();
    const start = match.index + match[0].length;
    const end = i + 1 < matches.length && matches[i + 1].index != null
      ? (matches[i + 1].index as number)
      : raw.length;
    const value = raw
      .slice(start, end)
      .trim()
      .replace(/^[\s;,().-]+/, "")
      .replace(/[\s;,().-]+$/, "")
      .trim();
    if (!value) continue;
    if (!order.includes(code)) {
      order.push(code);
    }
    segments[code] = value;
  }

  if (!segments.en || !segments.de) return raw;

  const prefix = raw
    .slice(0, matches[0].index || 0)
    .trim()
    .replace(/[\s;,().-]+$/, "");

  const reordered = [
    `eng: ${segments.en}`,
    `de: ${segments.de}`,
    ...order
      .filter((code) => code !== "en" && code !== "de" && segments[code])
      .map((code) => `${code}: ${segments[code]}`)
  ].join("; ");

  return prefix ? `${prefix} ${reordered}` : reordered;
}

// Memoized lemma option component to prevent re-renders
const LemmaOption = memo(({ id, count, lemma, projectType }: any) => (
  <option value={id}>
    {count}: {lemma?.transliteration || "?"} ({formatLemmaMeaningForPage(lemma?.meaning, projectType) || "?"})
  </option>
));

LemmaOption.displayName = "LemmaOption";

const UNILITERAL_TO_GARDINER: Record<string, string> = {
  i: "M17",
  j: "M17",
  y: "M17",
  a: "G1",
  b: "D58",
  p: "Q3",
  f: "I9",
  m: "G17",
  n: "N35",
  r: "D21",
  h: "V28",
  H: "V28",
  x: "F32",
  X: "F32",
  s: "S29",
  S: "S29",
  q: "N29",
  k: "V31",
  g: "W11",
  t: "X1",
  T: "X1",
  d: "D46",
  D: "D46",
};

function matchesClassifierType(typeValue: string | null | undefined, selectedTypes: Set<string>) {
  return classifierTypeMatchesSelection(typeValue, selectedTypes);
}

function matchesClassifierLevel(levelValue: unknown, selectedLevels: Set<number>) {
  if (selectedLevels.size === 0) return true;
  const normalized = normalizeClassifierLevelNumber(levelValue);
  if (!Number.isFinite(normalized) || normalized < 0) return false;
  return selectedLevels.has(normalized);
}

function normalizeMdcChunk(chunk: string) {
  return chunk
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, "")
    .trim();
}

function mdcToUnicode(mdc: string) {
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
}

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

function getTlaSentenceId(token: any) {
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

type TokenDisplayType = "all" | "standalone" | "compound" | "compound-part";

interface ClassifierStats {
  [key: string]: number;
}

interface TokenForLemma {
  id: number;
  mdc_w_markup: string;
  mdc: string;
  witness_id: string;
  compound_id?: number;
  coordinates_in_witness?: string;
  pos?: string;
  syntactic_relation?: string | null;
}

export default function LemmaReport() {
  const navigate = useNavigate();
  const location = useLocation();
  const isComparisonRoute = location.pathname.startsWith("/compare/");
  const stabilizationIterations = isComparisonRoute ? 50 : 80;
  const { projectId: urlProjectId, lemmaId: urlLemmaId } = useParams();
  const [searchParams] = useSearchParams();
  const currentProjectId = useCurrentProjectId();
  const { setCompareTarget, getCompareParam } = useCompareNavigation();
  
  // Get project ID from URL params
  const selectedProjectId = urlProjectId || currentProjectId;
  const compareLemmaId = getCompareParam("lemmaId");
  const lemmaIdFromUrl = urlLemmaId
    ? parseInt(urlLemmaId)
    : (compareLemmaId
      ? parseInt(compareLemmaId)
      : (searchParams.get("lemmaId") ? parseInt(searchParams.get("lemmaId")!) : null));

  // Project selection state
  const [selectedProject, setSelectedProject] = useState(selectedProjectId);

  // Sync selectedProject with URL changes
  useEffect(() => {
    if (selectedProjectId && selectedProjectId !== selectedProject) {
      setSelectedProject(selectedProjectId);
    }
  }, [selectedProjectId, selectedProject]);

  // Get project info
  const selectedProjectInfo = projects.find(p => p.id === selectedProject);
  const projectType = selectedProjectInfo?.type || "hieroglyphic";
  const defaultUnicode = (selectedProjectInfo?.type ?? "hieroglyphic") !== "hieroglyphic";
  
  // State management - reset when project changes
  const [selectedLemmaId, setSelectedLemmaId] = useState<number | null>(lemmaIdFromUrl);
  const [lemmaSearchQuery, setLemmaSearchQuery] = useState("");
  const [lemmaSortBy, setLemmaSortBy] = useState<"count" | "id">("count");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isFilterMenuExpanded, setIsFilterMenuExpanded] = useState(false);
  const [dictionaryEntry, setDictionaryEntry] = useState<DictionaryEntry | null>(null);
  const [dictionaryLoading, setDictionaryLoading] = useState(false);
  const hasDictionaryEntry = useMemo(() => {
    if (!dictionaryEntry) return false;
    return Boolean(
      dictionaryEntry.tla_id ||
      dictionaryEntry.transliteration ||
      dictionaryEntry.meaning
    );
  }, [dictionaryEntry]);
  const hasTlaLemmaLink = projectType === "hieroglyphic" && Boolean(selectedLemmaId);
  const hasDictionaryLink = useMemo(() => {
    return Boolean(
      hasTlaLemmaLink ||
      hasDictionaryEntry
    );
  }, [hasTlaLemmaLink, hasDictionaryEntry]);

  // Token display settings
  const [tokenDisplayType, setTokenDisplayType] = useState<TokenDisplayType>("all");
  const [isLemmaTokenListExpanded, setIsLemmaTokenListExpanded] = useState(false);

  // Filter states
  const [selectedWitnesses, setSelectedWitnesses] = useState<Set<string>>(new Set());
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set());
  
  // Classifier filtering
  const [clfTypes, setClfTypes] = useState<Set<string>>(new Set(DEFAULT_NETWORK_CLF_TYPES));
  const [clfLevels, setClfLevels] = useState<Set<number>>(new Set(DEFAULT_NETWORK_CLF_LEVELS));

  // Reset filters when project changes
  useEffect(() => {
    setSelectedWitnesses(new Set());
    setSelectedScripts(new Set());
    setClfTypes(new Set(DEFAULT_NETWORK_CLF_TYPES));
    setClfLevels(new Set(DEFAULT_NETWORK_CLF_LEVELS));
    setLemmaSearchQuery("");
    setSelectedLemmaId(null);
    setDictionaryEntry(null);
    setUseUnicode(defaultUnicode);
    defaultLemmaSetRef.current = false;
  }, [selectedProject, defaultUnicode]);

  useEffect(() => {
    // Always update state when URL lemmaId changes
    if (lemmaIdFromUrl) {
      setSelectedLemmaId(lemmaIdFromUrl);
    } else {
      // Reset if no lemma in URL
      setSelectedLemmaId(null);
    }
  }, [lemmaIdFromUrl]);

  useEffect(() => {
    const fetchDictionary = async () => {
      if (!selectedLemmaId || projectType !== "hieroglyphic") {
        setDictionaryEntry(null);
        return;
      }
      setDictionaryLoading(true);
      const entry = await fetchDictionaryEntry("tla", selectedLemmaId);
      setDictionaryEntry(entry);
      setDictionaryLoading(false);
    };
    fetchDictionary();
  }, [selectedLemmaId, projectType]);
  
  // Search and pagination
  const [lemmaPage, setLemmaPage] = useState(1);
  const LEMMAS_PER_PAGE = 50;

  // Statistics
  const [clfDict, setClfDict] = useState<ClassifierStats>({});
  const [comDict, setComDict] = useState<ClassifierStats>({});
  const [scrDict, setScrDict] = useState<ClassifierStats>({});
  const [scrClassifiedDict, setScrClassifiedDict] = useState<ClassifierStats>({});
  const [classifiedTokenCount, setClassifiedTokenCount] = useState(0);
  const [outerCompoundClfDict, setOuterCompoundClfDict] = useState<ClassifierStats>({});
  const [extraLemmaMap, setExtraLemmaMap] = useState<Record<number, { id: number; transliteration: string; meaning: string; token_count?: number }>>({});
  const [isLemmaNetworkLoading, setIsLemmaNetworkLoading] = useState(false);
  const [isLemmaNetworkFrozen, setIsLemmaNetworkFrozen] = useState(false);
  const [lemmaEdgeScale, setLemmaEdgeScale] = useState(1);
  const [showNodeModeControls, setShowNodeModeControls] = useState(false);

  // Network graph
  const networkRef = useRef<HTMLDivElement>(null);
  const networkFrameRef = useRef<HTMLDivElement>(null);
  const networkCardRef = useRef<HTMLDivElement>(null);
  const networkInstanceRef = useRef<any>(null);
  const [visReady, setVisReady] = useState(false);
  const [useUnicode, setUseUnicode] = useState(defaultUnicode);
  const [classifierDisplayMode, setClassifierDisplayMode] = useState<"visual" | "meaning">("visual");
  const [lemmaDisplayMode, setLemmaDisplayMode] = useState<"origin" | "translation" | "both">("both");
  const defaultLemmaSetRef = useRef(false);
  const networkTokenRef = useRef(0);
  const networkResizeObserverRef = useRef<ResizeObserver | null>(null);
  const [lemmaNetworkData, setLemmaNetworkData] = useState<{ nodes: any[]; edges: any[] }>({
    nodes: [],
    edges: []
  });
  const [isLemmaNetworkFullscreen, setIsLemmaNetworkFullscreen] = useState(false);
  const isLemmaNetworkFullscreenActive =
    typeof document !== "undefined" && document.fullscreenElement === networkCardRef.current
      ? isLemmaNetworkFullscreen
      : false;

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

  // Update URL when project or lemma changes
  // URL is now the source of truth - no need to sync state back to URL

  const { data: lemmaSummary, loading: lemmaSummaryLoading, error: lemmaSummaryError } = useLemmaSummaries(selectedProject);
  const { data: witnessData, loading: witnessLoading, error: witnessError } = useWitnesses(selectedProject);
  const { data: classifierMeanings, loading: meaningsLoading, error: meaningsError } = useClassifierMeanings(selectedProject);
  const { data: classifierData } = useClassifierMetadata(selectedProject);

  const classifierMetadataByToken = useMemo(() => {
    const map: Record<number, Record<string, any[]>> = {};
    classifierData.forEach((meta: any) => {
      const tokenId = Number(meta?.token_id);
      if (!Number.isFinite(tokenId)) return;
      const key = selectedProjectInfo?.type === "anatolian"
        ? (meta.classifier || meta.gardiner_number || meta.clf || meta.mdc)
        : (meta.gardiner_number || meta.clf || meta.classifier || meta.mdc);
      const normalizedKey = typeof key === "string" ? key.trim() : "";
      if (!normalizedKey) return;
      if (!map[tokenId]) {
        map[tokenId] = {};
      }
      if (!map[tokenId][normalizedKey]) {
        map[tokenId][normalizedKey] = [];
      }
      map[tokenId][normalizedKey].push(meta);
    });
    return map;
  }, [classifierData, selectedProjectInfo?.type]);

  const classifierMatchesFilters = useCallback(
    (clf: string, tokenId: number) => {
      if (clfTypes.size === 0 && clfLevels.size === 0) return true;
      const metaEntries = classifierMetadataByToken[tokenId]?.[clf];
      if (!metaEntries || metaEntries.length === 0) return false;
      return metaEntries.some(
        (meta) =>
          matchesClassifierType(meta?.clf_type, clfTypes) &&
          matchesClassifierLevel(meta?.clf_level, clfLevels)
      );
    },
    [classifierMetadataByToken, clfLevels, clfTypes]
  );

  const lemmaData = useMemo(() => {
    const map: Record<number, any> = {};
    lemmaSummary.items.forEach((lemma) => {
      map[lemma.id] = {
        id: lemma.id,
        transliteration: lemma.transliteration || "",
        meaning: lemma.meaning || "",
      };
    });
    Object.values(extraLemmaMap).forEach((lemma) => {
      map[lemma.id] = {
        id: lemma.id,
        transliteration: lemma.transliteration || "",
        meaning: lemma.meaning || "",
      };
    });
    return map;
  }, [lemmaSummary, extraLemmaMap]);

  const mergedClassifierMeanings = useMemo(() => {
    return mergeClassifierMeaningsWithFallback({
      projectId: selectedProject,
      projectType: selectedProjectInfo?.type,
      classifierMeanings,
      lemmas: lemmaData
    });
  }, [selectedProject, selectedProjectInfo?.type, classifierMeanings, lemmaData]);
  const mergedClassifierMeaningsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    mergedClassifierMeaningsRef.current = mergedClassifierMeanings;
  }, [mergedClassifierMeanings]);

  const lemmaCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    lemmaSummary.items.forEach((lemma) => {
      counts[lemma.id] = Number((lemma as any).token_count || 0);
    });
    Object.values(extraLemmaMap).forEach((lemma) => {
      if (counts[lemma.id] == null) {
        counts[lemma.id] = Number(lemma.token_count || 0);
      }
    });
    return counts;
  }, [lemmaSummary, extraLemmaMap]);

  const loading = lemmaSummaryLoading || witnessLoading || meaningsLoading;
  const error = lemmaSummaryError || witnessError || meaningsError;

  const hasLemmaInSummary = useMemo(() => {
    if (!selectedLemmaId) return false;
    return lemmaSummary.items.some((lemma) => lemma.id === selectedLemmaId);
  }, [lemmaSummary.items, selectedLemmaId]);

  useEffect(() => {
    if (!selectedProject || !selectedLemmaId) return;
    if (hasLemmaInSummary || extraLemmaMap[selectedLemmaId]) return;
    let cancelled = false;
    const fetchLemmaById = async () => {
      try {
        const params = new URLSearchParams({
          search: String(selectedLemmaId),
          limit: "1",
          offset: "0",
          withCounts: "true",
        });
        const response = await fetch(
          `${API_BASE}/iclassifier/${selectedProject}/lemmas/paged?${params.toString()}`
        );
        if (!response.ok) return;
        const payload = await response.json();
        const lemma = Array.isArray(payload.items) ? payload.items[0] : null;
        if (!lemma || cancelled) return;
        setExtraLemmaMap((prev) => ({
          ...prev,
          [lemma.id]: lemma,
        }));
      } catch {
        // Ignore lookup errors; list still renders without extra lemma data.
      }
    };
    fetchLemmaById();
    return () => {
      cancelled = true;
    };
  }, [selectedProject, selectedLemmaId, hasLemmaInSummary, extraLemmaMap]);

  const selectedWitnessIds = useMemo(() => Array.from(selectedWitnesses), [selectedWitnesses]);
  const selectedScriptIds = useMemo(() => Array.from(selectedScripts), [selectedScripts]);

  const { data: lemmaTokensResponse, loading: lemmaTokensLoading } = useTokensByLemma(
    selectedProject,
    selectedLemmaId,
    {
      witnessIds: selectedWitnessIds,
      scripts: selectedScriptIds,
      tokenType: tokenDisplayType,
      limit: 10000,
      offset: 0,
    }
  );

  if (!selectedProjectInfo && !loading) {
    return <NotFound />;
  }

  // Get all lemmas sorted by frequency
  const lemmasWithCounts = useMemo(() => {
    return Object.entries(lemmaCounts)
      .map(([id, count]) => [parseInt(id, 10), count] as const)
      .sort((a, b) => b[1] - a[1]);
  }, [lemmaCounts]);

  useEffect(() => {
    if (selectedLemmaId || defaultLemmaSetRef.current) return;
    if (lemmasWithCounts.length > 0) {
      setSelectedLemmaId(lemmasWithCounts[0][0]);
      defaultLemmaSetRef.current = true;
    }
  }, [lemmasWithCounts, selectedLemmaId]);

  // Filter lemmas based on search
  const filteredLemmas = useMemo(() => {
    let filtered = lemmasWithCounts.filter(([id]) => {
      const lemma = lemmaData[id];
      if (!lemma) return false;
      const query = lemmaSearchQuery.toLowerCase();

      // Search across all lemma fields
      return Object.values(lemma).some(value => {
        if (value == null) return false;
        return String(value).toLowerCase().includes(query);
      });
    });

    // Apply sorting preference
    if (lemmaSortBy === "id") {
      return filtered.sort((a, b) => a[0] - b[0]);
    }
    // Already sorted by count by default
    return filtered;
  }, [lemmaSearchQuery, lemmasWithCounts, lemmaData, lemmaSortBy]);

  // Helper function to check if a lemma has classifiers
  const lemmaHasClassifiers = useCallback((lemmaId: number): boolean => {
    return (lemmaCounts[lemmaId] || 0) > 0;
  }, [lemmaCounts]);

  // Reset pagination when search changes
  useEffect(() => {
    setLemmaPage(1);
  }, [lemmaSearchQuery]);

  // Helper function to extract classifiers from token markup
  const extractClfsFromString = useCallback((s: string | null): string[] => {
    return extractClassifiersFromString(s);
  }, []);

  // Helper function to color classifiers in markup
  const colorClassifiers = useCallback((mdc_w_markup: string | null): string => {
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

    return colourClassifiers(mdc_w_markup, clfMetadataMap, projectType);
  }, [classifierData, projectType, selectedProjectInfo?.type]);

  // Get tokens for selected lemma with filtering
  const tokensForLemma: any[] = useMemo(() => {
    if (!selectedLemmaId) return [];
    return [...lemmaTokensResponse.items].sort((a: any, b: any) => a.id - b.id);
  }, [selectedLemmaId, lemmaTokensResponse.items]);

  const noClassifierCount = useMemo<number>(() => {
    if (!tokensForLemma.length) return 0;
    return tokensForLemma.reduce((count: number, token: any) => {
      const clfs = extractClfsFromString(token.mdc_w_markup);
      return clfs.length === 0 ? count + 1 : count;
    }, 0);
  }, [tokensForLemma, extractClfsFromString]);

  const lemmaTokenListText = useMemo(() => {
    if (!tokensForLemma.length) return "";
    const header = ["Token", "Syntactic relation", "Text", "Coordinates", "POS", "Classifiers"].join("\t");
    const rows = tokensForLemma.map((token: any) => {
      const tokenMdc = token.mdc || token.mdc_w_markup || "";
      const tokenContext = String(token.syntactic_relation || "").trim();
      const witness = witnessData[token.witness_id];
      const witnessLabel = witness ? (witness.name || witness.id) : "";
      const coords = token.coordinates_in_witness || "";
      const pos = token.pos || "";
      const classifiers = extractClfsFromString(token.mdc_w_markup || "").join(", ");
      return [tokenMdc, tokenContext, witnessLabel, coords, pos, classifiers].join("\t");
    });
    return [header, ...rows].join("\n");
  }, [tokensForLemma, witnessData, extractClfsFromString]);

  const compoundTokenIds = useMemo(() => {
    if (tokenDisplayType !== "compound-part") return [];
    const ids = new Set<number>();
    tokensForLemma.forEach((token: any) => {
      if (typeof token.compound_id === "number") {
        ids.add(token.compound_id);
      }
    });
    return Array.from(ids);
  }, [tokensForLemma, tokenDisplayType]);

  const { data: compoundTokens } = useTokensByIds(selectedProject, compoundTokenIds);
  const compoundTokenMap = useMemo(() => {
    const map: Record<number, any> = {};
    compoundTokens.forEach((token) => {
      map[token.id] = token;
    });
    return map;
  }, [compoundTokens]);

  // Calculate statistics when lemma or filters change
  useEffect(() => {
    if (!selectedLemmaId || !tokensForLemma.length) {
      setClfDict({});
      setComDict({});
      setScrDict({});
      setScrClassifiedDict({});
      setClassifiedTokenCount(0);
      setOuterCompoundClfDict({});
      return;
    }

    const newClfDict: ClassifierStats = {};
    const newComDict: ClassifierStats = {};
    const newScrDict: ClassifierStats = {};
    const newScrClassifiedDict: ClassifierStats = {};
    const newOuterCompoundClfDict: ClassifierStats = {};
    let newClassifiedTokenCount = 0;
    
    tokensForLemma.forEach((token: any) => {
      const clfs = extractClfsFromString(token.mdc_w_markup);
      const filteredClfs = clfs.filter((clf) => classifierMatchesFilters(clf, token.id));
      const isClassified = filteredClfs.length > 0;
      if (isClassified) newClassifiedTokenCount += 1;
      
      // Individual classifier counts
      filteredClfs.forEach(clf => {
        newClfDict[clf] = (newClfDict[clf] || 0) + 1;
      });
      
      // Classifier combinations
      if (filteredClfs.length > 0) {
        const combination = filteredClfs.join('+');
        newComDict[combination] = (newComDict[combination] || 0) + 1;
      }
      
      // Script statistics
      const witness = witnessData[token.witness_id];
      if (witness?.script) {
        const scriptLabel = getThesaurusLabel(projectType, "scripts", witness.script);
        newScrDict[scriptLabel] = (newScrDict[scriptLabel] || 0) + 1;
        if (isClassified) {
          newScrClassifiedDict[scriptLabel] = (newScrClassifiedDict[scriptLabel] || 0) + 1;
        }
      }

      if (tokenDisplayType === "compound-part" && token.compound_id) {
        const compoundToken = compoundTokenMap[token.compound_id];
        if (compoundToken) {
          const compoundClfs = extractClfsFromString(compoundToken.mdc_w_markup);
          const filteredCompoundClfs = compoundClfs.filter((clf) =>
            classifierMatchesFilters(clf, compoundToken.id)
          );
          filteredCompoundClfs.forEach((clf) => {
            newOuterCompoundClfDict[clf] = (newOuterCompoundClfDict[clf] || 0) + 1;
          });
        }
      }
    });
    
    setClfDict(newClfDict);
    setComDict(newComDict);
    setScrDict(newScrDict);
    setScrClassifiedDict(newScrClassifiedDict);
    setClassifiedTokenCount(newClassifiedTokenCount);
    setOuterCompoundClfDict(newOuterCompoundClfDict);
  }, [
    selectedLemmaId,
    tokensForLemma,
    extractClfsFromString,
    witnessData,
    compoundTokenMap,
    tokenDisplayType,
    projectType,
    classifierMatchesFilters
  ]);

  // Handle project change
  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    setSelectedLemmaId(null); // Reset lemma selection
    setSelectedWitnesses(new Set());
    setSelectedScripts(new Set());
  };

  // Handle lemma selection
  const handleLemmaSelect = (lemmaId: number) => {
    if (selectedProject) {
      openLemma(lemmaId);
      // Scroll to report content after selection
      setTimeout(() => {
        const reportContent = document.querySelector('[id="lemma-report-data"]');
        if (reportContent) {
          reportContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  const selectedLemmaInfo = selectedLemmaId ? lemmaData[selectedLemmaId] : null;

  const getClassifierBaseLabel = useCallback((classifier: string) => {
    if (projectType !== "hieroglyphic") return classifier;
    const glyph = mdc2uni[classifier] || classifier;
    return `${glyph} (${classifier})`;
  }, [projectType]);

  const renderClassifierCombo = useCallback((combo: string) => {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-1 max-w-full">
        {combo.split("+").map((classifier, index) => (
          <span key={`${combo}-${classifier}-${index}`} className="inline-flex items-baseline">
            {index > 0 && <span className="mr-1 text-gray-400">+</span>}
            <ClassifierLabel
              classifier={classifier}
              meanings={mergedClassifierMeanings}
              displayLabel={getClassifierBaseLabel(classifier)}
              projectType={projectType}
              projectId={selectedProject}
            />
          </span>
        ))}
      </span>
    );
  }, [mergedClassifierMeanings, getClassifierBaseLabel]);

  // Toggle network physics
  const toggleLemmaNetworkFreeze = useCallback(() => {
    if (networkInstanceRef.current) {
      if (isLemmaNetworkFrozen) {
        networkInstanceRef.current.setOptions({
          physics: { enabled: true },
          interaction: getInteractionByFrozenState(false),
        });
        if (typeof networkInstanceRef.current.startSimulation === "function") {
          networkInstanceRef.current.startSimulation();
        }
      } else {
        if (typeof networkInstanceRef.current.stopSimulation === "function") {
          networkInstanceRef.current.stopSimulation();
        }
        if (typeof networkInstanceRef.current.fit === "function") {
          networkInstanceRef.current.fit({ animation: false });
        }
        networkInstanceRef.current.setOptions({
          physics: { enabled: false },
          interaction: getInteractionByFrozenState(true),
        });
      }
      setIsLemmaNetworkFrozen(!isLemmaNetworkFrozen);
    }
  }, [isLemmaNetworkFrozen]);

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

  // Create network graph
  const createNetworkGraph = useCallback(() => {
    if (!visReady || !networkRef.current || !VisNetwork || !VisDataSet || !selectedLemmaId || !selectedLemmaInfo) return;
    if (lemmaTokensLoading) return;
    setIsLemmaNetworkLoading(true);
    setIsLemmaNetworkFrozen(false);

    // Clear previous network
    if (networkInstanceRef.current) {
      networkInstanceRef.current.destroy();
      networkInstanceRef.current = null;
    }
    const renderToken = Date.now();
    networkTokenRef.current = renderToken;

    // Use the comprehensive network creation function
    const networkData = createLemmaNetwork(
      selectedLemmaId,
      lemmaData,
      {},
      clfDict,
      {
        useUnicode,
        classifierDisplayMode,
        lemmaDisplayMode,
        lemmaFontFace: getLemmaNodeFontFace(projectType),
        classifierFontFace:
          projectType === "cuneiform"
            ? "cuneiform"
            : projectType === "chinese"
              ? "Noto Sans TC"
              : (useUnicode ? "eot" : "hierofont"),
        classifierMeanings: mergedClassifierMeanings,
        projectId: selectedProject,
        projectType
      }
    );

    if (networkData.nodes.length === 0) {
      setIsLemmaNetworkLoading(false);
      return;
    }
    const adjustedEdges = networkData.edges.map((edge) => ({
      ...edge,
      color: { color: LEMMA_NETWORK_EDGE_COLOR }
    }));
    const { edges: scaledEdges, scale } = scaleEdgeWidths(adjustedEdges);
    setLemmaEdgeScale(scale);
    const getStrokeOffset = (edgeWidth: number) => {
      if (!Number.isFinite(edgeWidth)) return 0;
      return Math.max(edgeWidth / 2, 0);
    };
    const nodeById = new Map(networkData.nodes.map((node: any) => [String(node.id), node]));
    const edgesWithOffsets = scaledEdges.map((edge) => {
      const width = Number(edge.width);
      const offset = getStrokeOffset(width);
      return {
        ...edge,
        endPointOffset: {
          from: offset,
          to: offset,
        },
      };
    });
    setLemmaNetworkData({ nodes: networkData.nodes, edges: edgesWithOffsets });

    // Create network
    const visNetworkData = {
      nodes: new VisDataSet(networkData.nodes),
      edges: new VisDataSet(edgesWithOffsets)
    };

    const options = {
      ...getLegacyMapOptions(),
      edges: {
        smooth: { enabled: true, type: "dynamic", roundness: 0.18 },
        length: 120
      },
      physics: {
        enabled: true,
        barnesHut: {
          gravitationalConstant: -1800,
          centralGravity: 0.24,
          springLength: 120,
          springConstant: 0.065,
          damping: 0.4,
          avoidOverlap: 0.7
        },
        stabilization: { iterations: stabilizationIterations, fit: false }
      }
    };
    const network = new VisNetwork(networkRef.current, visNetworkData, options);
    networkInstanceRef.current = network;

    // Ensure the network container doesn't exceed parent bounds
    if (networkRef.current && networkRef.current.parentElement) {
      networkRef.current.parentElement.style.maxWidth = "100%";
      networkRef.current.parentElement.style.overflow = "hidden";
      networkRef.current.style.maxWidth = "100%";
      networkRef.current.style.overflow = "hidden";
    }

    // Use ResizeObserver to keep network size in sync with container
    const setupResizeObserver = () => {
      const container = networkFrameRef.current;
      if (!container || networkResizeObserverRef.current) return;

      networkResizeObserverRef.current = new ResizeObserver(() => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width > 0 && height > 0 && typeof network.setSize === "function") {
          network.setSize(`${width}px`, `${height}px`);
        }
      });
      networkResizeObserverRef.current.observe(container);
    };

    let finalized = false;
    const finalize = () => {
      if (finalized) return;
      finalized = true;
      window.clearTimeout(fallbackId);

      // Set up resize observer after first initialization
      setupResizeObserver();

      if (typeof network.setSize === "function") {
        const frame = networkFrameRef.current;
        const container = networkRef.current;
        const width = frame?.clientWidth || container?.clientWidth || DEFAULT_NETWORK_FRAME_SIZE;
        const height = frame?.clientHeight || container?.clientHeight || DEFAULT_NETWORK_FRAME_SIZE;
        network.setSize(`${width}px`, `${height}px`);
      }
      network.fit({ animation: false });
      if (typeof network.stopSimulation === "function") {
        network.stopSimulation();
      }
      network.setOptions({
        physics: { enabled: false },
        interaction: getInteractionByFrozenState(true),
      });
      network.redraw();
      setIsLemmaNetworkFrozen(true);
      setIsLemmaNetworkLoading(false);
    };
    const fallbackId = window.setTimeout(() => finalize(), 2000);
    network.once("stabilizationIterationsDone", finalize);

    if (selectedProjectInfo?.type === "hieroglyphic" && classifierDisplayMode === "visual") {
      const classifierNodes = networkData.nodes.filter((node) => node.type === "classifier");
      Promise.all(
        classifierNodes.map(async (node) => {
          const mdc = normalizeMdcKey(node.mdc || node.label);
          const glyph = mdc ? mdc2uni[mdc] : undefined;
          const hasUnicodeGlyph = typeof glyph === "string" && (glyph.codePointAt(0) || 0) >= 256;
          // Fetch image if: NOT using unicode, or unicode glyph doesn't exist for this classifier
          if (useUnicode && hasUnicodeGlyph) return;
          const cacheKey = mdc;
          if (!cacheKey) return;
          const cached = classifierImageCache.get(cacheKey);
          const cachedImage = cached ? wrapClassifierImage(cached) : null;
          if (cachedImage) {
            classifierImageCache.set(cacheKey, cachedImage);
            if (networkTokenRef.current !== renderToken) return;
            return {
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
            };
          }
          const extendedSignData = await fetchExtendedSignDataUrl(cacheKey);
          if (extendedSignData) {
            const wrapped = wrapClassifierImage(extendedSignData);
            classifierImageCache.set(cacheKey, wrapped);
            if (networkTokenRef.current !== renderToken) return;
            return {
              id: node.id,
              shape: "image",
              image: wrapped,
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
            };
          }
          const base64 = await fetchJseshBase64(mdc, getJseshRenderHeight(CLF_NODE_HEIGHT), true);
          if (!base64) return;
          if (networkTokenRef.current !== renderToken) return;
          const url = wrapClassifierImage(getJseshImageUrl(base64));
          classifierImageCache.set(cacheKey, url);
          return {
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
          };
        })
      ).then((updates) => {
        if (networkTokenRef.current !== renderToken) return;
        const validUpdates = updates.filter(Boolean);
        if (validUpdates.length > 0) {
          visNetworkData.nodes.update(validUpdates as any[]);
          try { network.redraw(); } catch { /* network may be destroyed */ }
        }
        finalize();
      }).catch(() => undefined);
    }
    setTimeout(() => {
      if (networkTokenRef.current !== renderToken) return;
      finalize();
    }, 2000);

    // Handle node clicks
    let netLastClickTime = 0;
    let netClickTimeout: any = null;

    network.on('click', (params: any) => {
      if (params.nodes.length === 0) return;

      const nodeId = params.nodes[0];
      const currentTime = Date.now();
      const isDoubleClick = currentTime - netLastClickTime < 300;

      if (!isDoubleClick) {
        // Single click - toggle mode
        netClickTimeout = setTimeout(() => {
          // Disable physics before updating nodes
          network.setOptions({ physics: false });

          if (nodeId.startsWith('classifier_')) {
            // Toggle classifier display mode
            const newMode = classifierDisplayModeRef.current === 'visual' ? 'meaning' : 'visual';

            const nodeData = networkData.nodes.find((n: any) => n.id === nodeId);
            if (nodeData) {
              const clf = normalizeMdcKey(nodeData.mdc);
              const visNodes = networkInstanceRef.current?.body?.data?.nodes;
              const classifierFont = projectType === "cuneiform"
                ? "cuneiform"
                : projectType === "chinese"
                  ? "Noto Sans TC"
                  : (useUnicode ? "eot" : "hierofont");

              if (newMode === 'meaning') {
                const newLabel = formatClassifierMeaningLabel(mergedClassifierMeaningsRef.current?.[clf], selectedProject, { html: true }) || '';
                if (visNodes) {
                  visNodes.update({
                    id: nodeId,
                    label: newLabel,
                    shape: "box",
                    image: undefined,
                    shapeProperties: { borderRadius: CLF_NODE_RADIUS, borderDashes: false },
                    font: {
                      face: "sans-serif",
                      size: 10,
                      color: "#000000",
                      align: "center",
                      valign: "middle",
                      multi: /<[^>]+>/.test(newLabel) ? "html" : false
                    }
                  });
                }
              } else {
                // Visual mode
                const hasUnicodeGlyph = useUnicode && Boolean(mdc2uni[clf]);
                const needsJsesh = projectType === "hieroglyphic" && !hasUnicodeGlyph;
                const cachedImage = needsJsesh ? classifierImageCache.get(clf) : null;
                const wrappedImage = cachedImage ? wrapClassifierImage(cachedImage) : null;

                if (wrappedImage) {
                  if (visNodes) {
                    visNodes.update({
                      id: nodeId,
                      shape: "image",
                      image: wrappedImage,
                      brokenImage: BROKEN_IMAGE_PLACEHOLDER,
                      label: "",
                      size: CLF_NODE_HEIGHT,
                      color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
                      shapeProperties: { borderDashes: false, useBorderWithImage: false, interpolation: false, useImageSize: true },
                      widthConstraint: { minimum: CLF_NODE_WIDTH, maximum: CLF_NODE_WIDTH },
                      heightConstraint: { minimum: CLF_NODE_HEIGHT, maximum: CLF_NODE_HEIGHT }
                    });
                    try { network.redraw(); } catch { /* network may be destroyed */ }
                  }
                } else if (needsJsesh) {
                  // Show MdC code as placeholder while loading
                  const fallbackLabel = clf;
                  if (visNodes) {
                    visNodes.update({
                      id: nodeId,
                      label: fallbackLabel,
                      shape: "box",
                      image: undefined,
                      shapeProperties: { borderRadius: CLF_NODE_RADIUS, borderDashes: false },
                      font: { face: classifierFont, size: 11, color: "#000000", align: "center", valign: "middle", multi: false }
                    });
                  }
                  // Load JSesh image asynchronously
                  (async () => {
                    try {
                      const extendedData = await fetchExtendedSignDataUrl(clf);
                      if (extendedData) {
                        const wrapped = wrapClassifierImage(extendedData);
                        classifierImageCache.set(clf, wrapped);
                        const vn = networkInstanceRef.current?.body?.data?.nodes;
                        if (vn) {
                          vn.update({
                            id: nodeId, shape: "image", image: wrapped, brokenImage: BROKEN_IMAGE_PLACEHOLDER,
                            label: "", size: CLF_NODE_HEIGHT,
                            color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
                            shapeProperties: { borderDashes: false, useBorderWithImage: false, interpolation: false, useImageSize: true },
                            widthConstraint: { minimum: CLF_NODE_WIDTH, maximum: CLF_NODE_WIDTH },
                            heightConstraint: { minimum: CLF_NODE_HEIGHT, maximum: CLF_NODE_HEIGHT }
                          });
                          try { network.redraw(); } catch {}
                        }
                        return;
                      }
                      const base64 = await fetchJseshBase64(clf, getJseshRenderHeight(CLF_NODE_HEIGHT), true);
                      if (!base64) return;
                      const url = wrapClassifierImage(getJseshImageUrl(base64));
                      classifierImageCache.set(clf, url);
                      const vn = networkInstanceRef.current?.body?.data?.nodes;
                      if (vn) {
                        vn.update({
                          id: nodeId, shape: "image", image: url, brokenImage: BROKEN_IMAGE_PLACEHOLDER,
                          label: "", size: CLF_NODE_HEIGHT,
                          color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
                          shapeProperties: { borderDashes: false, useBorderWithImage: false, interpolation: false, useImageSize: true },
                          widthConstraint: { minimum: CLF_NODE_WIDTH, maximum: CLF_NODE_WIDTH },
                          heightConstraint: { minimum: CLF_NODE_HEIGHT, maximum: CLF_NODE_HEIGHT }
                        });
                        try { network.redraw(); } catch {}
                      }
                    } catch { /* ignore */ }
                  })();
                } else {
                  // Unicode glyph or non-hieroglyphic
                  const glyph = hasUnicodeGlyph ? mdc2uni[clf] : clf;
                  if (visNodes) {
                    visNodes.update({
                      id: nodeId,
                      label: glyph,
                      shape: "box",
                      image: undefined,
                      shapeProperties: { borderRadius: CLF_NODE_RADIUS, borderDashes: false },
                      font: { face: classifierFont, size: hasUnicodeGlyph ? 18 : 11, color: "#000000", align: "center", valign: "middle", multi: false }
                    });
                  }
                }
              }
            }

            setClassifierDisplayMode(newMode);
          } else if (nodeId.startsWith('lemma_')) {
            // Toggle lemma display mode
            const newMode = lemmaDisplayModeRef.current === 'origin'
              ? 'translation'
              : lemmaDisplayModeRef.current === 'translation'
                ? 'both'
                : 'origin';

            const nodeData = networkData.nodes.find((n: any) => n.id === nodeId);
            if (nodeData) {
              const lemmaId = parseInt(nodeId.replace('lemma_', ''), 10);
              const lemma = lemmaData[lemmaId];
              if (lemma) {
                let newLabel: string;
                if (newMode === 'both') {
                  newLabel = formatLemmaOriginTranslationLabel(lemma.meaning, lemma.transliteration, String(lemmaId), projectType);
                } else if (newMode === 'translation') {
                  newLabel = formatLemmaTranslationLabel(lemma.meaning, lemma.transliteration, String(lemmaId), projectType);
                } else {
                  newLabel = formatLemmaOriginLabelItalic(lemma.transliteration, String(lemmaId), projectType);
                }

                // Update node label directly
                const visNodes = networkInstanceRef.current?.body?.data?.nodes;
                if (visNodes) {
                  const lemmaFont = getLemmaNodeFontFace(projectType);
                  visNodes.update({
                    id: nodeId,
                    label: newLabel,
                    font: {
                      color: '#000000',
                      size: 14,
                      face: lemmaFont,
                      align: 'center',
                      valign: 'top',
                      multi: /<[^>]+>/.test(newLabel) ? "html" : true
                    }
                  });
                }
              }
            }

            setLemmaDisplayMode(newMode);
          }
        }, 150);
      } else {
        // Double click - navigate
        if (netClickTimeout) clearTimeout(netClickTimeout);

        if (nodeId.startsWith('classifier_')) {
          const classifier = nodeId.replace('classifier_', '');
          // Navigate to classifier on double-click
          openClassifier(classifier);
        } else if (nodeId.startsWith('related_lemma_')) {
          const lemmaId = nodeId.replace('related_lemma_', '');
          // Navigate to lemma on double-click
          openLemma(lemmaId);
        }
      }

      netLastClickTime = currentTime;
    });
  }, [visReady, selectedLemmaId, selectedLemmaInfo, clfDict, lemmaData, selectedProjectInfo, useUnicode, projectType, mergedClassifierMeanings, openClassifier, openLemma]);

  // Create network graph when data changes
  useEffect(() => {
    if (selectedLemmaId) {
      const timer = setTimeout(() => {
        createNetworkGraph();
      }, 100);
      return () => {
        clearTimeout(timer);
        // Cleanup resize observer when unmounting or data changes
        if (networkResizeObserverRef.current) {
          networkResizeObserverRef.current.disconnect();
          networkResizeObserverRef.current = null;
        }
      };
    }
  }, [visReady, selectedLemmaId, clfDict, createNetworkGraph, useUnicode, lemmaTokensLoading]);

  useEffect(() => {
    if (!selectedLemmaId || !networkInstanceRef.current) return;
    const nodes = networkInstanceRef.current.body?.data?.nodes;
    if (!nodes) return;
    const lemmaNodeId = `lemma_${selectedLemmaId}`;
    if (typeof nodes.get === "function" && !nodes.get(lemmaNodeId)) return;
    const lemma = lemmaData[selectedLemmaId];
    if (!lemma) return;

    const newLabel = lemmaDisplayMode === "both"
      ? formatLemmaOriginTranslationLabel(lemma.meaning, lemma.transliteration, String(selectedLemmaId), projectType)
      : lemmaDisplayMode === "translation"
        ? formatLemmaTranslationLabel(lemma.meaning, lemma.transliteration, String(selectedLemmaId), projectType)
        : formatLemmaOriginLabelItalic(lemma.transliteration, String(selectedLemmaId), projectType);
    const lemmaFont = getLemmaNodeFontFace(projectType);

    nodes.update({
      id: lemmaNodeId,
      label: newLabel,
      font: {
        color: '#000000',
        size: 14,
        face: lemmaFont,
        align: 'center',
        valign: 'top',
        multi: /<[^>]+>/.test(newLabel) ? "html" : true
      }
    });
  }, [lemmaDisplayMode, selectedLemmaId, lemmaData, projectType]);

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsLemmaNetworkFullscreen(document.fullscreenElement === networkCardRef.current);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && document.fullscreenElement === networkCardRef.current) {
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
    if (!networkInstanceRef.current) return;
    if (typeof networkInstanceRef.current.setSize === "function") {
      networkInstanceRef.current.setSize("100%", "100%");
    }
    if (typeof networkInstanceRef.current.redraw === "function") {
      networkInstanceRef.current.redraw();
    }
    if (typeof networkInstanceRef.current.fit === "function") {
      networkInstanceRef.current.fit({ animation: false });
    }
  }, [isLemmaNetworkFullscreenActive]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    if (!networkFrameRef.current) return;
    const frame = networkFrameRef.current;
    const observer = new ResizeObserver(() => {
      const net = networkInstanceRef.current;
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

  const scrollToSection = (id: string) => {
    const section = document.getElementById(id);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Sort statistics for display
  const sortedClfStats = useMemo(() => {
    return Object.entries(clfDict).sort((a, b) => b[1] - a[1]);
  }, [clfDict]);

  const sortedComStats = useMemo(() => {
    return Object.entries(comDict).sort((a, b) => b[1] - a[1]);
  }, [comDict]);

  const sortedScrStats = useMemo(() => {
    return Object.entries(scrDict).sort((a, b) => b[1] - a[1]);
  }, [scrDict]);

  const sortedOuterCompoundClfStats = useMemo(() => {
    return Object.entries(outerCompoundClfDict).sort((a, b) => b[1] - a[1]);
  }, [outerCompoundClfDict]);

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-64">
          <NetworkLoader title="Loading lemma data..." />
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
      {/* Show loading state */}
      {loading && (
        <div className="flex items-center justify-center h-96">
          <NetworkLoader title="Loading project data..." />
        </div>
      )}

      {/* Show error state */}
      {error && !loading && (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="text-red-600 mb-3">⚠ Error loading project data</div>
            <p className="text-gray-600">
              {error}
            </p>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline" 
              className="mt-3"
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Show main content when data is available */}
      {!loading && !error && (
      <div className="max-w-[1600px] mx-auto w-full space-y-3" id="lemma-report-content">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
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
                <h1 className="text-3xl font-bold page-accent-text">Lemma Report</h1>
                <div className="text-gray-600">
                  Browse the lemma report to learn about its attested forms and classifier assignmments
                  {selectedProjectInfo && (
                    <span className="ml-2">
                      • <Badge variant="secondary">{selectedProjectInfo.name}</Badge>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {!isComparisonRoute && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => openReportType("classifier")}
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <span className="w-4 h-4 mr-2 inline-flex items-center justify-center text-base">
                  𓀁
                </span>
                Classifier Report
              </Button>
              <Button
                variant="outline"
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

        {/* Lemma List - Primary Selection Section */}
        <Card id="lemma-selection" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Lemma List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">
                Search Lemmas
              </label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search in transliteration, meaning, and all lemma fields..."
                  value={lemmaSearchQuery}
                  onChange={(e) => setLemmaSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Select Lemma</label>
              {selectedLemmaId && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-sm text-blue-800">Selected: </span>
                  <span className="font-medium text-blue-900">
                    <em className="italic">{lemmaData[selectedLemmaId]?.transliteration || "?"}</em> ({formatLemmaMeaningForPage(lemmaData[selectedLemmaId]?.meaning, projectType) || "?"})
                  </span>
                  <button
                    onClick={() => setSelectedLemmaId(null)}
                    className="ml-2 text-blue-600 hover:text-blue-800 underline text-sm"
                  >
                    Clear
                  </button>
                </div>
              )}
              {(lemmaSearchQuery.trim() || isSearchFocused) && (
                <div className="mb-2 flex flex-wrap gap-2">
                  <Button
                    variant={lemmaSortBy === "count" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLemmaSortBy("count")}
                  >
                    Sort by Size
                  </Button>
                  <Button
                    variant={lemmaSortBy === "id" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLemmaSortBy("id")}
                  >
                    Sort ABC
                  </Button>
                </div>
              )}
              {(lemmaSearchQuery.trim() || isSearchFocused) && (
                <div className={`overflow-y-auto border border-gray-200 rounded-lg transition-all ${
                  isSearchFocused ? 'max-h-96' : 'max-h-48'
                }`}>
                  {filteredLemmas.slice(0, 100).map(([id, count]) => {
                    const lemma = lemmaData[id];
                    const isSelected = selectedLemmaId === id;
                    const hasClassifiers = lemmaHasClassifiers(id);
                    return (
                      <button
                        key={id}
                        onClick={() => handleLemmaSelect(id)}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0 transition-colors ${
                          isSelected ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                      >
                        <span className="text-sm text-gray-600">{count}:</span>
                        <span className={`ml-2 ${hasClassifiers ? 'font-bold' : 'font-medium'}`}>
                          <em className="italic">{lemma?.transliteration || "?"}</em>
                        </span>
                        <span className="ml-2 text-gray-600">({formatLemmaMeaningForPage(lemma?.meaning, projectType) || "?"})</span>
                        {hasClassifiers && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">+</span>
                        )}
                      </button>
                    );
                  })}
                  {filteredLemmas.length === 0 && (
                    <div className="px-3 py-3 text-gray-500 text-center">
                      No lemmas found matching your search.
                    </div>
                  )}
                </div>
              )}
              {!lemmaSearchQuery.trim() && !isSearchFocused && !selectedLemmaId && (
                <div className="px-3 py-3 text-gray-500 text-center border border-gray-200 rounded-lg">
                  Click the search box to see all lemmas...
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFilterMenuExpanded(!isFilterMenuExpanded)}
              className="w-full"
            >
              {isFilterMenuExpanded ? "Hide search filters" : "Show search filters"}
            </Button>

            {isFilterMenuExpanded && (
              <div className="space-y-3 pt-2 border-t">
                <div>
                  <div className="text-sm font-medium mb-2">Text Filter</div>
                  <WitnessSelector
                    witnessData={witnessData}
                    selectedWitnesses={selectedWitnesses}
                    setSelectedWitnesses={setSelectedWitnesses}
                    projectType={projectType}
                  />
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Script Filter</div>
                  <ScriptSelector
                    witnessData={witnessData}
                    selectedScripts={selectedScripts}
                    setSelectedScripts={setSelectedScripts}
                    projectType={projectType}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Report Content */}
        {selectedLemmaId && selectedLemmaInfo && (
          <div id="lemma-report-data" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  {/* hh: later can decide if put italics to other scripts */}
                  Lemma: <em className="italic">{selectedLemmaInfo.transliteration}</em> ({formatLemmaMeaningForPage(selectedLemmaInfo.meaning, projectType) || "?"})
                </CardTitle>
                <p className="text-sm text-gray-600">
                  {tokensForLemma.length} token{tokensForLemma.length !== 1 ? 's' : ''} found
                  {tokenDisplayType !== 'all' && ` (${tokenDisplayType} only)`}
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => scrollToSection("lemma-network")}
                  >
                    Lemma Network
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => scrollToSection("lemma-tokens")}
                  >
                    Token List
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => scrollToSection("lemma-statistics")}
                  >
                    Statistics
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <TypeSelector
                    selectedTypes={clfTypes}
                    onTypesChange={setClfTypes}
                  />
                  <LevelSelector
                    selectedLevels={clfLevels}
                    onLevelsChange={setClfLevels}
                    maxLevel={5}
                  />
                </div>

                <div id="lemma-network" className="scroll-mt-24 space-y-3">
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] gap-3 items-start">
    <Card
      className={isLemmaNetworkFullscreenActive ? "min-w-0 flex flex-col h-screen w-screen max-h-none max-w-none rounded-none" : ""}
      ref={networkCardRef}
    >
                      <CardHeader>
                        <CardTitle>
                          Lemma Classification network
                        </CardTitle>
                      </CardHeader>
      <CardContent className={isLemmaNetworkFullscreenActive ? "space-y-3 flex flex-col min-h-0" : "space-y-3"}>
        <div className="flex items-center justify-start gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLemmaNetworkFreeze}
            className="flex items-center gap-1 font-bold"
          >
            {isLemmaNetworkFrozen ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            {isLemmaNetworkFrozen ? "Unfreeze" : "Freeze"}
          </Button>
          <NetworkLegend showLemmaToggle={true} showClassifierToggle={true} />
        </div>
        <div
          ref={networkFrameRef}
          className={isLemmaNetworkFullscreenActive ? "relative flex-1 min-h-0" : "network-frame-fixed"}
          style={
            isLemmaNetworkFullscreenActive
              ? undefined
              : ({ "--network-frame-size": "900px" } as React.CSSProperties)
          }
        >
          <div
            ref={networkRef}
            className="w-full h-full border border-gray-200 rounded-lg bg-white"
            style={{
                              position: "relative",
                              touchAction: "none",
                              userSelect: "none",
                              WebkitTapHighlightColor: "rgba(0, 0, 0, 0)",
                              width: "100%",
                              height: "100%",
                              display: "block",
                              overflow: "hidden"
                            } as React.CSSProperties}
                          />
                          <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-white/90 shadow-sm"
                              onClick={() => setShowNodeModeControls((prev) => !prev)}
                            >
                              Change node modes
                            </Button>
                            {showNodeModeControls && (
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
                          {(isLemmaNetworkLoading || lemmaTokensLoading) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                              <NetworkLoader className="scale-75" title="Loading network..." />
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleBackground(networkRef.current)}
                          >
                            Switch background color
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              isLemmaNetworkFullscreenActive
                                ? exitFullscreen()
                                : goFullScreen(networkCardRef.current)
                            }
                          >
                            {isLemmaNetworkFullscreenActive ? "Exit fullscreen" : "Go fullscreen"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadNetworkPNG(networkInstanceRef.current, 96, `lemma-network-96dpi.png`).catch(console.error)}
                          >
                            PNG 96
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadNetworkPNG(networkInstanceRef.current, 300, `lemma-network-300dpi.png`).catch(console.error)}
                          >
                            PNG 300
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadNetworkSVGVector(networkInstanceRef.current, "lemma-network.svg")}
                          >
                            SVG
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadNetworkDataWorkbook(lemmaNetworkData.nodes, lemmaNetworkData.edges, "lemma-network-data.xls")}
                          >
                            Data
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card id="lemma-statistics" className="min-w-0 w-full xl:max-w-[360px]">
                      <CardHeader>
                        <CardTitle className="text-base">Classifier combinations with this lemma</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-4 space-y-1 text-sm text-gray-700">
                          <div>Number of examples in this project: {tokensForLemma.length}</div>
                          <div>
                            Lemma classification rate {classifiedTokenCount}/{tokensForLemma.length} (
                            {tokensForLemma.length
                              ? Math.round((classifiedTokenCount / tokensForLemma.length) * 100)
                              : 0}
                            %)
                          </div>
                        </div>
                        {sortedComStats.length > 0 || noClassifierCount > 0 ? (
                          <Table className="w-full table-fixed">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="h-9 px-2">Classifier combination</TableHead>
                                <TableHead className="text-right h-9 px-2">Count</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedComStats.map(([com, count]) => (
                                <TableRow key={com}>
                                  <TableCell className="text-xs px-2 py-2 break-words whitespace-normal">
                                    {renderClassifierCombo(com)}
                                  </TableCell>
                                  <TableCell className="text-right px-2 py-2">{count}</TableCell>
                                </TableRow>
                              ))}
                              {noClassifierCount > 0 && (
                                <TableRow>
                                  <TableCell className="text-xs px-2 py-2 text-gray-700">
                                    No classifier
                                  </TableCell>
                                  <TableCell className="text-right px-2 py-2">{noClassifierCount}</TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-gray-500 text-sm">No combinations found</p>
                        )}
                        <div className="mt-5">
                          <h3 className="font-semibold text-black mb-3">
                            Classifier statistics for the lemma
                            {tokenDisplayType === "compound-part" ? " (tokens functioning as compound parts)" : ""}
                          </h3>
                          {sortedClfStats.length > 0 || noClassifierCount > 0 ? (
                            <Table className="w-full table-fixed">
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="h-9 px-2">Classifier</TableHead>
                                  <TableHead className="text-right h-9 px-2">Count</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedClfStats.map(([clf, count]) => (
                                  <TableRow key={clf}>
                                    <TableCell className="px-2 py-2 break-words whitespace-normal">
                                      <ClassifierLabel
                                        classifier={clf}
                                        meanings={mergedClassifierMeanings}
                                        displayLabel={getClassifierBaseLabel(clf)}
                                        projectType={projectType}
                                        projectId={selectedProject}
                                      />
                                    </TableCell>
                                    <TableCell className="text-right px-2 py-2">{count}</TableCell>
                                  </TableRow>
                                ))}
                                {noClassifierCount > 0 && (
                                  <TableRow>
                                    <TableCell className="px-2 py-2 text-gray-700">
                                      No classifier
                                    </TableCell>
                                    <TableCell className="text-right px-2 py-2">{noClassifierCount}</TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          ) : (
                            <p className="text-gray-500 text-sm">No classifiers found</p>
                          )}
                        </div>
                        {tokenDisplayType === "compound-part" && (
                          <div className="mt-5">
                            <h3 className="font-semibold text-black mb-3">
                              Classifier statistics for compounds including this lemma's tokens as parts
                            </h3>
                            {sortedOuterCompoundClfStats.length > 0 ? (
                              <Table className="w-full table-fixed">
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="h-9 px-2">Classifier</TableHead>
                                    <TableHead className="text-right h-9 px-2">Count</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sortedOuterCompoundClfStats.map(([clf, count]) => (
                                    <TableRow key={clf}>
                                      <TableCell className="px-2 py-2 break-words whitespace-normal">
                                        <ClassifierLabel
                                          classifier={clf}
                                          meanings={mergedClassifierMeanings}
                                          displayLabel={getClassifierBaseLabel(clf)}
                                          projectType={projectType}
                                          projectId={selectedProject}
                                        />
                                      </TableCell>
                                      <TableCell className="text-right px-2 py-2">{count}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : (
                              <p className="text-gray-500 text-sm">No compound classifier data found</p>
                            )}
                          </div>
                        )}
                        <div className="mt-5">
                          <h3 className="font-semibold text-black mb-3">Script statistics</h3>
                          {sortedScrStats.length > 0 ? (
                            <Table className="w-full table-fixed">
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="h-9 px-2">Script</TableHead>
                                  <TableHead className="text-right h-9 px-2">Count</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedScrStats.map(([script, count]) => {
                                  const classifiedCount = scrClassifiedDict[script] || 0;
                                  const classifiedRate = count ? Math.round((classifiedCount / count) * 100) : 0;
                                  return (
                                    <TableRow key={script}>
                                      <TableCell className="px-2 py-2 break-words whitespace-normal">{script}</TableCell>
                                      <TableCell className="text-right px-2 py-2">
                                        <div>{count}</div>
                                        <div className="text-xs text-gray-600">
                                          {classifiedCount}/{count} ({classifiedRate}%)
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          ) : (
                            <p className="text-gray-500 text-sm">No script data found</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div id="lemma-tokens" className="scroll-mt-24 mt-3">
                  <Card>
                    <CardHeader className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-sm">
                          All Tokens for <em className="italic">{selectedLemmaInfo.transliteration}</em> ({formatLemmaMeaningForPage(selectedLemmaInfo.meaning, projectType) || "?"})
                        </CardTitle>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (!lemmaTokenListText) return;
                              navigator.clipboard?.writeText(lemmaTokenListText);
                            }}
                            disabled={!lemmaTokenListText}
                          >
                            Copy token list
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsLemmaTokenListExpanded((prev) => !prev)}
                          >
                            {isLemmaTokenListExpanded ? "Collapse token list" : "Extend token list"}
                          </Button>
                        </div>
                      </div>
                      <div className="pt-2">
                        <label className="block text-sm font-medium mb-2">Token Display Type</label>
                        <Select
                          value={tokenDisplayType}
                          onValueChange={(value: TokenDisplayType) => setTokenDisplayType(value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All tokens</SelectItem>
                            <SelectItem value="standalone">Standalone tokens</SelectItem>
                            <SelectItem value="compound">Compound tokens</SelectItem>
                            <SelectItem value="compound-part">Parts of compounds</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div
                        className={cn(
                          !isLemmaTokenListExpanded && "max-h-96 overflow-auto",
                          !isLemmaTokenListExpanded && isComparisonRoute && "max-h-96"
                        )}
                      >
                        <ul className="space-y-2">
                          {tokensForLemma.map((token: any, index: number) => {
                            const coloredMarkup = colorClassifiers(token.mdc_w_markup);
                            const witness = witnessData[token.witness_id];
                            const tokenClassifiers = extractClfsFromString(token.mdc_w_markup);
                            const tokenContext = String(token.syntactic_relation || "").trim();
                            const scriptLabel = witness?.script
                              ? getThesaurusLabel(projectType, "scripts", witness.script)
                              : "";
                            const tlaSentenceId = getTlaSentenceId(token);
                            const unicodeMdc = projectType === "hieroglyphic"
                              ? mdcToUnicode(token.mdc || token.mdc_w_markup || "")
                              : "";
                            const tokenMdc = token.mdc || token.mdc_w_markup || "";

                            return (
                              <li key={`${token.id}-${index}`} className="border-l-2 border-gray-200 pl-3">
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
                                    </div>
                                    {/* Unicode display - commented out but not removed */}
                                    {/* {unicodeMdc && (
                                      <div className="egyptian-unicode text-lg text-gray-800 font-medium">
                                        {unicodeMdc}
                                      </div>
                                    )} */}
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
                                {witness && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Text: {witness.name || witness.id}
                                    {scriptLabel ? ` (${scriptLabel})` : ""}
                                    {token.coordinates_in_witness && (
                                      <span> • {token.coordinates_in_witness}</span>
                                    )}
                                    {token.pos && (
                                      <span> • POS: {token.pos}</span>
                                    )}
                                  </div>
                                )}
                                {tlaSentenceId && (
                                  <a
                                    href={`https://thesaurus-linguae-aegyptiae.de/sentence/${tlaSentenceId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 block text-xs text-blue-600 hover:underline"
                                  >
                                    See context in TLA.
                                  </a>
                                )}
                                {(() => {
                                  const tokenId = getTokenCommentId(token);
                                  if (!tokenId) return null;
                                  return (
                                    <a
                                      href={`https://thesaurus-linguae-aegyptiae.de/sentence/token/${tokenId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mt-1 block text-xs text-blue-600 hover:underline"
                                    >
                                      Sentence
                                    </a>
                                  );
                                })()}
                                {tokenClassifiers.length > 0 && (
                                  <div className="mt-1 text-xs text-gray-600">
                                    Classifiers:
                                    {tokenClassifiers.map((clf, clfIndex) => (
                                      <button
                                        key={`${token.id}-${clf}-${clfIndex}`}
                                        onClick={() => openClassifier(clf)}
                                        className="ml-2 text-blue-600 hover:text-blue-800"
                                      >
                                        <ClassifierLabel
                                          classifier={clf}
                                          meanings={mergedClassifierMeanings}
                                          displayLabel={getClassifierBaseLabel(clf)}
                                          className="text-blue-600"
                                          meaningClassName="text-blue-500/80"
                                          projectType={projectType}
                                          projectId={selectedProject}
                                        />
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>

              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Dictionary links:</CardTitle>
              </CardHeader>
              <CardContent>
                {dictionaryLoading && (
                  <p className="text-sm text-gray-500">Loading dictionary entry...</p>
                )}
                {!dictionaryLoading && (
                  <div className="space-y-2 text-sm text-gray-700">
                    {projectType === "hieroglyphic" && selectedLemmaId && selectedLemmaInfo?.transliteration && (
                      <p>
                        <span className="inline-flex items-center gap-2">
                          <span className="font-bold text-[1.5rem] text-white px-2.5 py-1 bg-[#b02a37]">
                            TLA
                          </span>
                          <span className="font-medium"> Thesaurus Lingua Aegyptia lemma entry </span>
                        </span>{" "}
                        <a
                          href={`https://thesaurus-linguae-aegyptiae.de/lemma/${selectedLemmaId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          <em className="italic">{selectedLemmaInfo.transliteration}</em>
                        </a>
                      </p>
                    )}
                    {dictionaryEntry && (
                      <>
                    {dictionaryEntry.tla_id && (
                      <p>
                        <span className="font-medium">TLA ID:</span> {dictionaryEntry.tla_id}
                      </p>
                    )}
                    {dictionaryEntry.transliteration && (
                      <p>
                        <span className="font-medium">Transliteration:</span>{" "}
                        <em className="italic">{dictionaryEntry.transliteration}</em>
                      </p>
                    )}
                    {dictionaryEntry.meaning && (
                      <p>
                        <span className="font-medium">Meaning:</span> {dictionaryEntry.meaning}
                      </p>
                    )}
                      </>
                    )}
                  </div>
                )}
                {!dictionaryLoading && !hasDictionaryLink && (
                  <p className="text-sm text-gray-500">
                    No dictionary entry found for this lemma.
                  </p>
                )}
              </CardContent>
            </Card>
            <Citation
              type="lemma"
              projectName={selectedProjectInfo?.name || "Unknown"}
              authors={selectedProjectInfo?.authors || "Unknown"}
              projectId={selectedProject}
              lemmaInfo={{
                transliteration: selectedLemmaInfo.transliteration,
                meaning: selectedLemmaInfo.meaning,
                id: selectedLemmaId
              }}
            />
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-300 flex justify-center gap-3">
          <ReportActions
            reportId="lemma-report-content"
            reportType="lemma"
            projectId={selectedProject || ""}
            lemmaId={selectedLemmaId || undefined}
          />
        </div>
        </div>
      )}
    </SidebarLayout>
  );

}
