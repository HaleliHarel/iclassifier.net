import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FileText, Network, BarChart3, Search, Map as MapIcon, Download, RotateCcw, Maximize2, Pause, Play, Users } from "lucide-react";
import SidebarLayout from "@/components/SidebarLayout";
import { useProjectData } from "@/lib/dataProvider";
import { projects, resolveNetworkDefaults } from "@/lib/sampleData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buildClassifierMapsFromMetadata, createMapNetworkAll, createMapNetworkByLevelAndType, getLegacyMapOptions, createNetworkCSV, downloadNetworkCSV, NetworkConfig, extractClassifiersFromString } from "@/lib/networkUtils";
import { fetchJseshBase64, getJseshImageUrl } from "@/lib/jsesh";
import WitnessSelector from "@/components/filters/WitnessSelector";
import ScriptSelector from "@/components/filters/ScriptSelector";
import POSSelector from "@/components/filters/POSSelector";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { downloadNetworkDataWorkbook, downloadNetworkPNG, downloadNetworkSVG } from "@/lib/networkExport";
import Citation from "@/components/Citation";
import NetworkLoader from "@/components/NetworkLoader";
import ReportActions from "@/components/ReportActions";
import ClassifierLabel from "@/components/ClassifierLabel";
import { mdc2uni } from "@/lib/mdc2uni";

// Dynamically import vis-network for client-side rendering
let VisNetwork: any = null;
let VisDataSet: any = null;

const CLF_LEVEL_LABELS = [
  [1, 'Encyclopedic'],
  [2, 'Pragmatic'],
  [3, 'Derivational'],
  [4, 'Metatextual'],
  [5, 'Phonetic (incl. false etymology)']
];

const CLF_TYPE_LABELS = [
  ['taxonomic', 'Taxonomic'],
  ['taxonomic_repeater', 'Taxonomic repeater'],
  ['taxonomic_metaphoric', 'Taxonomic metaphoric'],
  ['schematic', 'Schematic'],
  ['unclear', 'Unclear'],
  ['anything', 'Any type (including unanalysed classifiers)']
];

