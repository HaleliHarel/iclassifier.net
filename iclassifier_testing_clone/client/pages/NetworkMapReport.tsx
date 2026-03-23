import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Download, RotateCcw, Maximize2, Pause, Play, Info } from "lucide-react";
import SidebarLayout from "@/components/SidebarLayout";
import { useProjectData } from "@/lib/dataProvider";
import {
  CLASSIFIER_LEVEL_LABELS,
  CLASSIFIER_TYPE_LABELS_WITH_ANYTHING,
  projects,
  resolveNetworkDefaults,
} from "@/lib/sampleData";
import { useCurrentProjectId } from "@/lib/projectContext";
import { useCompareNavigation } from "@/hooks/useCompareNavigation";
import { fetchJseshBase64, getJseshImageUrl, getJseshRenderHeight } from "@/lib/jsesh";
import { mdc2uni } from "@/lib/mdc2uni";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import WitnessSelector from "@/components/filters/WitnessSelector";
import ScriptSelector from "@/components/filters/ScriptSelector";
import POSSelector from "@/components/filters/POSSelector";
import {
  buildClassifierMapsFromMetadata,
  createMapNetworkAll,
  createMapNetworkByLevelAndType,
  getNetworkOptions,
  scaleEdgeWidths,
  fetchExtendedSignDataUrl,
  JSESH_NODE_COLOR,
  buildPosColorMap,
  LEMMA_CLASSIFIER_EDGE_COLOR,
  CLASSIFIER_COOCCURRENCE_EDGE_COLOR,
  shouldIncludeToken,
  CLF_NODE_WIDTH,
  CLF_NODE_HEIGHT,
  CLF_NODE_RADIUS,
  wrapClassifierImage,
  createNetworkCSV,
  downloadNetworkCSV,
  getLemmaNodeFontFace,
  limitNetworkToTopClassifiers,
  NETWORK_TOP_CLASSIFIER_LIMIT,
  TOP_CLASSIFIER_LIMIT_DISCLAIMER,
  NetworkConfig
} from "@/lib/networkUtils";
import { downloadNetworkDataWorkbook, downloadNetworkJPEG, downloadNetworkPNG, downloadNetworkSVGVector } from "@/lib/networkExport";
import NotFound from "@/pages/NotFound";
import ReportActions from "@/components/ReportActions";
import NetworkLoader from "@/components/NetworkLoader";
import NetworkLegend from "@/components/NetworkLegend";

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

