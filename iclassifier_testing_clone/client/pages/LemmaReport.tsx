import { useState, useMemo, useEffect, memo, useCallback, useRef } from "react";
import WitnessSelector from "@/components/filters/WitnessSelector";
import ScriptSelector from "@/components/filters/ScriptSelector";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { Search as SearchIcon, BarChart3, Network as NetworkIcon } from "lucide-react";
import SidebarLayout from "@/components/SidebarLayout";
import { useLemmaSummaries, useWitnesses, useClassifierMeanings, useTokensByLemma, useTokensByIds } from "@/lib/api";
import { projects, clfTypeArr, clfLevelArr } from "@/lib/sampleData";
import { useCurrentProjectId } from "@/lib/projectContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  extractClassifiersFromString,
  colourClassifiers,
  createLemmaNetwork,
  getLegacyMapOptions
} from "@/lib/networkUtils";
import NotFound from "@/pages/NotFound";
import { fetchJseshBase64, getJseshImageUrl } from "@/lib/jsesh";
import { fetchDictionaryEntry, DictionaryEntry } from "@/lib/dictionary";
import { getThesaurusLabel } from "@/lib/thesauri";
import { downloadNetworkDataWorkbook, downloadNetworkPNG, downloadNetworkSVG } from "@/lib/networkExport";
import Citation from "@/components/Citation";
import ReportActions from "@/components/ReportActions";
import NetworkLoader from "@/components/NetworkLoader";
import ClassifierLabel from "@/components/ClassifierLabel";
import { mdc2uni } from "@/lib/mdc2uni";

// Dynamically import vis-network for client-side rendering
let VisNetwork: any = null;
let VisDataSet: any = null;

const API_BASE = import.meta.env.VITE_API_URL || "/api";

