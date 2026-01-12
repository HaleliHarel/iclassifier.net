import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import SidebarLayout from "@/components/SidebarLayout";
import { useClassifierMeanings, useClassifierMetadata, useLemmas, useTokensByClassifier, useWitnesses } from "@/lib/api";
import { projects, clfTypeArr, clfLevelArr } from "@/lib/sampleData";
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
import {
  extractClassifiersFromString,
  colourClassifiers
} from "@/lib/networkUtils";
import NotFound from "@/pages/NotFound";
import { fetchJseshBase64, getJseshImageUrl } from "@/lib/jsesh";
import { getThesaurusLabel } from "@/lib/thesauri";
import { mdc2uni } from "@/lib/mdc2uni";
import { downloadNetworkDataWorkbook, downloadNetworkPNG, downloadNetworkSVG } from "@/lib/networkExport";
import Citation from "@/components/Citation";
import ReportActions from "@/components/ReportActions";
import NetworkLoader from "@/components/NetworkLoader";
import ClassifierLabel from "@/components/ClassifierLabel";
import { formatClassifierLabelText } from "@/lib/classifierLabel";

// Dynamically import vis-network for client-side rendering
let VisNetwork: any = null;
let VisDataSet: any = null;

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

interface ClassifierStats {
  [key: string]: number;
}