export default function ProjectLanding() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const networkRef = useRef<HTMLDivElement>(null);
  const networkInstanceRef = useRef<any>(null);
  const networkTokenRef = useRef(0);
  const [visReady, setVisReady] = useState(false);
  const [isNetworkLoading, setIsNetworkLoading] = useState(true);
  
  // Get project data
  const { data: projectData, loading, error } = useProjectData(projectId || "");
  const projectInfo = projects.find(p => p.id === projectId) || null;
  const classifierFontFace = projectInfo?.type === "cuneiform"
    ? "cuneiform"
    : projectInfo?.type === "chinese"
      ? "Noto Sans TC"
      : projectInfo?.type === "hieroglyphic"
        ? "hierofont"
        : "sans-serif";
  const lemmaFontFace = projectInfo?.type === "cuneiform"
    ? "cuneiform"
    : projectInfo?.type === "chinese"
      ? "Noto Sans TC"
      : "Roboto";
  const defaults = useMemo(() => resolveNetworkDefaults(projectInfo || undefined), [projectInfo]);
  const availablePOS = useMemo(() => {
    const posSet = new Set<string>();
    Object.values(projectData?.tokens || {}).forEach((token: any) => {
      const value = token?.pos === null || token?.pos === undefined
        ? ""
        : String(token.pos).trim();
      if (value) {
        posSet.add(value);
      }
    });
    return Array.from(posSet).sort();
  }, [projectData?.tokens]);

  const [clfLevels, setClfLevels] = useState<Set<number>>(new Set(defaults.clfLevels));
  const [clfTypes, setClfTypes] = useState<Set<string>>(new Set(defaults.clfTypes));
  const [useAllData, setUseAllData] = useState(defaults.useAllData);
  const [selectedWitnesses, setSelectedWitnesses] = useState<Set<string>>(new Set());
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set());
  const [selectedPos, setSelectedPos] = useState<Set<string>>(new Set());
  const [useUnicode, setUseUnicode] = useState(defaults.useUnicode);
  const [fastMode, setFastMode] = useState(true);
  const [mapDrawn, setMapDrawn] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isNetworkFrozen, setIsNetworkFrozen] = useState(false);
  const [showTokenCounts, setShowTokenCounts] = useState(true);
  const [showLemmaCounts, setShowLemmaCounts] = useState(true);
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

  const classifierChartData = useMemo(() => {
    if (!projectData?.tokens) return [];

    const tokenCounts: Record<string, number> = {};
    const lemmaSets: Record<string, Set<number>> = {};
    const useTokenCounts = useAllData || projectInfo?.type === "anatolian";

    if (!useTokenCounts && Array.isArray(projectData.classifiers) && projectData.classifiers.length > 0) {
      projectData.classifiers.forEach((entry: any) => {
        const classifier = entry?.clf || entry?.gardiner_number || entry?.classifier || entry?.mdc;
        if (!classifier) return;
        const key = String(classifier);
        tokenCounts[key] = (tokenCounts[key] || 0) + 1;
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
      Object.values(projectData.tokens).forEach((token: any) => {
        const clfs = extractClassifiersFromString(token.mdc_w_markup);
        if (clfs.length === 0) return;
        clfs.forEach((clf) => {
          tokenCounts[clf] = (tokenCounts[clf] || 0) + 1;
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

    return Object.entries(tokenCounts).map(([classifier, tokens]) => ({
      classifier,
      tokens,
      lemmas: lemmaSets[classifier]?.size || 0
    }));
  }, [projectData]);

  const sortedClassifierChartData = useMemo(() => {
    if (classifierChartData.length === 0) return [];
    const sortKey = (item: { tokens: number; lemmas: number }) => {
      if (showTokenCounts && !showLemmaCounts) return item.tokens;
      if (!showTokenCounts && showLemmaCounts) return item.lemmas;
      return Math.max(item.tokens, item.lemmas);
    };
    return [...classifierChartData].sort((a, b) => {
      const diff = sortKey(b) - sortKey(a);
      if (diff !== 0) return diff;
      return a.classifier.localeCompare(b.classifier);
    });
  }, [classifierChartData, showTokenCounts, showLemmaCounts]);

  const classifierChartMax = useMemo(() => {
    if (sortedClassifierChartData.length === 0) {
      return { tokens: 0, lemmas: 0 };
    }
    const maxTokens = sortedClassifierChartData.reduce((max, item) => Math.max(max, item.tokens), 0);
    const maxLemmas = sortedClassifierChartData.reduce((max, item) => Math.max(max, item.lemmas), 0);
    return { tokens: maxTokens, lemmas: maxLemmas };
  }, [sortedClassifierChartData]);

  useEffect(() => {
    setClfLevels(new Set(defaults.clfLevels));
    setClfTypes(new Set(defaults.clfTypes));
    setUseAllData(defaults.useAllData);
    setUseUnicode(defaults.useUnicode);
    setSelectedWitnesses(new Set());
    setSelectedScripts(new Set());
    setSelectedPos(new Set());
    setMapDrawn(false);
    setIsNetworkFrozen(false);
    if (networkInstanceRef.current) {
      networkInstanceRef.current.destroy();
    }
  }, [defaults]);

  // Initialize semantic/lexical classifier network
  useEffect(() => {
    if (VisNetwork && VisDataSet) {
      setVisReady(true);
      return;
    }
    import('vis-network/standalone').then((vis) => {
      VisNetwork = vis.Network;
      VisDataSet = vis.DataSet;
      setVisReady(true);
    }).catch(() => setVisReady(false));
  }, []);

  const toggleLevel = useCallback((level: number, checked: boolean) => {
    setClfLevels(prev => {
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
    setClfTypes(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(type);
      } else {
        next.delete(type);
      }
      return next;
    });
  }, []);

  const toggleBackgroundColor = useCallback(() => {
    if (!networkRef.current) return;
    const current = networkRef.current.style.backgroundColor || "white";
    networkRef.current.style.backgroundColor = current === "white" ? "black" : "white";
  }, []);

  const goFullscreen = useCallback(() => {
    if (networkRef.current?.requestFullscreen) {
      networkRef.current.requestFullscreen();
    }
  }, []);

  const toggleNetworkFreeze = useCallback(() => {
    if (!networkInstanceRef.current) return;
    if (isNetworkFrozen) {
      networkInstanceRef.current.setOptions({ physics: { enabled: true } });
      if (typeof networkInstanceRef.current.startSimulation === "function") {
        networkInstanceRef.current.startSimulation();
      }
    } else {
      if (typeof networkInstanceRef.current.stopSimulation === "function") {
        networkInstanceRef.current.stopSimulation();
      }
      networkInstanceRef.current.setOptions({ physics: { enabled: false } });
    }
    setIsNetworkFrozen(!isNetworkFrozen);
  }, [isNetworkFrozen]);

  const handleDownloadCSV = useCallback(() => {
    if (!mapDrawn) return;
    const csvContent = createNetworkCSV(
      currentNetworkData.lemEdgeDict,
      currentNetworkData.clfEdgeDict,
      projectData?.lemmas || {}
    );
    downloadNetworkCSV(csvContent, `${projectId}_network_data.csv`);
  }, [mapDrawn, currentNetworkData, projectData, projectId]);

  const generateNetwork = useCallback(async (forceAll: boolean = useAllData) => {
    if (!projectData || !visReady || !VisNetwork || !VisDataSet || !networkRef.current) return;
    if (!Object.keys(projectData.tokens || {}).length) return;

    setIsGenerating(true);
    setIsNetworkLoading(true);
    let renderToken = 0;

    try {
      if (networkInstanceRef.current) {
        networkInstanceRef.current.destroy();
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
        classifierFontFace,
        lemmaFontFace,
        classifierMeanings: projectData?.classifierMeanings,
        lemmaLabelMode: "transliteration",
        maxNodes: fastMode ? 400 : undefined
      };

      const { clfData, clfParseData } = buildClassifierMapsFromMetadata(projectData.classifiers || []);
      const hasClassifierMetadata = Object.keys(clfData).length > 0;

      let networkData = null;
      if (forceAll || !hasClassifierMetadata) {
        networkData = createMapNetworkAll(projectData.tokens, projectData.lemmas, projectData.witnesses, config);
      } else {
        networkData = createMapNetworkByLevelAndType(
          projectData.tokens,
          projectData.lemmas,
          projectData.witnesses,
          clfData,
          clfParseData,
          config
        );
      }

      setCurrentNetworkData({
        lemEdgeDict: networkData?.lemEdgeDict || {},
        clfEdgeDict: networkData?.clfEdgeDict || {},
        clfNodeDict: networkData?.clfNodeDict || {},
        lemNodeDict: networkData?.lemNodeDict || {}
      });
      setExportNetworkData({
        nodes: networkData?.nodes || [],
        edges: networkData?.edges || []
      });

      if (!networkData || networkData.nodes.length === 0) {
        setIsNetworkLoading(false);
        setIsGenerating(false);
        setMapDrawn(false);
        return;
      }

      const nodes = new VisDataSet(networkData.nodes);
      const edges = new VisDataSet(networkData.edges);
      const data = { nodes, edges };

      const options = {
        ...getLegacyMapOptions(),
        physics: {
          enabled: true,
          stabilization: {
            iterations: fastMode ? 60 : 120,
            updateInterval: 30,
            fit: true
          }
        },
        nodes: {
          shadow: !fastMode
        }
      };
      const network = new VisNetwork(networkRef.current, data, options);
      networkInstanceRef.current = network;
      setMapDrawn(true);
      let finalized = false;
      const finalize = () => {
        if (finalized) return;
        if (networkTokenRef.current !== renderToken) return;
        finalized = true;
        window.clearTimeout(fallbackId);
        network.fit();
        network.setOptions({ physics: { enabled: false } });
        if (typeof network.stopSimulation === "function") {
          network.stopSimulation();
        }
        setIsNetworkFrozen(true);
        setIsNetworkLoading(false);
        setIsGenerating(false);
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
            if (useUnicode && hasUnicodeGlyph) return;
            const base64 = await fetchJseshBase64(mdc, 50, true);
            if (!base64) return;
            if (networkTokenRef.current !== renderToken) return;
            nodes.update({
              id: node.id,
              shape: "image",
              image: getJseshImageUrl(base64),
              size: 20,
              color: { background: "beige", border: "beige" },
              shapeProperties: { useBorderWithImage: true, interpolation: true }
            });
          })
        ).catch(() => undefined);
        finalize();
      }

      network.on("click", (params: any) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          const node = nodes.get(nodeId);
          if (node && node.type === 'lemma') {
            const lemmaId = nodeId.replace("lemma_", "");
            navigate(`/project/${projectId}/lemma/${lemmaId}`);
          } else if (node && node.type === 'classifier') {
            const classifier = nodeId.replace("classifier_", "");
            navigate(`/project/${projectId}/classifier/${encodeURIComponent(classifier)}`);
          }
        }
      });
    } catch (err) {
      if (networkTokenRef.current !== renderToken) return;
      console.error('Error creating network:', err);
      setIsNetworkLoading(false);
      setIsGenerating(false);
    }
  }, [
    projectData,
    visReady,
    clfLevels,
    clfTypes,
    selectedWitnesses,
    selectedScripts,
    selectedPos,
    useUnicode,
    classifierFontFace,
    lemmaFontFace,
    navigate,
    projectId,
    projectInfo?.type,
    useAllData,
    fastMode
  ]);

  useEffect(() => {
    if (!mapDrawn && !isGenerating && projectData && Object.keys(projectData.tokens || {}).length > 0) {
      generateNetwork(useAllData);
    }
  }, [mapDrawn, isGenerating, projectData, generateNetwork, useAllData]);

  useEffect(() => {
    if (!mapDrawn || isGenerating) return;
    generateNetwork(useAllData);
  }, [useAllData, fastMode, mapDrawn, isGenerating, generateNetwork]);

  if (!projectId || !projectInfo) {
    return (
      <SidebarLayout>
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Project Not Found</h1>
          <p className="text-gray-600 mb-6">The requested project could not be found.</p>
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
          <NetworkLoader
            title="Loading Project Data"
            subtitle={`Preparing ${projectInfo.name} corpus...`}
          />
        </div>
      </SidebarLayout>
    );
  }

  if (error) {
    return (
      <SidebarLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Project</h3>
          <p className="text-red-600 mb-4">{error}</p>
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
      <div className="max-w-7xl mx-auto" id="project-report-content">
        {/* Project Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-start gap-4">
              <Link to="/">
                <Button variant="outline" className="mt-1">← All Projects</Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold page-accent-text mb-2">{projectInfo.name}</h1>
                <p className="text-gray-600 text-sm uppercase tracking-wide mb-4">
                  {projectInfo.type} • {projectInfo.authors}
                </p>
              </div>
            </div>
          </div>
          
          <p className="text-gray-700 leading-relaxed mb-6">{projectInfo.description}</p>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="text-center">
              <CardContent className="p-4">
                <span className="egyptian-unicode text-3xl text-blue-600 mx-auto mb-2 block">𓆣</span>
                <div className="text-2xl font-bold text-gray-900">
                  {projectStats.lemmasWithClassifiers.toLocaleString()} / {projectStats.lemmaCount.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Lemmas</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-4">
                <span className="egyptian-unicode text-3xl text-green-600 mx-auto mb-2 block">𓆈</span>
                <div className="text-2xl font-bold text-gray-900">
                  {projectStats.tokensWithClassifiers.toLocaleString()} / {projectStats.tokenCount.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Tokens</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-4">
                <span className="egyptian-unicode text-3xl text-purple-600 mx-auto mb-2 block">𓀁</span>
                <div className="text-2xl font-bold text-gray-900">{projectStats.classifierCount.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Classifiers</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-4">
                <span className="egyptian-unicode text-3xl text-orange-600 mx-auto mb-2 block">𓇩</span>
                <div className="text-2xl font-bold text-gray-900">{projectStats.witnessCount.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Witnesses</div>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-8" id="classifier-repertoire">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Classifier Repertoire
              </CardTitle>
              <p className="text-sm text-gray-600">
                Frequency of classifiers by tokens and lemmas in {projectInfo.name}.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center gap-4 text-sm">
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
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {showTokenCounts && (
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-sm bg-indigo-900" />
                        Tokens
                      </div>
                    )}
                    {showLemmaCounts && (
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-sm bg-blue-600" />
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
                      <Link
                        key={item.classifier}
                        to={`/project/${projectId}/classifier/${encodeURIComponent(item.classifier)}`}
                        className="flex items-center gap-3 rounded-md px-2 py-1 hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-24 text-xs font-medium text-gray-700 truncate">
                          <ClassifierLabel
                            classifier={item.classifier}
                            meanings={projectData?.classifierMeanings}
                            displayLabel={displayLabel}
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          {showTokenCounts && (
                            <div className="h-2 rounded-sm bg-indigo-100">
                              <div
                                className="h-2 rounded-sm bg-indigo-900"
                                style={{ width: `${tokenWidth}%` }}
                              />
                            </div>
                          )}
                          {showLemmaCounts && (
                            <div className="h-2 rounded-sm bg-blue-100">
                              <div
                                className="h-2 rounded-sm bg-blue-600"
                                style={{ width: `${lemmaWidth}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="w-24 text-right text-[11px] text-gray-500">
                          {showTokenCounts && `${item.tokens.toLocaleString()} tok`}
                          {showTokenCounts && showLemmaCounts && " • "}
                          {showLemmaCounts && `${item.lemmas.toLocaleString()} lem`}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Network Visualization */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="w-5 h-5" />
                  Semantic/Lexical Classifier Network
                  <Badge variant="secondary" className="ml-2">Live Preview</Badge>
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Interactive network showing taxonomic and semantic relationships in {projectInfo.name}
                </p>
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  <p>Classifier nodes: beige. Lemma nodes: white with black borders.</p>
                  <p>Blue edges connect classifiers and lemmas; red edges connect co-occurring classifiers.</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <div 
                    ref={networkRef}
                    className="w-full h-[70vh] min-h-[520px] border rounded-lg bg-white"
                    style={{ border: '1px solid #e5e7eb' }}
                  />
                  {isNetworkLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
                      <div className="text-center">
                        <NetworkLoader
                          className="scale-75"
                          title="Building semantic network..."
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    Click nodes to explore lemmas • Drag to navigate • Scroll to zoom
                  </p>
                  <Link to={`/project/${projectId}/map-report`}>
                    <Button variant="outline" size="sm">
                      <MapIcon className="w-4 h-4 mr-1" />
                      Advanced Network
                    </Button>
                  </Link>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleNetworkFreeze}
                    className="flex items-center gap-1"
                  >
                    {isNetworkFrozen ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                    {isNetworkFrozen ? "Unfreeze" : "Freeze"}
                  </Button>
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
                    onClick={goFullscreen}
                    className="flex items-center gap-1"
                  >
                    <Maximize2 className="w-3 h-3" />
                    Fullscreen
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
                    onClick={() => downloadNetworkPNG(networkInstanceRef.current, 96, `${projectId}-network-96dpi.png`)}
                    className="flex items-center gap-1"
                  >
                    PNG 96
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadNetworkPNG(networkInstanceRef.current, 300, `${projectId}-network-300dpi.png`)}
                    className="flex items-center gap-1"
                  >
                    PNG 300
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadNetworkSVG(networkInstanceRef.current, `${projectId}-network.svg`)}
                    className="flex items-center gap-1"
                  >
                    SVG
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadNetworkDataWorkbook(exportNetworkData.nodes, exportNetworkData.edges, `${projectId}-network-data.xls`)}
                    className="flex items-center gap-1"
                  >
                    Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analysis Tools */}
          <div>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Analysis Tools</CardTitle>
                <p className="text-sm text-gray-600">Explore this project's data</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link to={`/project/${projectId}/lemma`} className="block">
                  <Button className="w-full justify-start" variant="outline">
                    <FileText className="w-4 h-4 mr-2" />
                    Lemma list
                  </Button>
                </Link>
                <Link to={`/project/${projectId}/classifier`} className="block">
                  <Button className="w-full justify-start" variant="outline">
                    <Users className="w-4 h-4 mr-2" />
                    Classifier Repertoire
                  </Button>
                </Link>
                <Link to={`/project/${projectId}/query-report`} className="block">
                  <Button className="w-full justify-start" variant="outline">
                    <Search className="w-4 h-4 mr-2" />
                    Query Builder
                  </Button>
                </Link>
                <Link to={`/project/${projectId}/map-report`} className="block">
                  <Button className="w-full justify-start" variant="outline">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Macro Classifier-Lemma Network 
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Citation
              type="project"
              projectName={projectInfo.name}
              authors={projectInfo.authors}
              projectId={projectId}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Information Types</CardTitle>
              <p className="text-sm text-gray-600">Select classifier information levels to include</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {CLF_LEVEL_LABELS.map(([level, label]) => (
                <div key={level} className="flex items-center space-x-2">
                  <Checkbox
                    id={`landing-level-${level}`}
                    checked={clfLevels.has(level as number)}
                    onCheckedChange={(checked) => toggleLevel(level as number, checked as boolean)}
                  />
                  <Label htmlFor={`landing-level-${level}`} className="text-sm">
                    {label}
                  </Label>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Classifier Types</CardTitle>
              <p className="text-sm text-gray-600">Select classifier types to include</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {CLF_TYPE_LABELS.map(([type, label]) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`landing-type-${type}`}
                    checked={clfTypes.has(type)}
                    onCheckedChange={(checked) => toggleType(type, checked as boolean)}
                  />
                  <Label htmlFor={`landing-type-${type}`} className="text-sm">
                    {label}
                  </Label>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Text Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <WitnessSelector
                witnessData={projectData.witnesses || {}}
                selectedWitnesses={selectedWitnesses}
                setSelectedWitnesses={setSelectedWitnesses}
                projectType={projectInfo.type}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Script Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <ScriptSelector
                witnessData={projectData.witnesses || {}}
                selectedScripts={selectedScripts}
                setSelectedScripts={setSelectedScripts}
                projectType={projectInfo.type}
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

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="w-4 h-4" />
              Network Generation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <Button
                onClick={() => {
                  setUseAllData(false);
                  generateNetwork(false);
                }}
                disabled={isGenerating}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {isGenerating ? "Generating..." : "Draw with Selected Filters"}
              </Button>
              <Button
                onClick={() => {
                  setUseAllData(true);
                  generateNetwork(true);
                }}
                disabled={isGenerating}
                variant="outline"
              >
                {isGenerating ? "Generating..." : "Draw with All Data (Unanalysed)"}
              </Button>
              {projectInfo.id !== 'egyptian' && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="landing-use-unicode"
                    checked={useUnicode}
                    onCheckedChange={(checked) => setUseUnicode(checked as boolean)}
                  />
                  <Label htmlFor="landing-use-unicode" className="text-sm">
                    Use Unicode glyphs for hieroglyphs when available
                  </Label>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="landing-fast-mode"
                  checked={fastMode}
                  onCheckedChange={(checked) => setFastMode(checked as boolean)}
                />
                <Label htmlFor="landing-fast-mode" className="text-sm">
                  Fast mode (max 400 nodes)
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-12 pt-8 border-t border-gray-300 flex justify-center gap-4">
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