export default function NetworkMapReport() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId: urlProjectId } = useParams();
  const currentProjectId = useCurrentProjectId();
  const { setCompareTarget } = useCompareNavigation();

  const isComparisonRoute = location.pathname.startsWith("/compare/");
  
  // Get project ID from URL params
  const selectedProjectId = urlProjectId || currentProjectId;
  
  // Project selection state
  const [selectedProject, setSelectedProject] = useState(selectedProjectId);

  // Sync selectedProject with URL changes
  useEffect(() => {
    setSelectedProject(selectedProjectId);
  }, [selectedProjectId]);

  // Get project info
  const selectedProjectInfo = projects.find(p => p.id === selectedProject);
  
  // Filter states for network generation
  const defaults = resolveNetworkDefaults(selectedProjectInfo || undefined);
  const networkUseUnicodeDefault = selectedProjectInfo?.type === "hieroglyphic"
    ? false
    : defaults.useUnicode;
  const [clfLevels, setClfLevels] = useState<Set<number>>(new Set(defaults.clfLevels));
  const [clfTypes, setClfTypes] = useState<Set<string>>(new Set(defaults.clfTypes));
  const [useAllData, setUseAllData] = useState(defaults.useAllData);
  const [selectedWitnesses, setSelectedWitnesses] = useState<Set<string>>(new Set());
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set());
  const [selectedPos, setSelectedPos] = useState<Set<string>>(new Set());
  const [useUnicode, setUseUnicode] = useState(networkUseUnicodeDefault);

  const classifierFontFace = useMemo(() => {
    if (selectedProjectInfo?.type === "cuneiform") return "cuneiform";
    if (selectedProjectInfo?.type === "chinese") return "Noto Sans TC";
    if (selectedProjectInfo?.type === "hieroglyphic") {
      // Use eot.ttf for Unicode glyphs, hierofont for JSesh-rendered fallback
      return useUnicode ? "eot" : "hierofont";
    }
    return "sans-serif";
  }, [selectedProjectInfo, useUnicode]);
  const lemmaFontFace = getLemmaNodeFontFace(selectedProjectInfo?.type);
  const [classifierDisplayMode, setClassifierDisplayMode] = useState<"visual" | "meaning">("visual");
  const [lemmaDisplayMode, setLemmaDisplayMode] = useState<"origin" | "translation" | "both">("both");
  const [lemmaColorMode, setLemmaColorMode] = useState<"default" | "pos">("default");
  const [fastMode, setFastMode] = useState(false);
  const [visReady, setVisReady] = useState(false);
  const [isNetworkFullscreen, setIsNetworkFullscreen] = useState(false);
  
  // Network state
  const networkRef = useRef<HTMLDivElement>(null);
  const networkCardRef = useRef<HTMLDivElement>(null);
  const networkInstanceRef = useRef<any>(null);
  const networkTokenRef = useRef(0);
  const dragGroupRef = useRef<null | {
    nodeId: string;
    origin: { x: number; y: number };
    connected: (string | number)[];
    positions: Record<string, { x: number; y: number }>;
  }>(null);
  const [mapDrawn, setMapDrawn] = useState(false);
  const [isNetworkFrozen, setIsNetworkFrozen] = useState(false);
  const isNetworkFrozenRef = useRef(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [networkType, setNetworkType] = useState<'all' | 'filtered'>('filtered');
  const [edgeScale, setEdgeScale] = useState(1);
  const [isTopClassifierLimitActive, setIsTopClassifierLimitActive] = useState(false);
  
  // Store network data for CSV export
  const [currentNetworkData, setCurrentNetworkData] = useState<{
    lemEdgeDict: any;
    clfEdgeDict: any;
    clfNodeDict: any;
    lemNodeDict: any;
  }>({ lemEdgeDict: {}, clfEdgeDict: {}, clfNodeDict: {}, lemNodeDict: {} });
  const [exportNetworkData, setExportNetworkData] = useState<{ nodes: any[]; edges: any[] }>({
    nodes: [],
    edges: []
  });

  // Reset filters when project changes
  useEffect(() => {
    isNetworkFrozenRef.current = isNetworkFrozen;
  }, [isNetworkFrozen]);

  useEffect(() => {
    setSelectedWitnesses(new Set());
    setSelectedScripts(new Set());
    setSelectedPos(new Set());
    const nextDefaults = resolveNetworkDefaults(selectedProjectInfo || undefined);
    setClfLevels(new Set(nextDefaults.clfLevels));
    setClfTypes(new Set(nextDefaults.clfTypes));
    setUseAllData(nextDefaults.useAllData);
    setUseUnicode(selectedProjectInfo?.type === "hieroglyphic" ? false : nextDefaults.useUnicode);
    setMapDrawn(false);
    setIsTopClassifierLimitActive(false);
    if (networkInstanceRef.current) {
      networkInstanceRef.current.destroy();
      networkInstanceRef.current = null;
    }
  }, [selectedProject, selectedProjectInfo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    import("vis-network/standalone").then((vis) => {
      if (cancelled) return;
      VisNetwork = vis.Network;
      VisDataSet = vis.DataSet;
      setVisReady(true);
    }).catch(() => setVisReady(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch project data from API
  const { data: projectData, loading: dataLoading, error: dataError } = useProjectData(selectedProject);
  
  // Extract data from API response or use empty defaults
  const tokenData = projectData?.tokens || {};
  const lemmaData = projectData?.lemmas || {};
  const witnessData = projectData?.witnesses || {};
  const availablePOS = useMemo(() => {
    const posSet = new Set<string>();
    Object.values(tokenData).forEach((token: any) => {
      const value = token?.pos === null || token?.pos === undefined
        ? ""
        : String(token.pos).trim();
      if (value) {
        posSet.add(value);
      }
    });
    return Array.from(posSet).sort();
  }, [tokenData]);
  const posLegendData = useMemo(() => {
    if (lemmaColorMode !== "pos") {
      return { posList: [], posColorMap: {} as Record<string, string> };
    }
    const posSet = new Set<string>();
    const filterConfig: NetworkConfig = {
      selectedWitnesses,
      selectedScripts,
      selectedPos
    };
    Object.values(tokenData).forEach((token: any) => {
      if (!token) return;
      if (!shouldIncludeToken(token, filterConfig, witnessData)) return;
      const value = token?.pos === null || token?.pos === undefined
        ? ""
        : String(token.pos).trim();
      if (value) {
        posSet.add(value);
      }
    });
    const posList = Array.from(posSet).sort((a, b) => a.localeCompare(b));
    return {
      posList,
      posColorMap: buildPosColorMap(posList)
    };
  }, [lemmaColorMode, tokenData, witnessData, selectedWitnesses, selectedScripts, selectedPos]);
  const { clfData, clfParseData } = useMemo(
    () => buildClassifierMapsFromMetadata(projectData?.classifiers || []),
    [projectData?.classifiers]
  );
  const loading = dataLoading;
  const error = dataError;

  if (!selectedProjectInfo && !loading) {
    return <NotFound />;
  }

  // Handle level checkbox changes
  const toggleLevel = useCallback((level: number, checked: boolean) => {
    setClfLevels(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(level);
      } else {
        newSet.delete(level);
      }
      return newSet;
    });
  }, []);

  // Handle type checkbox changes
  const toggleType = useCallback((type: string, checked: boolean) => {
    setClfTypes(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(type);
      } else {
        newSet.delete(type);
      }
      return newSet;
    });
  }, []);

  // Download network data as GEXF for Gephi
  const downloadNetworkGEXF = useCallback(() => {
    if (!currentNetworkData || (!currentNetworkData.lemNodeDict && !currentNetworkData.clfNodeDict)) {
      console.warn('No network data available for export');
      return;
    }

    // Create GEXF XML structure
    let gexfContent = `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">
  <meta lastmodifieddate="${new Date().toISOString()}">
    <creator>iClassifier</creator>
    <description>${selectedProject} Network - ${selectedProjectInfo?.type || 'unknown'} project</description>
  </meta>
  <graph mode="static" defaultedgetype="undirected">
    <attributes class="node">
      <attribute id="0" title="type" type="string"/>
      <attribute id="1" title="frequency" type="integer"/>
      <attribute id="2" title="meaning" type="string"/>
      <attribute id="3" title="transliteration" type="string"/>
      <attribute id="4" title="mdc" type="string"/>
      <attribute id="5" title="unicode" type="string"/>
    </attributes>
    <attributes class="edge">
      <attribute id="0" title="weight" type="double"/>
      <attribute id="1" title="relationship" type="string"/>
    </attributes>
    <nodes>\n`;

    // Add lemma nodes
    for (const [lemmaId, count] of Object.entries(currentNetworkData.lemNodeDict)) {
      const lemma = lemmaData[parseInt(lemmaId)];
      const label = (lemma?.transliteration || `lemma-${lemmaId}`).replace(/[&<>"']/g, (m) => {
        switch(m) {
          case '&': return '&amp;';
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '"': return '&quot;';
          case "'": return '&apos;';
          default: return m;
        }
      });
      const meaning = (lemma?.meaning || '').replace(/[&<>"']/g, (m) => {
        switch(m) {
          case '&': return '&amp;';
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '"': return '&quot;';
          case "'": return '&apos;';
          default: return m;
        }
      });
      const transliteration = (lemma?.transliteration || '').replace(/[&<>"']/g, (m) => {
        switch(m) {
          case '&': return '&amp;';
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '"': return '&quot;';
          case "'": return '&apos;';
          default: return m;
        }
      });
      
      gexfContent += `      <node id="lemma-${lemmaId}" label="${label}">
`;
      gexfContent += `        <attvalues>
`;
      gexfContent += `          <attvalue for="0" value="lemma"/>
`;
      gexfContent += `          <attvalue for="1" value="${count}"/>
`;
      gexfContent += `          <attvalue for="2" value="${meaning}"/>
`;
      gexfContent += `          <attvalue for="3" value="${transliteration}"/>
`;
      gexfContent += `        </attvalues>
`;
      gexfContent += `      </node>
`;
    }

    // Add classifier nodes
    for (const [classifier, count] of Object.entries(currentNetworkData.clfNodeDict)) {
      const meaning = (projectData?.classifierMeanings?.[classifier] || '').replace(/[&<>"']/g, (m) => {
        switch(m) {
          case '&': return '&amp;';
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '"': return '&quot;';
          case "'": return '&apos;';
          default: return m;
        }
      });
      const glyph = selectedProjectInfo?.type === "hieroglyphic" 
        ? (mdc2uni[classifier] || classifier)
        : classifier;
      const unicodeEscaped = glyph.replace(/[&<>"']/g, (m) => {
        switch(m) {
          case '&': return '&amp;';
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '"': return '&quot;';
          case "'": return '&apos;';
          default: return m;
        }
      });
      const mdcEscaped = classifier.replace(/[&<>"']/g, (m) => {
        switch(m) {
          case '&': return '&amp;';
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '"': return '&quot;';
          case "'": return '&apos;';
          default: return m;
        }
      });
      
      gexfContent += `      <node id="clf-${classifier}" label="${mdcEscaped}">`;
      gexfContent += `
        <attvalues>
`;
      gexfContent += `          <attvalue for="0" value="classifier"/>
`;
      gexfContent += `          <attvalue for="1" value="${count}"/>
`;
      gexfContent += `          <attvalue for="2" value="${meaning}"/>
`;
      gexfContent += `          <attvalue for="4" value="${mdcEscaped}"/>
`;
      gexfContent += `          <attvalue for="5" value="${unicodeEscaped}"/>
`;
      gexfContent += `        </attvalues>
`;
      gexfContent += `      </node>
`;
    }

    gexfContent += `    </nodes>
    <edges>\n`;

    let edgeId = 0;
    // Add lemma edges (classifier -> lemma connections)
    for (const [edgeKey, weight] of Object.entries(currentNetworkData.lemEdgeDict)) {
      const [classifier, lemmaId] = edgeKey.split('>');
      gexfContent += `      <edge id="${edgeId++}" source="clf-${classifier}" target="lemma-${lemmaId}">
`;
      gexfContent += `        <attvalues>
`;
      gexfContent += `          <attvalue for="0" value="${weight}"/>
`;
      gexfContent += `          <attvalue for="1" value="classifier-lemma"/>
`;
      gexfContent += `        </attvalues>
`;
      gexfContent += `      </edge>
`;
    }

    // Add classifier edges (classifier -> classifier connections)
    for (const [edgeKey, weight] of Object.entries(currentNetworkData.clfEdgeDict)) {
      const [classifier1, classifier2] = edgeKey.split('>');
      gexfContent += `      <edge id="${edgeId++}" source="clf-${classifier1}" target="clf-${classifier2}">
`;
      gexfContent += `        <attvalues>
`;
      gexfContent += `          <attvalue for="0" value="${weight}"/>
`;
      gexfContent += `          <attvalue for="1" value="classifier-classifier"/>
`;
      gexfContent += `        </attvalues>
`;
      gexfContent += `      </edge>
`;
    }

    gexfContent += `    </edges>
  </graph>
</gexf>`;

    // Download the GEXF file
    const blob = new Blob([gexfContent], { type: 'application/gexf+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedProject}-network.gexf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [currentNetworkData, lemmaData, projectData, selectedProject, selectedProjectInfo, clfLevels, clfTypes, selectedWitnesses, selectedScripts, selectedPos, useUnicode, classifierDisplayMode]);

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
      navigate(`/project/${selectedProject}/classifier?classifier=${encodeURIComponent(classifier)}`);
    },
    [navigate, selectedProject, setCompareTarget]
  );

  // Generate network based on current settings
  const generateNetwork = useCallback(async (useAll: boolean = false, showAllClassifiers: boolean = false) => {
    if (loading || !projectData) return;
    if (!Object.keys(tokenData).length) return;
    if (!visReady || !networkRef.current || !VisNetwork || !VisDataSet) {
      console.warn('Network libraries not loaded yet');
      return;
    }

    setIsGenerating(true);
    setIsTopClassifierLimitActive(false);
    let renderToken = 0;
    
    try {
      // Clear previous network
      if (networkInstanceRef.current) {
        networkInstanceRef.current.destroy();
        networkInstanceRef.current = null;
      }
      renderToken = Date.now();
      networkTokenRef.current = renderToken;

      const config: NetworkConfig = {
        clfLevels,
        clfTypes,
        selectedWitnesses,
        selectedScripts,
        selectedPos,
        useUnicode,
        classifierDisplayMode,
        lemmaDisplayMode,
        lemmaColorMode,
        classifierFontFace,
        lemmaFontFace,
        classifierFontScale: selectedProjectInfo?.type && selectedProjectInfo.type !== "hieroglyphic" ? 2 : 1,
        projectId: selectedProject,
        projectType: selectedProjectInfo?.type,
        classifierMeanings: projectData?.classifierMeanings,
        lemmaLabelMode: "transliteration",
        classifierNodeSize: CLF_NODE_HEIGHT,
        classifierNodeWidth: CLF_NODE_WIDTH,
        classifierNodeHeight: CLF_NODE_HEIGHT,
        classifierNodeRadius: CLF_NODE_RADIUS,
        maxNodes: fastMode ? 400 : undefined,
        posColorMap: lemmaColorMode === "pos" ? posLegendData.posColorMap : undefined
      };

      const hasClassifierMetadata = Object.keys(clfData).length > 0;
      let networkData;
      if (useAll || !hasClassifierMetadata) {
        // Draw all data (unanalysed classifiers included)
        networkData = createMapNetworkAll(tokenData, lemmaData, witnessData, config);
      } else {
        // Draw filtered data (only analysed classifiers)
        networkData = createMapNetworkByLevelAndType(
          tokenData,
          lemmaData,
          witnessData,
          clfData,
          clfParseData,
          config
        );
      }

      if (showAllClassifiers) {
        setIsTopClassifierLimitActive(false);
      } else {
        const limitedNetworkResult = limitNetworkToTopClassifiers(networkData, NETWORK_TOP_CLASSIFIER_LIMIT);
        networkData = limitedNetworkResult.networkData;
        setIsTopClassifierLimitActive(limitedNetworkResult.wasLimited);
      }

      const { edges: scaledEdges, scale } = scaleEdgeWidths(networkData.edges);
      setEdgeScale(scale);

      // Store data for CSV export
      setCurrentNetworkData({
        lemEdgeDict: networkData.lemEdgeDict,
        clfEdgeDict: networkData.clfEdgeDict,
        clfNodeDict: networkData.clfNodeDict,
        lemNodeDict: networkData.lemNodeDict
      });
      setExportNetworkData({
        nodes: networkData.nodes,
        edges: scaledEdges
      });

      if (networkData.nodes.length === 0) {
        console.warn('No network nodes to display');
        setIsGenerating(false);
        return;
      }

      // Normalize nodes to avoid vis.js shapeProperties undefined errors
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

      // Create network
      const visNetworkData = {
        nodes: new VisDataSet(normalizedNodes),
        edges: new VisDataSet(scaledEdges)
      };

      const optimizeForCompare = isComparisonRoute && !fastMode;
      const baseOptions = getNetworkOptions();
      const edgeOptions = { ...(baseOptions.edges || {}) } as any;
      delete edgeOptions.length;
      const options = {
        ...baseOptions,
        interaction: {
          ...(baseOptions.interaction || {}),
          ...getInteractionByFrozenState(false),
        },
        physics: {
          enabled: true,
          stabilization: {
            iterations: fastMode ? 260 : (optimizeForCompare ? 320 : 800),
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
          shadow: !(fastMode || optimizeForCompare),
          shapeProperties: {
            borderDashes: false,
            useImageSize: false,
            useBorderWithImage: false,
            interpolation: false
          }
        },
        edges: {
          ...edgeOptions,
          smooth: {
            enabled: true,
            type: "dynamic",
            roundness: 0.2
          }
        }
      } as any;
      
      const network = new VisNetwork(networkRef.current, visNetworkData, options);
      networkInstanceRef.current = network;
      setIsNetworkFrozen(false);
      isNetworkFrozenRef.current = false;
      setMapDrawn(true);

      network.on("dragStart", (params: any) => {
        if (isNetworkFrozenRef.current) {
          dragGroupRef.current = null;
          return;
        }
        if (!params?.nodes || params.nodes.length !== 1) {
          dragGroupRef.current = null;
          return;
        }
        const nodeId = params.nodes[0];
        const connected = network.getConnectedNodes(nodeId) as Array<string | number>;
        if (!connected || connected.length === 0) {
          dragGroupRef.current = null;
          return;
        }
        const nodeIds = [nodeId, ...connected];
        const positions = network.getPositions(nodeIds) as Record<string, { x: number; y: number }>;
        const origin = positions[nodeId as any];
        if (!origin) {
          dragGroupRef.current = null;
          return;
        }
        const positionMap: Record<string, { x: number; y: number }> = {};
        nodeIds.forEach((id) => {
          const pos = positions[id as any];
          if (!pos) return;
          positionMap[String(id)] = { x: pos.x, y: pos.y };
        });
        dragGroupRef.current = {
          nodeId,
          origin: { x: origin.x, y: origin.y },
          connected,
          positions: positionMap
        };
      });

      network.on("dragging", () => {
        if (isNetworkFrozenRef.current) return;
        const dragGroup = dragGroupRef.current;
        if (!dragGroup) return;
        const current = network.getPositions([dragGroup.nodeId]) as Record<string, { x: number; y: number }>;
        const draggedPos = current[dragGroup.nodeId as any];
        if (!draggedPos) return;
        const scaleFactor = 1;
        const updates = dragGroup.connected
          .map((id) => {
            const start = dragGroup.positions[String(id)];
            if (!start) return null;
            const vx = start.x - dragGroup.origin.x;
            const vy = start.y - dragGroup.origin.y;
            return {
              id,
              x: draggedPos.x + vx * scaleFactor,
              y: draggedPos.y + vy * scaleFactor
            };
          })
          .filter(Boolean) as Array<{ id: string | number; x: number; y: number }>;
        if (updates.length > 0) {
          network.body.data.nodes.update(updates);
        }
      });

      network.on("dragEnd", () => {
        dragGroupRef.current = null;
      });

      let finalized = false;
      const freezeNetworkAfterLoad = () => {
        if (networkTokenRef.current !== renderToken) return;
        if (typeof network.stopSimulation === "function") {
          network.stopSimulation();
        }
        network.setOptions({
          physics: { enabled: false },
          interaction: getInteractionByFrozenState(true),
        });
        isNetworkFrozenRef.current = true;
        setIsNetworkFrozen(true);
      };
      const finalize = () => {
        if (finalized) return;
        if (networkTokenRef.current !== renderToken) return;
        finalized = true;
        window.clearTimeout(fallbackId);
        if (typeof network.setSize === "function") {
          const container = networkRef.current;
          if (container) {
            const width = container.clientWidth || window.innerWidth;
            const height = container.clientHeight || 500;
            network.setSize(`${width}px`, `${height}px`);
          }
        }
        network.fit({ animation: { duration: 500, easingFunction: "easeInOutQuad" } });
        network.redraw();
        freezeNetworkAfterLoad();
        setIsGenerating(false);
      };
      const fallbackId = window.setTimeout(() => finalize(), 9000);
      network.once("stabilizationIterationsDone", finalize);

      if (selectedProjectInfo?.type === "hieroglyphic" && classifierDisplayMode === "visual") {
        const classifierNodes = networkData.nodes.filter((node) => node.type === "classifier");
        await Promise.all(
          classifierNodes.map(async (node) => {
            const mdc = (node as any).mdc || node.label;
            const normalizedMdc = typeof mdc === "string" ? mdc.trim() : "";
            const glyph = normalizedMdc ? mdc2uni[normalizedMdc] : undefined;
            const hasUnicodeGlyph = typeof glyph === "string" && (glyph.codePointAt(0) || 0) >= 256;
            if (useUnicode && hasUnicodeGlyph) return;

            const cacheKey = normalizedMdc;
            if (!cacheKey) return;
            const cached = cacheKey ? classifierImageCache.get(cacheKey) : null;
            const cachedImage = cached ? wrapClassifierImage(cached) : null;
            if (cachedImage) {
              classifierImageCache.set(cacheKey, cachedImage);
              if (networkTokenRef.current !== renderToken) return;
              visNetworkData.nodes.update({
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
              try { network.redraw(); } catch { /* network may be destroyed */ }
              return;
            }

            const extendedSignData = await fetchExtendedSignDataUrl(cacheKey);
            if (extendedSignData) {
              const wrappedImage = wrapClassifierImage(extendedSignData);
              classifierImageCache.set(cacheKey, wrappedImage);
              if (networkTokenRef.current !== renderToken) return;
              visNetworkData.nodes.update({
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
              try { network.redraw(); } catch { /* network may be destroyed */ }
              return;
            }

            const base64 = await fetchJseshBase64(cacheKey, getJseshRenderHeight(CLF_NODE_HEIGHT), true);
            if (base64) {
              const dataUrl = wrapClassifierImage(getJseshImageUrl(base64));
              classifierImageCache.set(cacheKey, dataUrl);
              if (networkTokenRef.current !== renderToken) return;
              visNetworkData.nodes.update({
                id: node.id,
                shape: "image",
                image: dataUrl,
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
              try { network.redraw(); } catch { /* network may be destroyed */ }
            }
          })
        );
        finalize();
      }

      // Handle node double-clicks for navigation
      network.on('doubleClick', (params: any) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          if (nodeId.startsWith('classifier_')) {
            const classifier = nodeId.replace('classifier_', '');
            openClassifier(classifier);
          } else if (nodeId.startsWith('lemma_')) {
            const lemmaId = nodeId.replace('lemma_', '');
            openLemma(lemmaId);
          }
        }
      });

    } catch (error) {
      if (networkTokenRef.current !== renderToken) return;
      console.error('Error generating network:', error);
      setIsGenerating(false);
    }
  }, [
    clfLevels, clfTypes, selectedWitnesses, selectedScripts,
    selectedPos, useUnicode, classifierDisplayMode, lemmaDisplayMode, fastMode, tokenData, lemmaData, witnessData, clfData, clfParseData,
    openClassifier, openLemma, selectedProject, selectedProjectInfo, projectData, loading, visReady, lemmaColorMode, posLegendData, isComparisonRoute
  ]);

  // Toggle background color
  const toggleBackgroundColor = useCallback(() => {
    if (networkRef.current) {
      const currentBg = networkRef.current.style.backgroundColor;
      networkRef.current.style.backgroundColor = currentBg === 'black' ? 'white' : 'black';
    }
  }, []);

  // Go fullscreen
  const goFullscreen = useCallback(() => {
    if (networkCardRef.current && networkCardRef.current.requestFullscreen) {
      networkCardRef.current.requestFullscreen();
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsNetworkFullscreen(document.fullscreenElement === networkCardRef.current);
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
  }, [exitFullscreen]);

  useEffect(() => {
    if (!networkInstanceRef.current) return;
    if (typeof networkInstanceRef.current.setSize === "function") {
      networkInstanceRef.current.setSize("100%", "100%");
    }
    if (typeof networkInstanceRef.current.redraw === "function") {
      networkInstanceRef.current.redraw();
    }
  }, [isNetworkFullscreen]);

  // Toggle network physics
  const toggleNetworkFreeze = useCallback(() => {
    if (networkInstanceRef.current) {
      if (isNetworkFrozen) {
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
        networkInstanceRef.current.setOptions({
          physics: { enabled: false },
          interaction: getInteractionByFrozenState(true),
        });
      }
      setIsNetworkFrozen(!isNetworkFrozen);
    }
  }, [isNetworkFrozen]);

  // Download network CSV
  const handleDownloadCSV = useCallback(() => {
    if (!mapDrawn) return;
    
    const csvContent = createNetworkCSV(
      currentNetworkData.lemEdgeDict,
      currentNetworkData.clfEdgeDict,
      lemmaData
    );
    
    downloadNetworkCSV(csvContent, `${selectedProject}_network_data.csv`);
  }, [mapDrawn, currentNetworkData, lemmaData, selectedProject]);

  // Auto-generate on first load with default criteria
  useEffect(() => {
    if (mapDrawn || isGenerating) return;
    if (!projectData || !visReady) return;
    if (!Object.keys(tokenData).length) return;
    const useAll = useAllData;
    setNetworkType(useAll ? "all" : "filtered");
    generateNetwork(useAll, false);
  }, [
    mapDrawn,
    isGenerating,
    projectData,
    visReady,
    tokenData,
    useAllData,
    generateNetwork
  ]);

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-64">
          <NetworkLoader title="Loading network data..." />
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
      <div className="space-y-4" id="network-report-content">
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
                <h1 className="text-3xl font-bold page-accent-text">Network Map</h1>
                <div className="text-gray-600">
                  Plotting a network of classifiers and their host lemmas
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
                onClick={() => navigate(`/project/${selectedProject}/classifier`)}
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
               <span className="w-4 h-4 mr-2 inline-flex items-center justify-center text-base">
                  𓀁
                </span>
                Classifier Report
              </Button>
              
              <Button
                variant="outline"
                onClick={() => navigate(`/project/${selectedProject}/lemma`)}
                className="border-amber-500 text-amber-600 hover:bg-amber-50"
              >
                <span className="mr-2 inline-flex items-center justify-center text-base">
                  𓆣
                </span>
                Lemma Report
              </Button>
            </div>
          )}
        </div>

        {/* Network Visualization */}
        <Card
          ref={networkCardRef}
          className={isNetworkFullscreen ? "flex flex-col h-screen w-screen max-h-none max-w-none rounded-none" : ""}
        >
          <CardHeader>
            <CardTitle className="text-xl flex items-center justify-between">
              <span>Interactive Network Map</span>
              {mapDrawn && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleBackgroundColor}
                    className="flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Switch BG
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={isNetworkFullscreen ? exitFullscreen : goFullscreen}
                    className="flex items-center gap-1"
                  >
                    <Maximize2 className="w-3 h-3" />
                    {isNetworkFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadCSV}
                    className="flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    CSV
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadNetworkPNG(networkInstanceRef.current, 96, `${selectedProject}-network-96dpi.png`).catch(console.error)}
                    className="flex items-center gap-1"
                  >
                    PNG 96
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadNetworkPNG(networkInstanceRef.current, 300, `${selectedProject}-network-300dpi.png`).catch(console.error)}
                    className="flex items-center gap-1"
                  >
                    PNG 300
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadNetworkSVGVector(networkInstanceRef.current, `${selectedProject}-network.svg`)}
                    className="flex items-center gap-1"
                  >
                    SVG
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadNetworkDataWorkbook(exportNetworkData.nodes, exportNetworkData.edges, `${selectedProject}-network-data.xls`)}
                    className="flex items-center gap-1"
                  >
                    Data
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={downloadNetworkGEXF}
                    className="flex items-center gap-1"
                    title="Export network as GEXF for Gephi"
                  >
                    <Download className="w-3 h-3" />
                    Export Network
                  </Button>
                </div>
              )}
            </CardTitle>
            {!mapDrawn && (
              <p className="text-sm text-gray-600">
                Configure filters below and click "Draw" to generate the network visualization
              </p>
            )}
          </CardHeader>
          <CardContent className={isNetworkFullscreen ? "flex flex-col flex-1 min-h-0" : ""}>
            {isTopClassifierLimitActive && (
              <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {TOP_CLASSIFIER_LIMIT_DISCLAIMER}
              </div>
            )}
            {mapDrawn && (
              <div className="mb-2 flex items-center justify-start gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleNetworkFreeze}
                  className="flex items-center gap-1 font-bold"
                >
                  {isNetworkFrozen ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                  {isNetworkFrozen ? "Unfreeze" : "Freeze"}
                </Button>
                <NetworkLegend showLemmaToggle={true} showClassifierToggle={true} />
              </div>
            )}
            <div className={isNetworkFullscreen ? "relative flex-1 min-h-0" : "relative"}>
              <div 
                ref={networkRef}
                className="w-full border border-gray-200 rounded-lg bg-white"
                style={{ 
                  height: isNetworkFullscreen ? "100%" : "85vh",
                  minHeight: isNetworkFullscreen ? "100%" : "800px"
                }}
              />
              {mapDrawn && edgeScale > 1 && (
                <div className="absolute bottom-2 right-2 rounded border border-gray-200 bg-white/90 px-2 py-1 text-xs text-gray-600">
                  Edge scale: ÷{edgeScale.toFixed(1)}
                </div>
              )}
              {isGenerating && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/75">
                  <NetworkLoader title="Building network..." />
                </div>
              )}
            </div>
            {mapDrawn && (
              <div className="mt-3 flex items-center justify-between text-sm font-semibold text-gray-700">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-white border border-black rounded-full"></div>
                    <span>Lemmas</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-[beige] border border-[beige] rounded"></div>
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
                </div>
                <span>Drag nodes • Scroll to zoom • Click to navigate</span>
              </div>
            )}
            {mapDrawn && lemmaColorMode === "pos" && posLegendData.posList.length > 0 && (
              <div className="mt-2">
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
          </CardContent>
        </Card>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Information Level Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span>Information Types</span>
                <button 
                  onClick={() => window.open('/user-manual#information-types', '_blank')}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                  title="Learn more about Information Types"
                >
                  <Info className="w-4 h-4" />
                </button>
              </CardTitle>
              <p className="text-sm text-gray-600">Select classifier information levels to include</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {CLASSIFIER_LEVEL_LABELS.map(([level, label]) => (
                <div key={level} className="flex items-center space-x-2">
                  <Checkbox
                    id={`level-${level}`}
                    checked={clfLevels.has(level as number)}
                    onCheckedChange={(checked) => toggleLevel(level as number, checked as boolean)}
                  />
                  <Label htmlFor={`level-${level}`} className="text-sm">
                    {label}
                  </Label>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Classifier Type Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Classifier Types</CardTitle>
              <p className="text-sm text-gray-600">Select classifier types to include</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {CLASSIFIER_TYPE_LABELS_WITH_ANYTHING.map(([type, label]) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`type-${type}`}
                    checked={clfTypes.has(type)}
                    onCheckedChange={(checked) => toggleType(type, checked as boolean)}
                  />
                  <Label htmlFor={`type-${type}`} className="text-sm">
                    {label}
                  </Label>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Additional Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Text Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <WitnessSelector
                witnessData={witnessData}
                selectedWitnesses={selectedWitnesses}
                setSelectedWitnesses={setSelectedWitnesses}
                projectType={selectedProjectInfo?.type}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Script Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <ScriptSelector
                witnessData={witnessData}
                selectedScripts={selectedScripts}
                setSelectedScripts={setSelectedScripts}
                projectType={selectedProjectInfo?.type}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">POS Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <POSSelector
                availablePOS={availablePOS}
                selectedPOS={selectedPos}
                onSelectionChange={setSelectedPos}
              />
            </CardContent>
          </Card>
        </div>

        {/* Generation Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Network Generation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => {
                  setUseAllData(false);
                  setNetworkType("filtered");
                  generateNetwork(false, false);
                }}
                disabled={isGenerating}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isGenerating ? 'Generating...' : 'Draw with Selected Filters'}
              </Button>
              <Button
                onClick={() => {
                  setUseAllData(true);
                  setNetworkType("all");
                  generateNetwork(true, true);
                }}
                disabled={isGenerating}
                variant="outline"
              >
                {isGenerating ? 'Generating...' : 'Draw with All Data (Unanalysed)'}
              </Button>
              
              {/* Hieroglyph display mode toggle */}
              {selectedProjectInfo?.type === "hieroglyphic" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUseUnicode(!useUnicode)}
                >
                  {useUnicode ? "Show Hieroglyphs (MdC)" : "Show Hieroglyphs in Unicode"}
                </Button>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-700">Classifier labels</span>
                <Button
                  variant={classifierDisplayMode === "visual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setClassifierDisplayMode("visual")}
                >
                  Classifier by origin
                </Button>
                <Button
                  variant={classifierDisplayMode === "meaning" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setClassifierDisplayMode("meaning")}
                >
                  Classifier by meaning label
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-700">Lemma labels</span>
                <Button
                  variant={lemmaDisplayMode === "origin" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLemmaDisplayMode("origin")}
                >
                  Lemmas by original form
                </Button>
                <Button
                  variant={lemmaDisplayMode === "translation" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLemmaDisplayMode("translation")}
                >
                  Lemmas by translation
                </Button>
                <Button
                  variant={lemmaDisplayMode === "both" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLemmaDisplayMode("both")}
                >
                  Lemmas by origin + translation
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="fast-mode"
                  checked={fastMode}
                  onCheckedChange={(checked) => setFastMode(checked as boolean)}
                />
                <Label htmlFor="fast-mode" className="text-sm">
                  Fast mode (max 400 nodes)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="lemma-pos-color"
                  checked={lemmaColorMode === "pos"}
                  onCheckedChange={(checked) => setLemmaColorMode(checked ? "pos" : "default")}
                />
                <Label htmlFor="lemma-pos-color" className="text-sm">
                  Color lemma nodes by POS gloss
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 pt-6 border-t border-gray-300 flex justify-center gap-3">
          <ReportActions
            reportId="network-report-content"
            reportType="network"
            projectId={selectedProject || ""}
          />
        </div>
      </div>
    </SidebarLayout>
  );
}
