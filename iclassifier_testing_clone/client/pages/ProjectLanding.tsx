import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import SidebarLayout from "@/components/SidebarLayout";
import { useProjectData } from "@/lib/dataProvider";
import {
  normalizeClassifierLevelNumber,
  projects,
  resolveNetworkDefaults,
} from "@/lib/sampleData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  extractClassifiersFromString,
  buildClassifierMapsFromMetadata,
  createMapNetworkAll,
  createMapNetworkByLevelAndType,
  getNetworkOptions,
  scaleEdgeWidths,
  fetchExtendedSignDataUrl,
  JSESH_NODE_COLOR,
  LEMMA_CLASSIFIER_EDGE_COLOR,
  CLASSIFIER_COOCCURRENCE_EDGE_COLOR,
  CLF_NODE_WIDTH,
  CLF_NODE_HEIGHT,
  CLF_NODE_RADIUS,
  getLemmaNodeFontFace,
  wrapClassifierImage,
  limitNetworkToTopClassifiers,
  NETWORK_TOP_CLASSIFIER_LIMIT,
  TOP_CLASSIFIER_LIMIT_DISCLAIMER,
  NetworkConfig
} from "@/lib/networkUtils";
import { fetchJseshBase64, getJseshImageUrl, getJseshRenderHeight } from "@/lib/jsesh";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import Citation from "@/components/Citation";
import ReportActions from "@/components/ReportActions";
import ClassifierLabel from "@/components/ClassifierLabel";
import { mdc2uni } from "@/lib/mdc2uni";
import { useProjectIdOrOverride } from "@/hooks/useProjectIdOrOverride";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompareNavigation } from "@/hooks/useCompareNavigation";

// Dynamically import vis-network for client-side rendering
let VisNetwork: any = null;
let VisDataSet: any = null;
const classifierImageCache = new Map<string, string>();
const BROKEN_IMAGE_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'/%3E";
const getInteractionByFrozenState = (frozen: boolean) => ({
  dragNodes: !frozen,
  dragView: !frozen,
  zoomView: !frozen,
});

function normalizeClfLevel(levelValue: unknown): number {
  return normalizeClassifierLevelNumber(levelValue);
}