// Memoized lemma option component to prevent re-renders
const LemmaOption = memo(({ id, count, lemma }: any) => (
  <option value={id}>
    {count}: {lemma?.transliteration || "?"} ({lemma?.meaning || "?"})
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
    fetchJseshBase64(mdc, 44, true)
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
}

export default function LemmaReport() {
  const navigate = useNavigate();
  const { projectId: urlProjectId, lemmaId: urlLemmaId } = useParams();
  const [searchParams] = useSearchParams();
  const currentProjectId = useCurrentProjectId();
  
  // Get project ID from URL params
  const selectedProjectId = urlProjectId || currentProjectId;
  const lemmaIdFromUrl = urlLemmaId ? parseInt(urlLemmaId) : (searchParams.get("lemmaId") ? parseInt(searchParams.get("lemmaId")!) : null);

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
  
  // State management - reset when project changes
  const [selectedLemmaId, setSelectedLemmaId] = useState<number | null>(lemmaIdFromUrl);
  const [lemmaSearchQuery, setLemmaSearchQuery] = useState("");
  const [dictionaryEntry, setDictionaryEntry] = useState<DictionaryEntry | null>(null);
  const [dictionaryLoading, setDictionaryLoading] = useState(false);

  // Token display settings
  const [tokenDisplayType, setTokenDisplayType] = useState<TokenDisplayType>("all");

  // Filter states
  const [selectedWitnesses, setSelectedWitnesses] = useState<Set<string>>(new Set());
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set());
  
  // Classifier filtering
  const [clfType, setClfType] = useState("any");
  const [clfLevel, setClfLevel] = useState("any");

  // Reset filters when project changes
  useEffect(() => {
    setSelectedWitnesses(new Set());
    setSelectedScripts(new Set());
    setClfType("any");
    setClfLevel("any");
    setLemmaSearchQuery("");
    setSelectedLemmaId(null);
    setDictionaryEntry(null);
    defaultLemmaSetRef.current = false;
  }, [selectedProject]);

  useEffect(() => {
    if (lemmaIdFromUrl && lemmaIdFromUrl !== selectedLemmaId) {
      setSelectedLemmaId(lemmaIdFromUrl);
    }
  }, [lemmaIdFromUrl, selectedLemmaId]);

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
  const [outerCompoundClfDict, setOuterCompoundClfDict] = useState<ClassifierStats>({});
  const [extraLemmaMap, setExtraLemmaMap] = useState<Record<number, { id: number; transliteration: string; meaning: string; token_count?: number }>>({});
  const [isLemmaNetworkLoading, setIsLemmaNetworkLoading] = useState(false);

  // Network graph
  const networkRef = useRef<HTMLDivElement>(null);
  const networkInstanceRef = useRef<any>(null);
  const [visReady, setVisReady] = useState(false);
  const [useUnicode, setUseUnicode] = useState(true);
  const defaultLemmaSetRef = useRef(false);
  const networkTokenRef = useRef(0);
  const [lemmaNetworkData, setLemmaNetworkData] = useState<{ nodes: any[]; edges: any[] }>({
    nodes: [],
    edges: []
  });

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
  useEffect(() => {
    if (selectedProject) {
      const basePath = `/project/${selectedProject}/lemma`;
      const currentPath = window.location.pathname;
      const targetPath = selectedLemmaId ? `${basePath}/${selectedLemmaId}` : basePath;
      
      if (currentPath !== targetPath) {
        navigate(targetPath, { replace: true });
      }
    }
  }, [selectedProject, selectedLemmaId, navigate]);

  const { data: lemmaSummary, loading: lemmaSummaryLoading, error: lemmaSummaryError } = useLemmaSummaries(selectedProject);
  const { data: witnessData, loading: witnessLoading, error: witnessError } = useWitnesses(selectedProject);
  const { data: classifierMeanings, loading: meaningsLoading, error: meaningsError } = useClassifierMeanings(selectedProject);

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
    return lemmasWithCounts.filter(([id]) => {
      const lemma = lemmaData[id];
      if (!lemma) return false;
      const query = lemmaSearchQuery.toLowerCase();
      
      // Search across all lemma fields
      return Object.values(lemma).some(value => {
        if (value == null) return false;
        return String(value).toLowerCase().includes(query);
      });
    });
  }, [lemmaSearchQuery, lemmasWithCounts, lemmaData]);

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
    return colourClassifiers(mdc_w_markup);
  }, []);

  // Get tokens for selected lemma with filtering
  const tokensForLemma = useMemo(() => {
    if (!selectedLemmaId) return [];
    return [...lemmaTokensResponse.items].sort((a, b) => a.id - b.id);
  }, [selectedLemmaId, lemmaTokensResponse.items]);

  const compoundTokenIds = useMemo(() => {
    if (tokenDisplayType !== "compound-part") return [];
    const ids = new Set<number>();
    tokensForLemma.forEach((token) => {
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
      setOuterCompoundClfDict({});
      return;
    }

    const newClfDict: ClassifierStats = {};
    const newComDict: ClassifierStats = {};
    const newScrDict: ClassifierStats = {};
    const newOuterCompoundClfDict: ClassifierStats = {};
    
    tokensForLemma.forEach((token: any) => {
      const clfs = extractClfsFromString(token.mdc_w_markup);
      
      // Individual classifier counts
      clfs.forEach(clf => {
        newClfDict[clf] = (newClfDict[clf] || 0) + 1;
      });
      
      // Classifier combinations
      if (clfs.length > 0) {
        const combination = clfs.join('+');
        newComDict[combination] = (newComDict[combination] || 0) + 1;
      }
      
      // Script statistics
      const witness = witnessData[token.witness_id];
      if (witness?.script) {
        const scriptLabel = getThesaurusLabel(projectType, "scripts", witness.script);
        newScrDict[scriptLabel] = (newScrDict[scriptLabel] || 0) + 1;
      }

      if (tokenDisplayType === "compound-part" && token.compound_id) {
        const compoundToken = compoundTokenMap[token.compound_id];
        if (compoundToken) {
          const compoundClfs = extractClfsFromString(compoundToken.mdc_w_markup);
          compoundClfs.forEach((clf) => {
            newOuterCompoundClfDict[clf] = (newOuterCompoundClfDict[clf] || 0) + 1;
          });
        }
      }
    });
    
    setClfDict(newClfDict);
    setComDict(newComDict);
    setScrDict(newScrDict);
    setOuterCompoundClfDict(newOuterCompoundClfDict);
  }, [selectedLemmaId, tokensForLemma, extractClfsFromString, witnessData, compoundTokenMap, tokenDisplayType, projectType]);

  // Handle project change
  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    setSelectedLemmaId(null); // Reset lemma selection
    setSelectedWitnesses(new Set());
    setSelectedScripts(new Set());
  };

  // Handle lemma selection
  const handleLemmaSelect = (lemmaId: number) => {
    setSelectedLemmaId(lemmaId);
    if (selectedProject) {
      navigate(`/project/${selectedProject}/lemma/${lemmaId}`);
    }
  };

  const selectedLemmaInfo = selectedLemmaId ? lemmaData[selectedLemmaId] : null;

  const getClassifierBaseLabel = useCallback((classifier: string) => {
    if (projectType !== "hieroglyphic") return classifier;
    const glyph = mdc2uni[classifier] || classifier;
    return `${glyph} (${classifier})`;
  }, [projectType]);

  const renderClassifierCombo = useCallback((combo: string) => {
    return combo.split("+").map((classifier, index) => (
      <span key={`${combo}-${classifier}-${index}`} className="inline-flex items-baseline">
        {index > 0 && <span className="mx-1 text-gray-400">+</span>}
        <ClassifierLabel
          classifier={classifier}
          meanings={classifierMeanings}
          displayLabel={getClassifierBaseLabel(classifier)}
        />
      </span>
    ));
  }, [classifierMeanings, getClassifierBaseLabel]);

  // Create network graph
  const createNetworkGraph = useCallback(() => {
    if (!visReady || !networkRef.current || !VisNetwork || !VisDataSet || !selectedLemmaId || !selectedLemmaInfo) return;
    if (lemmaTokensLoading) return;
    setIsLemmaNetworkLoading(true);

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
        lemmaFontFace:
          projectType === "cuneiform"
            ? "cuneiform"
            : projectType === "chinese"
              ? "Noto Sans TC"
              : "Roboto",
        classifierFontFace:
          projectType === "cuneiform"
            ? "cuneiform"
            : projectType === "chinese"
              ? "Noto Sans TC"
              : "hierofont",
        classifierMeanings
      }
    );

    if (networkData.nodes.length === 0) {
      setIsLemmaNetworkLoading(false);
      return;
    }
    setLemmaNetworkData({ nodes: networkData.nodes, edges: networkData.edges });

    // Create network
    const visNetworkData = {
      nodes: new VisDataSet(networkData.nodes),
      edges: new VisDataSet(networkData.edges)
    };

    const options = {
      ...getLegacyMapOptions(),
      nodes: { size: 40 },
      edges: { smooth: false },
      physics: { enabled: true, stabilization: { iterations: 60 } }
    };
    const network = new VisNetwork(networkRef.current, visNetworkData, options);
    networkInstanceRef.current = network;
    let finalized = false;
    const finalize = () => {
      if (finalized) return;
      finalized = true;
      window.clearTimeout(fallbackId);
      network.fit();
      network.setOptions({ physics: { enabled: false } });
      if (typeof network.stopSimulation === "function") {
        network.stopSimulation();
      }
      setIsLemmaNetworkLoading(false);
    };
    const fallbackId = window.setTimeout(() => finalize(), 2000);
    network.once("stabilizationIterationsDone", finalize);

    if (selectedProjectInfo?.type === "hieroglyphic") {
      const classifierNodes = networkData.nodes.filter((node) => node.type === "classifier");
      Promise.all(
        classifierNodes.map(async (node) => {
          const mdc = node.mdc || node.label;
          const hasUnicodeGlyph = typeof mdc === "string" && (mdc.codePointAt(0) || 0) >= 256;
          if (useUnicode && (node.label !== node.mdc || hasUnicodeGlyph)) return;
          const base64 = await fetchJseshBase64(mdc, 50, true);
          if (!base64) return;
          if (networkTokenRef.current !== renderToken) return;
          visNetworkData.nodes.update({
            id: node.id,
            shape: "image",
            image: getJseshImageUrl(base64),
            size: 10,
            color: { background: "#b0c0ff", border: "#b0c0ff" },
            shapeProperties: { useBorderWithImage: true, interpolation: true }
          });
        })
      ).then(() => finalize()).catch(() => undefined);
    }
    setTimeout(() => {
      if (networkTokenRef.current !== renderToken) return;
      finalize();
    }, 2000);

    // Handle node clicks
    network.on('click', (params: any) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        if (nodeId.startsWith('classifier_')) {
          const classifier = nodeId.replace('classifier_', '');
          navigate(`/project/${selectedProject}/classifier/${encodeURIComponent(classifier)}`);
        } else if (nodeId.startsWith('related_lemma_')) {
          const lemmaId = nodeId.replace('related_lemma_', '');
          navigate(`/project/${selectedProject}/lemma/${lemmaId}`);
        }
      }
    });
  }, [visReady, selectedLemmaId, selectedLemmaInfo, clfDict, lemmaData, navigate, selectedProject, selectedProjectInfo, useUnicode, projectType]);

  // Create network graph when data changes
  useEffect(() => {
    if (selectedLemmaId && Object.keys(clfDict).length > 0) {
      const timer = setTimeout(() => {
        createNetworkGraph();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [visReady, selectedLemmaId, clfDict, createNetworkGraph, useUnicode, lemmaTokensLoading]);

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
        <div className="text-center py-12">
          <p className="text-red-600">Error loading data: {error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
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
            <div className="text-red-600 mb-4">⚠ Error loading project data</div>
            <p className="text-gray-600">
              {error}
            </p>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline" 
              className="mt-4"
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Show main content when data is available */}
      {!loading && !error && (
      <div className="max-w-6xl mx-auto w-full space-y-4" id="lemma-report-content">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
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
                  Analyze lemma usage and classifier patterns
                  {selectedProjectInfo && (
                    <span className="ml-2">
                      • <Badge variant="secondary">{selectedProjectInfo.name}</Badge>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/project/${selectedProject}/classifier`)}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Classifier Report
            </Button>
            <Button
              variant="outline"
              onClick={() => scrollToSection("lemma-selection")}
            >
              Select lemma
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/project/${selectedProject}/map-report`)}
            >
              <NetworkIcon className="w-4 h-4 mr-2" />
              Network Map
            </Button>
          </div>
        </div>

        {/* Report Content */}
        {selectedLemmaId && selectedLemmaInfo && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {/* hh: later can decide if put italics to other scripts */}
                  Lemma: <em className="italic">{selectedLemmaInfo.transliteration}</em> ({selectedLemmaInfo.meaning})
                </CardTitle>
                <p className="text-sm text-gray-600">
                  {tokensForLemma.length} token{tokensForLemma.length !== 1 ? 's' : ''} found
                  {tokenDisplayType !== 'all' && ` (${tokenDisplayType} only)`}
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
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

                <div id="lemma-network" className="scroll-mt-24 space-y-4">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <NetworkIcon className="w-4 h-4" />
                          Lemma Classification network
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="relative h-[420px] min-h-[360px]">
                          <div
                            ref={networkRef}
                            className="w-full h-full border border-gray-200 rounded-lg bg-white"
                            style={{
                              position: "relative",
                              touchAction: "none",
                              userSelect: "none",
                              WebkitUserDrag: "none",
                              WebkitTapHighlightColor: "rgba(0, 0, 0, 0)"
                            }}
                          />
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
                            onClick={() => goFullScreen(networkRef.current)}
                          >
                            Go fullscreen
                          </Button>
                          {projectType === "hieroglyphic" && (
                            <label className="inline-flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={useUnicode}
                                onChange={() => setUseUnicode(!useUnicode)}
                              />
                              Use Unicode glyphs for hieroglyphs when available
                            </label>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadNetworkPNG(networkInstanceRef.current, 96, `lemma-network-96dpi.png`)}
                          >
                            PNG 96
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadNetworkPNG(networkInstanceRef.current, 300, `lemma-network-300dpi.png`)}
                          >
                            PNG 300
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadNetworkSVG(networkInstanceRef.current, `lemma-network.svg`)}
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

                    <Card id="lemma-statistics">
                      <CardHeader>
                        <CardTitle className="text-base">Classifier combinations with this lemma</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {sortedComStats.length > 0 ? (
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
                                  <TableCell className="text-xs px-2 py-2">
                                    {renderClassifierCombo(com)}
                                  </TableCell>
                                  <TableCell className="text-right px-2 py-2">{count}</TableCell>
                                </TableRow>
                              ))}
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
                          {sortedClfStats.length > 0 ? (
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
                                      <ClassifierLabel
                                        classifier={clf}
                                        meanings={classifierMeanings}
                                        displayLabel={getClassifierBaseLabel(clf)}
                                      />
                                    </TableCell>
                                    <TableCell className="text-right px-2 py-2">{count}</TableCell>
                                  </TableRow>
                                ))}
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
                              <Table className="w-fit">
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="h-9 px-2">Classifier</TableHead>
                                    <TableHead className="text-right h-9 px-2">Count</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sortedOuterCompoundClfStats.map(([clf, count]) => (
                                    <TableRow key={clf}>
                                      <TableCell className="px-2 py-2">
                                        <ClassifierLabel
                                          classifier={clf}
                                          meanings={classifierMeanings}
                                          displayLabel={getClassifierBaseLabel(clf)}
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
                          ) : (
                            <p className="text-gray-500 text-sm">No script data found</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div id="lemma-tokens" className="scroll-mt-24">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">
                        All Tokens for <em className="italic">{selectedLemmaInfo.transliteration}</em> ({selectedLemmaInfo.meaning})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-96 overflow-auto">
                        <ul className="space-y-2">
                          {tokensForLemma.map((token: any) => {
                            const coloredMarkup = colorClassifiers(token.mdc_w_markup);
                            const witness = witnessData[token.witness_id];
                            const tokenClassifiers = extractClfsFromString(token.mdc_w_markup);
                            const scriptLabel = witness?.script
                              ? getThesaurusLabel(projectType, "scripts", witness.script)
                              : "";
                            const tlaSentenceId = getTlaSentenceId(token);
                            const unicodeMdc = projectType === "hieroglyphic"
                              ? mdcToUnicode(token.mdc || token.mdc_w_markup || "")
                              : "";
                            const tokenMdc = token.mdc || token.mdc_w_markup || "";
                            
                            return (
                              <li key={token.id} className="border-l-2 border-gray-200 pl-3">
                                {projectType === "hieroglyphic" ? (
                                  <div className="space-y-1">
                                    <TokenGlyph mdc={tokenMdc} />
                                    {unicodeMdc && (
                                      <div className="egyptian-unicode text-lg text-gray-800 font-medium">
                                        {unicodeMdc}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div 
                                    className="font-mono text-sm"
                                    dangerouslySetInnerHTML={{ __html: coloredMarkup || token.mdc }}
                                  />
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
                                {tokenClassifiers.length > 0 && (
                                  <div className="mt-1 text-xs text-gray-600">
                                    Classifiers:
                                    {tokenClassifiers.map((clf) => (
                                      <button
                                        key={`${token.id}-${clf}`}
                                        onClick={() => navigate(`/project/${selectedProject}/classifier/${encodeURIComponent(clf)}`)}
                                        className="ml-2 text-blue-600 hover:text-blue-800"
                                      >
                                        <ClassifierLabel
                                          classifier={clf}
                                          meanings={classifierMeanings}
                                          displayLabel={getClassifierBaseLabel(clf)}
                                          className="text-blue-600"
                                          meaningClassName="text-blue-500/80"
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
                <CardTitle className="text-sm">Egyptian Dictionary (TLA)</CardTitle>
              </CardHeader>
              <CardContent>
                {dictionaryLoading && (
                  <p className="text-sm text-gray-500">Loading dictionary entry...</p>
                )}
                {!dictionaryLoading && (
                  <div className="space-y-2 text-sm text-gray-700">
                    {projectType === "hieroglyphic" && selectedLemmaId && selectedLemmaInfo?.transliteration && (
                      <p>
                        <span className="font-medium">Egyptian Dictionary (TLA):</span>{" "}
                        <a
                          href={`https://thesaurus-linguae-aegyptiae.de/lemma/${selectedLemmaId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-600 hover:underline"
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
                {!dictionaryLoading && !dictionaryEntry && (
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

        {/* Lemma Selection */}
        <Card id="lemma-selection" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Select lemma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    <em className="italic">{lemmaData[selectedLemmaId]?.transliteration || "?"}</em> ({lemmaData[selectedLemmaId]?.meaning || "?"})
                  </span>
                  <button 
                    onClick={() => setSelectedLemmaId(null)}
                    className="ml-2 text-blue-600 hover:text-blue-800 underline text-sm"
                  >
                    Clear
                  </button>
                </div>
              )}
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
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
                      <span className="ml-2 text-gray-600">({lemma?.meaning || "?"})</span>
                      {hasClassifiers && (
                        <span className="ml-2 text-xs bg-teal-100 text-teal-800 px-1 rounded">📊</span>
                      )}
                    </button>
                  );
                })}
                {filteredLemmas.length === 0 && (
                  <div className="px-3 py-4 text-gray-500 text-center">
                    No lemmas found matching your search.
                  </div>
                )}
              </div>
            </div>

            <div>
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
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Text Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <WitnessSelector
                witnessData={witnessData}
                selectedWitnesses={selectedWitnesses}
                setSelectedWitnesses={setSelectedWitnesses}
                projectType={projectType}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Script Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <ScriptSelector
                witnessData={witnessData}
                selectedScripts={selectedScripts}
                setSelectedScripts={setSelectedScripts}
                projectType={projectType}
              />
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-300 flex justify-center gap-4">
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