export default function ClassifierReport() {
  const navigate = useNavigate();
  const { projectId: urlProjectId, classifierId: urlClassifierId } = useParams();
  const [searchParams] = useSearchParams();
  const currentProjectId = useCurrentProjectId();
  
  // Get project ID from URL params
  const selectedProjectId = urlProjectId || currentProjectId;
  const classifierFromUrl = urlClassifierId || searchParams.get("classifier");

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
  
  // State management - reset when project changes
  const [selectedClassifier, setSelectedClassifier] = useState<string | null>(classifierFromUrl);
  const [classifierSearchQuery, setClassifierSearchQuery] = useState("");

  // Filter states
  const [selectedWitnesses, setSelectedWitnesses] = useState<Set<string>>(new Set());
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set());
  const [selectedPOS, setSelectedPOS] = useState<Set<string>>(new Set());
  const [appliedWitnesses, setAppliedWitnesses] = useState<Set<string>>(new Set());
  const [appliedScripts, setAppliedScripts] = useState<Set<string>>(new Set());
  const [appliedPOS, setAppliedPOS] = useState<Set<string>>(new Set());
  
  // Classifier filtering
  const [clfType, setClfType] = useState("any");
  const [clfLevel, setClfLevel] = useState("any");
  const [clfPosition, setClfPosition] = useState("any");

  const [lemmaMapMode, setLemmaMapMode] = useState<"counts" | "percentages">("counts");
  const [useUnicode, setUseUnicode] = useState(true);

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
  const clfNetworkRef = useRef<HTMLDivElement>(null);
  const lemmaNetworkInstance = useRef<any>(null);
  const clfNetworkInstance = useRef<any>(null);
  const [visReady, setVisReady] = useState(false);
  const [lemmaNetworkData, setLemmaNetworkData] = useState<{ nodes: any[]; edges: any[] }>({
    nodes: [],
    edges: []
  });
  const [clfNetworkData, setClfNetworkData] = useState<{ nodes: any[]; edges: any[] }>({
    nodes: [],
    edges: []
  });
  const defaultClassifierSetRef = useRef(false);

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
    setClfType("any");
    setClfLevel("any");
    setClfPosition("any");
    setLemmaMapMode("counts");
    setUseUnicode(true);
    setClassifierSearchQuery("");
    setSelectedClassifier(null);
    defaultClassifierSetRef.current = false;
  }, [selectedProject]);

  // Update URL when project or classifier changes
  useEffect(() => {
    if (selectedProject) {
      const basePath = `/project/${selectedProject}/classifier`;
      const currentPath = window.location.pathname;
      const targetPath = selectedClassifier ? `${basePath}/${encodeURIComponent(selectedClassifier)}` : basePath;
      
      if (currentPath !== targetPath) {
        navigate(targetPath, { replace: true });
      }
    }
  }, [selectedProject, selectedClassifier, navigate]);

  const { data: lemmaData, loading: lemmaLoading, error: lemmaError } = useLemmas(selectedProject);
  const { data: witnessData, loading: witnessLoading, error: witnessError } = useWitnesses(selectedProject);
  const { data: classifierData, loading: classifierLoading, error: classifierError } = useClassifierMetadata(selectedProject);
  const { data: classifierMeanings, loading: meaningsLoading, error: meaningsError } = useClassifierMeanings(selectedProject);

  const loading = lemmaLoading || witnessLoading || classifierLoading || meaningsLoading;
  const error = lemmaError || witnessError || classifierError || meaningsError;

  const classifierMetaByToken = useMemo(() => {
    const index: Record<number, Record<string, any>> = {};
    classifierData.forEach((meta: any) => {
      const tokenId = Number(meta.token_id);
      if (!Number.isFinite(tokenId)) return;
      if (!index[tokenId]) {
        index[tokenId] = {};
      }
      const classifierKey = meta.gardiner_number || meta.clf || meta.classifier || meta.mdc;
      if (!classifierKey) return;
      if (!index[tokenId][classifierKey]) {
        index[tokenId][classifierKey] = meta;
      }
    });
    return index;
  }, [classifierData]);

  const getTokenClassifiers = useCallback((token: any) => {
    const meta = classifierMetaByToken[token.id];
    if (meta && Object.keys(meta).length > 0) {
      return Object.keys(meta);
    }
    return extractClassifiersFromString(token.mdc_w_markup);
  }, [classifierMetaByToken]);

  const classifierSummary = useMemo(() => {
    const summary: Record<string, { type?: string; level?: number; position?: string }> = {};
    classifierData.forEach((meta: any) => {
      const key = meta.gardiner_number || meta.clf || meta.classifier || meta.mdc;
      if (!key || summary[key]) return;
      const parsedLevel = parseInt(String(meta.clf_level), 10);
      summary[key] = {
        type: meta.clf_type,
        level: Number.isFinite(parsedLevel) ? parsedLevel : undefined,
        position: meta.clf_position
      };
    });
    return summary;
  }, [classifierData]);

  const projectType = selectedProjectInfo?.type || "hieroglyphic";

  const getClassifierDisplay = useCallback((mdc: string) => {
    if (projectType !== "hieroglyphic") return mdc;
    if (!useUnicode) return mdc;
    return mdc2uni[mdc] || mdc;
  }, [projectType, useUnicode]);

  const getClassifierBaseLabel = useCallback((mdc: string) => {
    if (projectType !== "hieroglyphic") return mdc;
    const glyph = getClassifierDisplay(mdc);
    return `${glyph} (${mdc})`;
  }, [projectType, getClassifierDisplay]);

  if (!selectedProjectInfo && !loading) {
    return <NotFound />;
  }

  // Get all classifiers from metadata
  const allClassifiers = useMemo(() => {
    const classifierSet = new Set<string>();
    classifierData.forEach((meta: any) => {
      const key = meta?.gardiner_number || meta?.clf || meta?.classifier || meta?.mdc;
      if (key) {
        classifierSet.add(String(key));
      }
    });
    return Array.from(classifierSet).sort();
  }, [classifierData]);

  const classifierCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    classifierData.forEach((meta: any) => {
      const key = meta?.gardiner_number || meta?.clf || meta?.classifier || meta?.mdc;
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [classifierData]);

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
  const filteredClassifiers = useMemo(() => {
    if (!classifierSearchQuery) return allClassifiers;
    const query = classifierSearchQuery.toLowerCase();
    return allClassifiers.filter(clf => 
      clf.toLowerCase().includes(query) ||
      (classifierSummary[clf]?.type && classifierSummary[clf]?.type?.toLowerCase().includes(query))
    );
  }, [classifierSearchQuery, allClassifiers, classifierSummary]);

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
      if (clfType !== "any" || clfLevel !== "any") {
        const clfInfo = classifierMetaByToken[token.id]?.[selectedClassifier];
        if (!clfInfo) return false;
        if (clfType !== "any") {
          const types = String(clfInfo.clf_type || "").split(";").map((entry: string) => entry.trim());
          if (!types.includes(clfType)) return false;
        }
        if (clfLevel !== "any") {
          const parsedLevel = parseInt(String(clfInfo.clf_level), 10);
          if (!Number.isFinite(parsedLevel) || parsedLevel !== parseInt(clfLevel, 10)) return false;
        }
      }

      if (clfPosition !== "any") {
        const position = getClassifierPosition(selectedClassifier, token.mdc_w_markup || "");
        if (position !== clfPosition) return false;
      }
      
      return true;
    });
    
    return tokens.sort((a, b) => a.id - b.id);
  }, [selectedClassifier, tokensFilteredByMeta, classifierMetaByToken, clfType, clfLevel, clfPosition, getTokenClassifiers]);

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

    const newLemmaDict: ClassifierStats = {};
    const newLemmaTotals: ClassifierStats = {};
    const newLemmaPercent: Record<string, [number, string]> = {};
    const newLemmaMeanings: Record<string, string> = {};
    const newComDict: ClassifierStats = {};
    const newClfDict: ClassifierStats = {};
    const newScrDict: ClassifierStats = {};
    const newPosDict: ClassifierStats = {};
    const newOrdDict: ClassifierStats = {};

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
          if (clfType === "any" && clfLevel === "any") return true;
          const clfInfo = classifierMetaByToken[token.id]?.[clf];
          if (!clfInfo) return false;
          if (clfType !== "any") {
            const types = String(clfInfo.clf_type || "").split(";").map((entry: string) => entry.trim());
            if (!types.includes(clfType)) return false;
          }
          if (clfLevel !== "any") {
            const parsedLevel = parseInt(String(clfInfo.clf_level), 10);
            if (!Number.isFinite(parsedLevel) || parsedLevel !== parseInt(clfLevel, 10)) return false;
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
      const total = newLemmaTotals[lemmaKey];
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
  }, [
    selectedClassifier,
    tokensForClassifier,
    tokensFilteredByMeta,
    lemmaData,
    witnessData,
    clfType,
    clfLevel,
    classifierMetaByToken,
    getTokenClassifiers,
    projectType
  ]);

  const createLemmaNetwork = useCallback(() => {
    if (!visReady || !lemmaNetworkRef.current || !VisNetwork || !VisDataSet || !selectedClassifier) return;

    if (lemmaNetworkInstance.current) {
      lemmaNetworkInstance.current.destroy();
    }

    const nodes = new VisDataSet();
    const edges = new VisDataSet();
    const lemmaFont = projectType === "cuneiform"
      ? "cuneiform"
      : projectType === "chinese"
        ? "Noto Sans TC"
        : "Roboto";
    const classifierFont = projectType === "hieroglyphic" ? "hierofont" : lemmaFont;

    const baseLabel = getClassifierBaseLabel(selectedClassifier);
    const centerLabel = formatClassifierLabelText(selectedClassifier, classifierMeanings, baseLabel);
    const centerNodeId = "center";
    nodes.add({
      id: centerNodeId,
      label: centerLabel,
      mdc: selectedClassifier,
      color: { background: "beige", border: "beige" },
      font: { face: classifierFont, size: 32 },
      size: 20,
      shape: "circle",
    });

    let finalize = () => {};
    const shouldUseImage = projectType === "hieroglyphic" && (!useUnicode || !mdc2uni[selectedClassifier]);
    if (shouldUseImage) {
      fetchJseshBase64(selectedClassifier, 50, true)
        .then((base64) => {
          if (!base64) return;
          nodes.update({
            id: centerNodeId,
            shape: "image",
            image: getJseshImageUrl(base64),
            size: 20,
            color: { background: "beige", border: "beige" },
            shapeProperties: { useBorderWithImage: true, interpolation: true },
          });
          finalize();
        })
        .catch(() => undefined);
    }

    const currentDict = lemmaMapMode === "counts" ? lemmaDict : lemmaPercentDict;
    let idCounter = 2;
    Object.entries(currentDict).forEach(([lemmaLabel, value]) => {
      const lemmaId = lemmaLabelToId.get(lemmaLabel);
      const nodeId = lemmaId ? `lemma_${lemmaId}` : `lemma_${idCounter}`;
      const { base, meaning } = splitLemmaLabel(lemmaLabel);
      const label = meaning ? `${base}\n(${meaning})` : base;
      const percentage = Array.isArray(value) ? value[0] : null;
      const edgeWidth = lemmaMapMode === "counts"
        ? (value as number)
        : Math.max((percentage || 0) / 20, 1);

      nodes.add({
        id: nodeId,
        label,
        shape: "dot",
        size: 20,
        color: lemmaMapMode === "counts"
          ? "rgba(0, 255, 0, 0.4)"
          : getHueByPercentage(percentage || 0),
        font: { multi: true, face: lemmaFont, size: 12 },
      });

      edges.add({
        from: centerNodeId,
        to: nodeId,
        color: { color: lemmaMapMode === "counts" ? "lightgray" : "rgb(91, 154, 160)" },
        width: edgeWidth,
      });
      idCounter += 1;
    });

    const options = {
      nodes: {
        size: 30,
      },
      physics: {
        barnesHut: {
          springConstant: 0.05,
          avoidOverlap: 0.45,
        },
        stabilization: { iterations: 60 }
      },
    };

    const network = new VisNetwork(lemmaNetworkRef.current, { nodes, edges }, options);
    lemmaNetworkInstance.current = network;
    setLemmaNetworkData({ nodes: nodes.get(), edges: edges.get() });
    let finalized = false;
    finalize = () => {
      if (finalized) return;
      finalized = true;
      window.clearTimeout(fallbackId);
      network.setOptions({ physics: false });
      if (typeof network.stopSimulation === "function") {
        network.stopSimulation();
      }
    };
    const fallbackId = window.setTimeout(() => finalize(), 2000);
    network.once("stabilizationIterationsDone", finalize);

    network.on("click", (params: any) => {
      if (params.nodes.length > 0) {
        const nodeId = String(params.nodes[0]);
        if (nodeId.startsWith("lemma_")) {
          const lemmaId = nodeId.replace("lemma_", "");
          navigate(`/project/${selectedProject}/lemma/${lemmaId}`);
        }
      }
    });
  }, [
    selectedClassifier,
    lemmaDict,
    lemmaPercentDict,
    lemmaMapMode,
    lemmaLabelToId,
    projectType,
    useUnicode,
    getClassifierDisplay,
    getClassifierBaseLabel,
    navigate,
    selectedProject,
    classifierMeanings,
    visReady,
  ]);

  const createClfNetwork = useCallback(() => {
    if (!visReady || !clfNetworkRef.current || !VisNetwork || !VisDataSet || !selectedClassifier) return;

    if (clfNetworkInstance.current) {
      clfNetworkInstance.current.destroy();
    }

    let finalize = () => {};
    const nodes = new VisDataSet();
    const edges = new VisDataSet();
    const lemmaFont = projectType === "cuneiform"
      ? "cuneiform"
      : projectType === "chinese"
        ? "Noto Sans TC"
        : "Roboto";
    const classifierFont = projectType === "hieroglyphic" ? "hierofont" : lemmaFont;

    const baseLabel = getClassifierBaseLabel(selectedClassifier);
    const centerLabel = formatClassifierLabelText(selectedClassifier, classifierMeanings, baseLabel);
    const centerNodeId = "center";
    nodes.add({
      id: centerNodeId,
      label: centerLabel,
      color: { background: "beige", border: "beige" },
      font: { face: classifierFont, size: 32 },
      size: 20,
      shape: "box",
      shapeProperties: { borderRadius: 0 },
    });

    const shouldUseImage = projectType === "hieroglyphic" && (!useUnicode || !mdc2uni[selectedClassifier]);
    if (shouldUseImage) {
      fetchJseshBase64(selectedClassifier, 50, true)
        .then((base64) => {
          if (!base64) return;
          nodes.update({
            id: centerNodeId,
            shape: "image",
            image: getJseshImageUrl(base64),
            size: 20,
            color: { background: "beige", border: "beige" },
            shapeProperties: { useBorderWithImage: true, interpolation: true },
          });
        })
        .catch(() => undefined);
    }

    let idCounter = 2;
    Object.entries(clfDict).forEach(([clf, count]) => {
      const display = getClassifierBaseLabel(clf);
      const label = formatClassifierLabelText(clf, classifierMeanings, display);
      const nodeId = `clf_${idCounter}`;
      nodes.add({
        id: nodeId,
        label,
        mdc: clf,
        color: { background: "beige", border: "beige" },
        font: { face: classifierFont, size: 20 },
        size: 10,
        shape: "box",
        shapeProperties: { borderRadius: 0 },
      });

      edges.add({
        from: centerNodeId,
        to: nodeId,
        width: count,
        length: 5.0 / Math.max(count, 1),
        color: { color: "#b0c0ff" },
      });

      if (projectType === "hieroglyphic" && (!useUnicode || !mdc2uni[clf])) {
        fetchJseshBase64(clf, 50, true)
          .then((base64) => {
            if (!base64) return;
            nodes.update({
              id: nodeId,
              shape: "image",
              image: getJseshImageUrl(base64),
              size: 20,
              color: { background: "beige", border: "beige" },
              shapeProperties: { useBorderWithImage: true, interpolation: true },
            });
            finalize();
          })
          .catch(() => undefined);
      }

      idCounter += 1;
    });

    const options = {
      nodes: {
        size: 40,
        shape: "box",
        shapeProperties: { borderRadius: 0 },
      },
      interaction: {
        hover: true,
      },
    };

    const network = new VisNetwork(clfNetworkRef.current, { nodes, edges }, options);
    clfNetworkInstance.current = network;
    setClfNetworkData({ nodes: nodes.get(), edges: edges.get() });
    let finalized = false;
    finalize = () => {
      if (finalized) return;
      finalized = true;
      window.clearTimeout(fallbackId);
      network.setOptions({ physics: false });
      if (typeof network.stopSimulation === "function") {
        network.stopSimulation();
      }
    };
    const fallbackId = window.setTimeout(() => finalize(), 2000);
    network.once("stabilizationIterationsDone", finalize);

    network.on("click", (params: any) => {
      if (params.nodes.length > 0) {
        const nodeId = String(params.nodes[0]);
        if (nodeId === centerNodeId) return;
        const nodeData = nodes.get(nodeId);
        const mdc = nodeData?.mdc || nodeData?.label;
        if (!mdc) return;
        navigate(`/project/${selectedProject}/classifier/${encodeURIComponent(String(mdc))}`);
      }
    });
  }, [
    selectedClassifier,
    clfDict,
    projectType,
    useUnicode,
    getClassifierDisplay,
    getClassifierBaseLabel,
    navigate,
    selectedProject,
    classifierMeanings,
    visReady,
  ]);

  useEffect(() => {
    if (!selectedClassifier) return;
    const timer = setTimeout(() => {
      createLemmaNetwork();
    }, 100);
    return () => clearTimeout(timer);
  }, [visReady, selectedClassifier, lemmaDict, lemmaPercentDict, lemmaMapMode, useUnicode, createLemmaNetwork]);

  useEffect(() => {
    if (!selectedClassifier) return;
    const timer = setTimeout(() => {
      createClfNetwork();
    }, 100);
    return () => clearTimeout(timer);
  }, [visReady, selectedClassifier, clfDict, useUnicode, createClfNetwork]);

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

  // Handle classifier selection
  const handleClassifierSelect = (classifier: string) => {
    setSelectedClassifier(classifier);
    if (selectedProject) {
      navigate(`/project/${selectedProject}/classifier/${encodeURIComponent(classifier)}`);
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
      <div className="max-w-6xl mx-auto w-full space-y-4" id="classifier-report-content">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
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
        </div>

        <Card id="classifier-filters">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <img src="/favicon-32x32.png" alt="iClassifier logo" className="w-8 h-8" />
              <div>
                <h2 className="text-lg font-semibold">On this page</h2>
                <div className="text-sm text-gray-600">Jump to sections</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <a href="#classifier-overview" className="text-blue-600 hover:underline">Classifier overview</a>
              <a href="#lemma-cooccurrence" className="text-blue-600 hover:underline">Lemma co-occurrence graph</a>
              <a href="#lemma-classification-network" className="text-blue-600 hover:underline">Lemma classification network</a>
              <a href="#classifier-tokens" className="text-blue-600 hover:underline">Tokens</a>
              <a href="#classifier-statistics" className="text-blue-600 hover:underline">Statistics</a>
              <a href="#classifier-filters" className="text-blue-600 hover:underline">Filters</a>
            </div>
          </CardContent>
        </Card>

        {selectedClassifier && (
          <div className="space-y-4">
            <Card id="classifier-overview">
              <CardHeader>
                <CardTitle>
                  Classifier:{" "}
                  <ClassifierLabel
                    classifier={selectedClassifier}
                    meanings={classifierMeanings}
                    displayLabel={getClassifierBaseLabel(selectedClassifier)}
                  />
                </CardTitle>
                <p className="text-sm text-gray-600">
                  {tokensForClassifier.length} token{tokensForClassifier.length !== 1 ? "s" : ""} found
                </p>
              </CardHeader>
            </Card>

            <Card id="lemma-cooccurrence">
              <CardHeader>
                <CardTitle>Lemma co-occurrence graph</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
                <div
                  ref={lemmaNetworkRef}
                  className="w-full h-[480px] border border-gray-200 rounded-lg bg-white"
                />
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
                    onClick={() => downloadNetworkPNG(lemmaNetworkInstance.current, 96, `classifier-lemma-network-96dpi.png`)}
                  >
                    PNG 96
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => downloadNetworkPNG(lemmaNetworkInstance.current, 300, `classifier-lemma-network-300dpi.png`)}
                  >
                    PNG 300
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => downloadNetworkSVG(lemmaNetworkInstance.current, "classifier-lemma-network.svg")}
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
                    onClick={() => goFullScreen(lemmaNetworkRef.current)}
                  >
                    Go fullscreen
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => lemmaNetworkInstance.current?.setOptions({ physics: false })}
                  >
                    Freeze network
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card id="lemma-classification-network">
              <CardHeader>
                <CardTitle>Lemma Classification Network</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  ref={clfNetworkRef}
                  className="w-full h-[480px] border border-gray-200 rounded-lg bg-white"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => downloadNetworkPNG(clfNetworkInstance.current, 96, `classifier-cooccur-network-96dpi.png`)}
                  >
                    PNG 96
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => downloadNetworkPNG(clfNetworkInstance.current, 300, `classifier-cooccur-network-300dpi.png`)}
                  >
                    PNG 300
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => downloadNetworkSVG(clfNetworkInstance.current, "classifier-cooccur-network.svg")}
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
                    onClick={() => goFullScreen(clfNetworkRef.current)}
                  >
                    Go fullscreen
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card id="classifier-tokens">
              <CardHeader>
                <CardTitle>Tokens for this classifier</CardTitle>
              </CardHeader>
              <CardContent>
                {tokensForClassifier.length === 0 ? (
                  <div>No data</div>
                ) : (
                  <div className="max-h-96 overflow-auto">
                    <ul className="space-y-2">
                      {tokensForClassifier.map((token: any) => {
                        const coloredMarkup = colourClassifiers(token.mdc_w_markup);
                        const witness = witnessData[token.witness_id];
                        const lemma = token.lemma_id ? lemmaData[token.lemma_id] : null;
                        const scriptLabel = witness?.script
                          ? getThesaurusLabel(projectType, "scripts", witness.script)
                          : "";

                        const unicodeMdc = projectType === "hieroglyphic"
                          ? mdcToUnicode(token.mdc || token.mdc_w_markup || "")
                          : "";

                        return (
                          <li key={token.id} className="border-l-2 border-red-200 pl-3">
                            {unicodeMdc && (
                              <div className="egyptian-unicode text-lg text-gray-800 font-medium mb-1">
                                {unicodeMdc}
                              </div>
                            )}
                            <div
                              className="font-mono text-sm"
                              dangerouslySetInnerHTML={{ __html: coloredMarkup || token.mdc }}
                            />
                            <div className="text-xs text-gray-500 mt-1">
                              {lemma && (
                                <span>
                                  Lemma:{" "}
                                  <button
                                    onClick={() => navigate(`/project/${selectedProject}/lemma/${token.lemma_id}`)}
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

            <div id="classifier-statistics" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="lg:max-w-xl">
                <CardHeader>
                  <CardTitle>
                    Lemma by no. of examples with{" "}
                    <ClassifierLabel
                      classifier={selectedClassifier}
                      meanings={classifierMeanings}
                      displayLabel={getClassifierBaseLabel(selectedClassifier)}
                    />{" "}
                    classifier
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sortedLemmaStats.length === 0 ? (
                    <div>No data</div>
                  ) : (
                    <Table className="w-fit">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-9 px-2">Lemma</TableHead>
                          <TableHead className="text-right h-9 px-2">Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedLemmaStats.map(([lemma, count]) => {
                          const lemmaId = lemmaLabelToId.get(lemma);
                          return (
                            <TableRow key={lemma}>
                              <TableCell className="px-2 py-2">
                                {lemmaId ? (
                                  <button
                                    onClick={() => navigate(`/project/${selectedProject}/lemma/${lemmaId}`)}
                                    className="text-blue-600 hover:underline"
                                  >
                                    <em className="italic">{lemma}</em>
                                  </button>
                                ) : (
                                  <em className="italic">{lemma}</em>
                                )}
                              </TableCell>
                              <TableCell className="text-right px-2 py-2">{count}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:max-w-xl">
                <CardHeader>
                  <CardTitle>
                    Lemma centrality rank statistics with{" "}
                    <ClassifierLabel
                      classifier={selectedClassifier}
                      meanings={classifierMeanings}
                      displayLabel={getClassifierBaseLabel(selectedClassifier)}
                    />{" "}
                    classifier
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sortedLemmaPercentStats.length === 0 ? (
                    <div>No data</div>
                  ) : (
                    <Table className="w-fit">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-9 px-2">Lemma</TableHead>
                          <TableHead className="text-right h-9 px-2">Percentage</TableHead>
                          <TableHead className="text-right h-9 px-2">Counts</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedLemmaPercentStats.map(([lemma, data]) => {
                          const lemmaId = lemmaLabelToId.get(lemma);
                          return (
                            <TableRow key={lemma}>
                              <TableCell className="px-2 py-2">
                                {lemmaId ? (
                                  <button
                                    onClick={() => navigate(`/project/${selectedProject}/lemma/${lemmaId}`)}
                                    className="text-blue-600 hover:underline"
                                  >
                                    <em className="italic">{lemma}</em>
                                  </button>
                                ) : (
                                  <em className="italic">{lemma}</em>
                                )}
                              </TableCell>
                              <TableCell className="text-right px-2 py-2">{data[0]}%</TableCell>
                              <TableCell className="text-right px-2 py-2">{data[1]}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Classifier co-occurrence statistics</CardTitle>
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
                                onClick={() => navigate(`/project/${selectedProject}/classifier/${encodeURIComponent(clf)}`)}
                                className="text-blue-600 hover:underline"
                              >
                                <ClassifierLabel
                                  classifier={clf}
                                  meanings={classifierMeanings}
                                  displayLabel={getClassifierBaseLabel(clf)}
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

              <Card>
                <CardHeader>
                  <CardTitle>Classifier combinations with this classifier</CardTitle>
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
                                    onClick={() => navigate(`/project/${selectedProject}/classifier/${encodeURIComponent(clf)}`)}
                                    className="text-blue-600 hover:underline"
                                  >
                                    <ClassifierLabel
                                      classifier={clf}
                                      meanings={classifierMeanings}
                                      displayLabel={getClassifierBaseLabel(clf)}
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
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>POS co-occurrence statistics</CardTitle>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Order statistics</CardTitle>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Script statistics</CardTitle>
                </CardHeader>
                <CardContent>
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
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Select a classifier:</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedClassifier || ""} onValueChange={handleClassifierSelect}>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="---" />
              </SelectTrigger>
              <SelectContent>
                {allClassifiers.map((classifier) => (
                  <SelectItem key={classifier} value={classifier}>
                    <ClassifierLabel
                      classifier={classifier}
                      meanings={classifierMeanings}
                      displayLabel={getClassifierBaseLabel(classifier)}
                    />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search classifiers..."
                value={classifierSearchQuery}
                onChange={(e) => setClassifierSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
              {filteredClassifiers.slice(0, 150).map((classifier) => {
                const isSelected = selectedClassifier === classifier;
                const classifierInfo = classifierSummary[classifier];
                return (
                  <button
                    key={classifier}
                    onClick={() => handleClassifierSelect(classifier)}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0 transition-colors ${
                      isSelected ? "bg-red-50 border-red-200" : ""
                    }`}
                  >
                    <ClassifierLabel
                      classifier={classifier}
                      meanings={classifierMeanings}
                      displayLabel={getClassifierBaseLabel(classifier)}
                      className="font-medium"
                    />
                    {classifierInfo?.type && (
                      <span className="ml-2 text-xs bg-gray-100 text-gray-700 px-1 rounded">
                        {classifierInfo.type}
                      </span>
                    )}
                  </button>
                );
              })}
              {filteredClassifiers.length === 0 && (
                <div className="px-3 py-4 text-gray-500 text-center">No classifiers found matching your search.</div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Subset by type:</label>
                <Select value={clfType} onValueChange={setClfType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {clfTypeArr.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Subset by level:</label>
                <Select value={clfLevel} onValueChange={setClfLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {clfLevelArr.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Subset by position:</label>
                <Select value={clfPosition} onValueChange={setClfPosition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="pre">Initial</SelectItem>
                    <SelectItem value="post">Final</SelectItem>
                    <SelectItem value="inner">Inner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Restrict examples to tokens from the following witnesses:</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <WitnessSelector
                witnessData={witnessData}
                selectedWitnesses={selectedWitnesses}
                setSelectedWitnesses={setSelectedWitnesses}
                projectType={projectType}
              />
              <Button variant="outline" onClick={applyWitnessSelection}>
                Apply witness selection
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Restrict examples to tokens with the following parts of speech:</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <POSSelector
                availablePOS={availablePOS}
                selectedPOS={selectedPOS}
                onSelectionChange={setSelectedPOS}
              />
              <Button variant="outline" onClick={applyPOSSelection}>
                Apply part-of-speech selection
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Restrict examples to tokens with the following scripts:</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ScriptSelector
                witnessData={witnessData}
                selectedScripts={selectedScripts}
                setSelectedScripts={setSelectedScripts}
                projectType={projectType}
              />
              <Button variant="outline" onClick={applyScriptSelection}>
                Apply script selection
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-300 flex justify-center gap-4">
          <ReportActions
            reportId="classifier-report-content"
            reportType="classifier"
            projectId={selectedProject || ""}
            classifierId={selectedClassifier || undefined}
          />
        </div>
      </div>
    </SidebarLayout>
  );
}

function formatLemmaLabel(lemma: { transliteration?: string; meaning?: string }) {
  const base = lemma?.transliteration || "?";
  const meaning = (lemma?.meaning || "").trim();
  if (!meaning) return base;
  return `${base} '${meaning}'`;
}

function extractLemmaMeaning(meaning: string | null | undefined) {
  if (!meaning) return "";
  const trimmed = meaning.trim();
  if (trimmed.startsWith("en:")) {
    return trimmed.slice("en:".length).trim();
  }
  return trimmed;
}

function splitLemmaLabel(label: string) {
  const match = label.match(/^(.*?)\s+'(.+)'$/);
  if (match) {
    return { base: match[1], meaning: match[2] };
  }
  return { base: label, meaning: "" };
}

function getHueByPercentage(percentage: number) {
  if (percentage > 90) {
    return "rgba(255, 0, 0, .4)";
  } else if (percentage > 80) {
    return "rgba(255, 51, 51, .4)";
  } else if (percentage > 70) {
    return "rgba(255, 102, 102, .4)";
  } else if (percentage > 60) {
    return "rgba(255, 153, 153, .4)";
  } else if (percentage > 50) {
    return "rgba(255, 204, 204, .4)";
  }
  return "rgba(255, 230, 230, .4)";
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