export default function ProjectLanding() {
  const { projectId: routeProjectId } = useParams<{ projectId?: string }>();
  const overrideProjectId = useProjectIdOrOverride();
  const projectId = routeProjectId || overrideProjectId;
  const navigate = useNavigate();
  const { setCompareTarget } = useCompareNavigation();

  if (!projectId) {
    return null;
  }

  // Get project data
  const { data: projectData, loading, error } = useProjectData(projectId || "");
  const projectInfo = projects.find(p => p.id === projectId) || null;
  const { clfData, clfParseData } = useMemo(
    () => buildClassifierMapsFromMetadata(projectData?.classifiers || []),
    [projectData?.classifiers]
  );
  const defaults = useMemo(() => resolveNetworkDefaults(projectInfo || undefined), [projectInfo]);
  const networkUseUnicodeDefault = projectInfo?.type === "hieroglyphic"
    ? false
    : defaults.useUnicode;
  const useAllData = defaults.useAllData;
  const [showTokenCounts, setShowTokenCounts] = useState(true);
  const [showLemmaCounts, setShowLemmaCounts] = useState(true);
  const [landingTab, setLandingTab] = useState("network");

  // Network state
  const networkRef = useRef<HTMLDivElement>(null);
  const networkCardRef = useRef<HTMLDivElement>(null);
  const networkInstanceRef = useRef<any>(null);
  const networkTokenRef = useRef(0);
  const networkProjectRef = useRef<string | null>(null);
  const [visReady, setVisReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [edgeScale, setEdgeScale] = useState(1);
  const [isNetworkFrozen, setIsNetworkFrozen] = useState(false);
  const [isNetworkFullscreen, setIsNetworkFullscreen] = useState(false);
  const [isTopClassifierLimitActive, setIsTopClassifierLimitActive] = useState(false);

  const classifierFontFace = useMemo(() => {
    if (projectInfo?.type === "cuneiform") return "cuneiform";
    if (projectInfo?.type === "chinese") return "Noto Sans TC";
    if (projectInfo?.type === "hieroglyphic") {
      return networkUseUnicodeDefault ? "eot" : "hierofont";
    }
    return "sans-serif";
  }, [projectInfo?.type, networkUseUnicodeDefault]);

  const lemmaFontFace = getLemmaNodeFontFace(projectInfo?.type);

  const openLemma = useCallback(
    (lemmaId: string | number) => {
      const numericId = typeof lemmaId === "number" ? lemmaId : parseInt(String(lemmaId), 10);
      if (setCompareTarget({ type: "lemma", lemmaId: Number.isFinite(numericId) ? numericId : undefined })) return;
      navigate(`/project/${projectId}/lemma/${lemmaId}`);
    },
    [navigate, projectId, setCompareTarget]
  );

  const openClassifier = useCallback(
    (classifier: string) => {
      if (setCompareTarget({ type: "classifier", classifier })) return;
      navigate(`/project/${projectId}/classifier?classifier=${encodeURIComponent(classifier)}`);
    },
    [navigate, projectId, setCompareTarget]
  );

  const openNetwork = useCallback(() => {
    if (setCompareTarget({ type: "network" })) return;
    navigate(`/project/${projectId}/network`);
  }, [navigate, projectId, setCompareTarget]);

  const openReportType = useCallback(
    (type: "project" | "network" | "lemma" | "classifier" | "query") => {
      if (setCompareTarget({ type })) return;
      if (type === "project") {
        navigate(`/project/${projectId}`);
      } else if (type === "network") {
        navigate(`/project/${projectId}/network`);
      } else if (type === "lemma") {
        navigate(`/project/${projectId}/lemma`);
      } else if (type === "classifier") {
        navigate(`/project/${projectId}/classifier`);
      } else if (type === "query") {
        navigate(`/project/${projectId}/query-report`);
      }
    },
    [navigate, projectId, setCompareTarget]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    import("vis-network/standalone")
      .then((vis) => {
        if (cancelled) return;
        VisNetwork = vis.Network;
        VisDataSet = vis.DataSet;
        setVisReady(true);
      })
      .catch(() => setVisReady(false));
    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    return () => {
      if (networkInstanceRef.current) {
        networkInstanceRef.current.destroy();
        networkInstanceRef.current = null;
      }
    };
  }, []);

  const toggleNetworkFreeze = useCallback(() => {
    if (!networkInstanceRef.current) return;
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
  }, [isNetworkFrozen]);

  // Calculate project statistics
  const projectStats = useMemo(() => {
    if (!projectData) {
      return {
        lemmaCount: 0,
        tokenCount: 0,
        classifierCount: 0,
        witnessCount: 0,
        lemmasWithClassifiers: 0,
        tokensWithClassifiers: 0
      };
    }
    
    const lemmaCount = Object.keys(projectData.lemmas || {}).length;
    const tokenCount = Object.keys(projectData.tokens || {}).length;
    const classifierSet = new Set<string>();
    const lemmasWithClassifiers = new Set<number>();
    let tokensWithClassifiers = 0;
    const useTokenCounts = useAllData || projectInfo?.type === "anatolian";
    if (!useTokenCounts && Array.isArray(projectData.classifiers)) {
      projectData.classifiers.forEach((entry: any) => {
        const classifier = entry?.clf || entry?.gardiner_number || entry?.classifier || entry?.mdc;
        if (classifier) {
          classifierSet.add(String(classifier));
        }
      });
    }
    if ((useTokenCounts || classifierSet.size === 0) && projectData.tokens) {
      Object.values(projectData.tokens).forEach((token: any) => {
        const clfs = extractClassifiersFromString(token.mdc_w_markup);
        if (clfs.length === 0) return;
        clfs.forEach((clf) => classifierSet.add(clf));
        tokensWithClassifiers += 1;
        if (typeof token?.lemma_id === "number") {
          lemmasWithClassifiers.add(token.lemma_id);
        }
      });
    } else if (projectData.tokens) {
      Object.values(projectData.tokens).forEach((token: any) => {
        const clfs = extractClassifiersFromString(token.mdc_w_markup);
        if (clfs.length === 0) return;
        tokensWithClassifiers += 1;
        if (typeof token?.lemma_id === "number") {
          lemmasWithClassifiers.add(token.lemma_id);
        }
      });
    }
    const classifierCount = classifierSet.size;
    const witnessCount = Object.keys(projectData.witnesses || {}).length;
    
    return {
      lemmaCount,
      tokenCount,
      classifierCount,
      witnessCount,
      lemmasWithClassifiers: lemmasWithClassifiers.size,
      tokensWithClassifiers
    };
  }, [projectData, projectInfo]);

  const renderLandingNetwork = useCallback(async () => {
    if (!visReady || !networkRef.current || !projectData || !projectInfo) return;
    setIsGenerating(true);
    setIsNetworkFrozen(false);
    setIsTopClassifierLimitActive(false);
    const renderToken = ++networkTokenRef.current;

    if (networkInstanceRef.current) {
      networkInstanceRef.current.destroy();
      networkInstanceRef.current = null;
    }

    const config: NetworkConfig = {
      clfLevels: new Set(defaults.clfLevels),
      clfTypes: new Set(defaults.clfTypes),
      useAllData: defaults.useAllData,
      useUnicode: networkUseUnicodeDefault,
      classifierDisplayMode: "visual",
      lemmaDisplayMode: "both",
      classifierMeanings: projectData?.classifierMeanings,
      projectId,
      projectType: projectInfo.type,
      classifierFontFace,
      lemmaFontFace
    };

    const tokenData = projectData.tokens || {};
    const lemmaData = projectData.lemmas || {};
    const witnessData = projectData.witnesses || {};

    let networkData;
    if (defaults.useAllData) {
      networkData = createMapNetworkAll(tokenData, lemmaData, witnessData, config);
    } else {
      networkData = createMapNetworkByLevelAndType(
        tokenData,
        lemmaData,
        witnessData,
        clfData,
        clfParseData,
        config
      );
    }

    const limitedNetworkResult = limitNetworkToTopClassifiers(networkData, NETWORK_TOP_CLASSIFIER_LIMIT);
    networkData = limitedNetworkResult.networkData;
    setIsTopClassifierLimitActive(limitedNetworkResult.wasLimited);

    const { edges: scaledEdges, scale } = scaleEdgeWidths(networkData.edges);
    setEdgeScale(scale);

    if (networkData.nodes.length === 0) {
      setIsGenerating(false);
      return;
    }

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

    const visNetworkData = {
      nodes: new VisDataSet(normalizedNodes),
      edges: new VisDataSet(scaledEdges)
    };

    const options = {
      ...getNetworkOptions(),
      interaction: {
        ...(getNetworkOptions().interaction || {}),
        ...getInteractionByFrozenState(false),
      },
      layout: {
        randomSeed: 2,
        improvedLayout: false
      },
      nodes: {
        ...(getNetworkOptions().nodes || {}),
        scaling: { min: 10, max: 30 },
        shadow: true,
        shapeProperties: {
          borderDashes: false,
          useImageSize: false,
          useBorderWithImage: false,
          interpolation: false
        }
      }
    } as any;

    const network = new VisNetwork(networkRef.current, visNetworkData, options);
    networkInstanceRef.current = network;
    networkProjectRef.current = projectId;
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
      setIsNetworkFrozen(true);
    };
    const finalize = () => {
      if (finalized) return;
      if (networkTokenRef.current !== renderToken) return;
      finalized = true;
      window.clearTimeout(fallbackId);
      const container = networkRef.current;
      if (container && typeof network.setSize === "function") {
        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || 500;
        network.setSize(`${width}px`, `${height}px`);
      }
      network.fit({ animation: false });
      const basePosition = network.getViewPosition();
      const baseScale = Number.isFinite(network.getScale()) ? network.getScale() : 1;
      const targetScale = Math.min(1.25, baseScale * 1.12);
      const nudgePosition = { x: basePosition.x + 18, y: basePosition.y + 10 };
      setIsGenerating(false);
      if (networkTokenRef.current !== renderToken) return;
      network.moveTo({
        position: nudgePosition,
        scale: targetScale,
        animation: { duration: 320, easingFunction: "easeInOutQuad" }
      });
      window.setTimeout(() => freezeNetworkAfterLoad(), 360);
    };
    const fallbackId = window.setTimeout(() => finalize(), 5000);
    network.once("stabilizationIterationsDone", finalize);

    if (projectInfo?.type === "hieroglyphic") {
      const classifierNodes = networkData.nodes.filter((node) => node.type === "classifier");
      await Promise.all(
        classifierNodes.map(async (node) => {
          const mdc = (node as any).mdc || node.label;
          const glyph = typeof mdc === "string" ? mdc2uni[mdc] : undefined;
          const hasUnicodeGlyph = typeof glyph === "string" && (glyph.codePointAt(0) || 0) >= 256;
          if (networkUseUnicodeDefault && hasUnicodeGlyph) return;

          const cacheKey = typeof mdc === "string" ? mdc : "";
          if (!cacheKey) return;
          const cached = classifierImageCache.get(cacheKey);
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
            return;
          }

          const base64 = await fetchJseshBase64(mdc, getJseshRenderHeight(CLF_NODE_HEIGHT), true);
          if (base64) {
            const dataUrl = wrapClassifierImage(getJseshImageUrl(base64));
            classifierImageCache.set(cacheKey || mdc, dataUrl);
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
          }
        })
      );
      finalize();
    }

    network.on("doubleClick", (params: any) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        if (nodeId.startsWith("classifier_")) {
          const classifier = nodeId.replace("classifier_", "");
          openClassifier(classifier);
        } else if (nodeId.startsWith("lemma_")) {
          const lemmaId = nodeId.replace("lemma_", "");
          openLemma(lemmaId);
        }
      }
    });
  }, [
    visReady,
    projectData,
    projectInfo,
    defaults.clfLevels,
    defaults.clfTypes,
    defaults.useAllData,
    networkUseUnicodeDefault,
    projectId,
    clfData,
    clfParseData,
    classifierFontFace,
    lemmaFontFace,
    openClassifier,
    openLemma
  ]);

  useEffect(() => {
    if (landingTab !== "network") return;
    if (networkInstanceRef.current && networkProjectRef.current === projectId) {
      networkInstanceRef.current.fit({ animation: false });
      return;
    }
    renderLandingNetwork();
  }, [landingTab, renderLandingNetwork, projectId]);

  const classifierChartData = useMemo(() => {
    if (!projectData?.tokens) return [];

    const tokenCounts: Record<string, number> = {};
    const lemmaSets: Record<string, Set<number>> = {};
    const classifierLevels: Record<string, number> = {};
    const useTokenCounts = useAllData || projectInfo?.type === "anatolian";

    if (!useTokenCounts && Array.isArray(projectData.classifiers) && projectData.classifiers.length > 0) {
      projectData.classifiers.forEach((entry: any) => {
        const classifier = entry?.clf || entry?.gardiner_number || entry?.classifier || entry?.mdc;
        if (!classifier) return;
        const key = String(classifier);
        tokenCounts[key] = (tokenCounts[key] || 0) + 1;
        // Store the classifier level from metadata
        if (!classifierLevels[key]) {
          classifierLevels[key] = normalizeClfLevel(entry?.clf_level);
        }
        const rawTokenId = typeof entry.token_id === "number"
          ? entry.token_id
          : parseInt(String(entry.token_id), 10);
        const token = Number.isFinite(rawTokenId) ? projectData.tokens[rawTokenId] : null;
        const lemmaId = token?.lemma_id;
        if (typeof lemmaId === "number") {
          if (!lemmaSets[key]) {
            lemmaSets[key] = new Set();
          }
          lemmaSets[key].add(lemmaId);
        }
      });
    } else {
      // When using token counts, we need to fetch classifier metadata to get levels
      const classifierMetaMap = new Map();
      if (projectData.classifiers && Array.isArray(projectData.classifiers)) {
        projectData.classifiers.forEach((entry: any) => {
          const classifier = entry?.clf || entry?.gardiner_number || entry?.classifier || entry?.mdc;
          if (classifier && !classifierMetaMap.has(classifier)) {
            classifierMetaMap.set(classifier, normalizeClfLevel(entry?.clf_level));
          }
        });
      }
      
      Object.values(projectData.tokens).forEach((token: any) => {
        const clfs = extractClassifiersFromString(token.mdc_w_markup);
        if (clfs.length === 0) return;
        clfs.forEach((clf) => {
          tokenCounts[clf] = (tokenCounts[clf] || 0) + 1;
          
          // Set classifier level from metadata if available
          if (!classifierLevels[clf]) {
            classifierLevels[clf] = classifierMetaMap.get(clf) !== undefined ? classifierMetaMap.get(clf) : -1;
          }
          
          const lemmaId = token?.lemma_id;
          if (typeof lemmaId === "number") {
            if (!lemmaSets[clf]) {
              lemmaSets[clf] = new Set();
            }
            lemmaSets[clf].add(lemmaId);
          }
        });
      });
    }

    // Store classifierLevels for use in sortedClassifierChartData
    (window as any).__classifierLevels = classifierLevels;

    return Object.entries(tokenCounts).map(([classifier, tokens]) => ({
      classifier,
      tokens,
      lemmas: lemmaSets[classifier]?.size || 0,
      level: classifierLevels[classifier] !== undefined ? classifierLevels[classifier] : -1
    }));
  }, [projectData, useAllData, projectInfo?.type]);

  const sortedClassifierChartData = useMemo(() => {
    if (classifierChartData.length === 0) return [];

    const allowAllLevels = projectId === "luwiancorpus" || projectId === "rinap";
    const filteredData = allowAllLevels
      ? classifierChartData
      : classifierChartData.filter((item: any) => item.level === 1);

    const sortKey = (item: { tokens: number; lemmas: number }) => {
      if (showTokenCounts && !showLemmaCounts) return item.tokens;
      if (!showTokenCounts && showLemmaCounts) return item.lemmas;
      return Math.max(item.tokens, item.lemmas);
    };
    return [...filteredData].sort((a, b) => {
      const diff = sortKey(b) - sortKey(a);
      if (diff !== 0) return diff;
      return a.classifier.localeCompare(b.classifier);
    });
  }, [classifierChartData, showTokenCounts, showLemmaCounts, projectId]);

  const classifierChartMax = useMemo(() => {
    if (sortedClassifierChartData.length === 0) {
      return { tokens: 0, lemmas: 0 };
    }
    const maxTokens = sortedClassifierChartData.reduce((max, item) => Math.max(max, item.tokens), 0);
    const maxLemmas = sortedClassifierChartData.reduce((max, item) => Math.max(max, item.lemmas), 0);
    return { tokens: maxTokens, lemmas: maxLemmas };
  }, [sortedClassifierChartData]);

  if (!projectId || !projectInfo) {
    return (
      <SidebarLayout>
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold text-red-600 mb-3">Project Not Found</h1>
          <p className="text-gray-600 mb-4">The requested project could not be found.</p>
          <Link to="/">
            <Button>← Back to Projects</Button>
          </Link>
        </div>
      </SidebarLayout>
    );
  }

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-sm text-gray-600">Loading {projectInfo.name}...</p>
        </div>
      </SidebarLayout>
    );
  }

  if (error) {
    return (
      <SidebarLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Project</h3>
          <p className="text-red-600 mb-3">{error}</p>
          <div className="flex gap-3">
            <Link to="/">
              <Button variant="outline">← Back to Projects</Button>
            </Link>
            <Button onClick={() => window.location.reload()}>
              Retry Loading
            </Button>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="max-w-[1600px] mx-auto" id="project-report-content">
        {/* Project Header */}
        <div className="mb-6">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-start gap-3">
              <Link to="/">
                <Button variant="outline" className="mt-1">← All Projects</Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold page-accent-text mb-2">{projectInfo.name}</h1>
                <p className="text-gray-600 text-sm uppercase tracking-wide mb-3">
                  {projectInfo.type} • {projectInfo.authors}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col xl:flex-row gap-4 mb-6 items-start">
            <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <Card>
                <CardHeader>
                  <CardTitle>About</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-gray-700 leading-relaxed">{projectInfo.description}</p>
                  <Citation
                    type="project"
                    projectName={projectInfo.name}
                    authors={projectInfo.authors}
                    projectId={projectId}
                    variant="compact"
                    title="Credits"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3">
                  <p> </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Card className="text-center">
                      <CardContent className="p-3">
                        <span className="egyptian-unicode text-3xl text-blue-500 mx-auto mb-2 block">𓀁</span>
                        <div className="text-2xl font-bold text-gray-900">{projectStats.classifierCount.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">Classifiers</div>
                      </CardContent>
                    </Card>
                    <Card className="text-center">
                      <CardContent className="p-3">
                        <span className="egyptian-unicode text-3xl text-green-600 mx-auto mb-2 block">𓇩</span>
                        <div className="text-2xl font-bold text-gray-900">{projectStats.witnessCount.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">Texts</div>
                      </CardContent>
                    </Card>
                    <Card className="text-center">
                      <CardContent className="p-3">
                        <span className="egyptian-unicode text-3xl text-yellow-500 mx-auto mb-2 block">𓆣</span>
                        <div className="text-2xl font-bold text-gray-900">
                          {projectStats.lemmasWithClassifiers.toLocaleString()} / {projectStats.lemmaCount.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Lemmas</div>
                        <div className="text-xs text-gray-500">Classified/All</div>
                      </CardContent>
                    </Card>
                    <Card className="text-center">
                      <CardContent className="p-3">
                        <span className="egyptian-unicode text-3xl text-pink-600 mx-auto mb-2 block">𓆈</span>
                        <div className="text-2xl font-bold text-gray-900">
                          {projectStats.tokensWithClassifiers.toLocaleString()} / {projectStats.tokenCount.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Tokens</div>
                        <div className="text-xs text-gray-500">Classified/All</div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="w-fit max-w-full xl:flex-none">
              <CardHeader>
                <CardTitle>Analysis Tools</CardTitle>
                <p className="text-sm text-gray-600">Explore this project's data</p>
              </CardHeader>
              <CardContent className="flex flex-col items-start gap-3">
                <Button
                  className="flex w-fit justify-start border-red-900 text-red-900 hover:bg-red-50"
                  variant="outline"
                  onClick={() => openReportType("network")}
                >
                  <span className="w-4 h-4 mr-2 inline-flex items-center justify-center text-base">
                    𓂀
                  </span>
                  Classifier-Lemma Network
                </Button>

                <Button
                  className="flex w-fit justify-start border-amber-500 text-amber-600 hover:bg-amber-50"
                  variant="outline"
                  onClick={() => openReportType("lemma")}
                >
                  <span className="w-4 h-4 mr-2 inline-flex items-center justify-center text-base">
                    𓆣
                  </span>
                  Lemma list
                </Button>
                <Button
                  className="flex w-fit justify-start border-blue-600 text-blue-600 hover:bg-blue-50"
                  variant="outline"
                  onClick={() => openReportType("classifier")}
                >
                  <span className="w-4 h-4 mr-2 inline-flex items-center justify-center text-base">
                    𓀁
                  </span>
                  Classifier Repertoire
                </Button>
                <Button
                  className="flex w-fit justify-start border-green-600 text-green-700 hover:bg-green-50"
                  variant="outline"
                  onClick={() => openReportType("query")}
                >
                  <span className="w-5 h-4 mr-2 inline-flex items-center justify-center text-base text-green-600">
                    攴
                  </span>
                  Query Builder
                </Button>
              </CardContent>
            </Card>
          </div>

          <Tabs value={landingTab} onValueChange={setLandingTab} className="mb-10">
            <TabsList className="mb-3">
              <TabsTrigger value="network">Classifier-Lemma Network</TabsTrigger>
              <TabsTrigger value="repertoire">Classifier Repertoire</TabsTrigger>
            </TabsList>

            <TabsContent value="network">
              <Card
                id="classifier-network"
                ref={networkCardRef}
                className={isNetworkFullscreen ? "flex flex-col h-screen w-screen max-h-none max-w-none rounded-none" : ""}
              >
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>Classifier-Lemma Network</CardTitle>
                    <div className="flex items-center gap-3">
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={isNetworkFullscreen ? exitFullscreen : goFullscreen}
                        className="border-gray-300 text-gray-900 shadow-[0_4px_0_rgba(0,0,0,0.12)] hover:shadow-[0_6px_0_rgba(0,0,0,0.16)] active:translate-y-[1px] active:shadow-[0_2px_0_rgba(0,0,0,0.16)]"
                      >
                        {isNetworkFullscreen ? "Exit fullscreen" : "Fullscreen"}
                      </Button>
                      <Button
                        size="lg"
                        onClick={openNetwork}
                        className="bg-gradient-to-b from-white to-gray-100 border border-gray-300 text-gray-900 shadow-[0_6px_0_rgba(0,0,0,0.18)] hover:shadow-[0_8px_0_rgba(0,0,0,0.22)] active:translate-y-[1px] active:shadow-[0_3px_0_rgba(0,0,0,0.2)]"
                      >
                        Open full network utilities
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    Interactive network with default settings. Scroll to zoom, drag to move.
                  </p>
                </CardHeader>
                <CardContent className={isNetworkFullscreen ? "flex flex-col flex-1 min-h-0" : ""}>
                  {isTopClassifierLimitActive && (
                    <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {TOP_CLASSIFIER_LIMIT_DISCLAIMER}
                    </div>
                  )}
                  <div className="mb-2 flex items-center justify-start">
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={toggleNetworkFreeze}
                      disabled={isGenerating || !networkInstanceRef.current}
                      className="border-gray-300 text-gray-900 font-bold shadow-[0_4px_0_rgba(0,0,0,0.12)] hover:shadow-[0_6px_0_rgba(0,0,0,0.16)] active:translate-y-[1px] active:shadow-[0_2px_0_rgba(0,0,0,0.16)]"
                    >
                      {isNetworkFrozen ? "Unfreeze network" : "Freeze network"}
                    </Button>
                  </div>
                  {(isGenerating || !visReady) && (
                    <div className="mb-2 text-xs text-gray-500">Arranging network...</div>
                  )}
                  <div className={isNetworkFullscreen ? "relative flex-1 min-h-0" : "relative"}>
                    <div
                      ref={networkRef}
                      className={isNetworkFullscreen
                        ? "w-full border border-gray-200 rounded-lg bg-white h-full"
                        : "w-full border border-gray-200 rounded-lg bg-white h-[min(70vh,720px)] min-h-[360px]"}
                    />
                    {edgeScale > 1 && (
                      <div className="absolute bottom-2 right-2 rounded border border-gray-200 bg-white/90 px-2 py-1 text-xs text-gray-600">
                        Edge scale: ÷{edgeScale.toFixed(1)}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-gray-700 font-bold">
                    <div className="flex flex-wrap items-center gap-3">
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
                    <div>Click lemma and classifier nodes to view their pages</div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="repertoire">
              <Card id="classifier-repertoire">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Classifier Repertoire
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Frequency of classifiers by tokens and lemmas in {projectInfo.name}.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="show-tokens"
                        checked={showTokenCounts}
                        onCheckedChange={(checked) => setShowTokenCounts(checked === true)}
                      />
                      <Label htmlFor="show-tokens">No. of tokens</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="show-lemmas"
                        checked={showLemmaCounts}
                        onCheckedChange={(checked) => setShowLemmaCounts(checked === true)}
                      />
                      <Label htmlFor="show-lemmas">No. of lemmas</Label>
                    </div>
                  </div>

                  {sortedClassifierChartData.length === 0 ? (
                    <p className="text-sm text-gray-500">No classifier data available for this project yet.</p>
                  ) : !showLemmaCounts && !showTokenCounts ? (
                    <p className="text-sm text-gray-500">Enable at least one series to display the chart.</p>
                  ) : (
                    <div className="max-h-[460px] overflow-y-auto rounded-lg border border-gray-200 p-3 space-y-2">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {showTokenCounts && (
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2 w-2 rounded-sm bg-pink-900" />
                            Tokens
                          </div>
                        )}
                        {showLemmaCounts && (
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2 w-2 rounded-sm bg-yellow-600" />
                            Lemmas
                          </div>
                        )}
                      </div>

                      {sortedClassifierChartData.map((item) => {
                        const tokenWidth = classifierChartMax.tokens
                          ? (item.tokens / classifierChartMax.tokens) * 100
                          : 0;
                        const lemmaWidth = classifierChartMax.lemmas
                          ? (item.lemmas / classifierChartMax.lemmas) * 100
                          : 0;
                        const isEgyptian = projectInfo.type === "hieroglyphic";
                        const glyph = isEgyptian ? (mdc2uni[item.classifier] || item.classifier) : item.classifier;
                        const displayLabel = isEgyptian ? `${glyph} (${item.classifier})` : item.classifier;
                        return (
                          <button
                            key={item.classifier}
                            type="button"
                            onClick={() => openClassifier(item.classifier)}
                            className="flex w-full items-center gap-3 rounded-md px-2 py-1 text-left text-black hover:bg-gray-50 transition-colors"
                          >
                            <div className="w-40 text-xs font-medium text-black whitespace-normal leading-tight">
                              <ClassifierLabel
                                classifier={item.classifier}
                                meanings={projectData?.classifierMeanings}
                                displayLabel={displayLabel}
                                projectType={projectInfo.type}
                                projectId={projectId}
                                className="text-black"
                                meaningClassName="text-black"
                              />
                            </div>
                            <div className="flex-1 space-y-1">
                              {showTokenCounts && (
                                <div className="h-2 rounded-sm bg-pink-100">
                                  <div
                                    className="h-2 rounded-sm bg-pink-900"
                                    style={{ width: `${tokenWidth}%` }}
                                  />
                                </div>
                              )}
                              {showLemmaCounts && (
                                <div className="h-2 rounded-sm bg-yellow-100">
                                  <div
                                    className="h-2 rounded-sm bg-yellow-600"
                                    style={{ width: `${lemmaWidth}%` }}
                                  />
                                </div>
                              )}
                            </div>
                            <div className="w-20 text-right text-[11px] text-black whitespace-nowrap">
                              {showTokenCounts && `${item.tokens.toLocaleString()} tokens`}
                              {showTokenCounts && showLemmaCounts && " • "}
                              {showLemmaCounts && `${item.lemmas.toLocaleString()} lemmas`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

        </div>

        <div className="mt-8 pt-6 border-t border-gray-300 flex justify-center gap-3">
          <ReportActions
            reportId="project-report-content"
            reportType="project"
            projectId={projectId || ""}
          />
        </div>
      </div>
    </SidebarLayout>
  );
}
