import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download, Network as NetworkIcon, RotateCcw, Maximize2, Pause, Play, Info } from "lucide-react";
import SidebarLayout from "@/components/SidebarLayout";
import { useProjectData } from "@/lib/dataProvider";
import { projects, resolveNetworkDefaults } from "@/lib/sampleData";
import { useCurrentProjectId } from "@/lib/projectContext";
import { fetchJseshBase64, getJseshImageUrl } from "@/lib/jsesh";
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
  createNetworkCSV,
  downloadNetworkCSV,
  NetworkConfig
} from "@/lib/networkUtils";
import { downloadNetworkDataWorkbook, downloadNetworkPNG, downloadNetworkSVG } from "@/lib/networkExport";
import NotFound from "@/pages/NotFound";
import ReportActions from "@/components/ReportActions";
import NetworkLoader from "@/components/NetworkLoader";

// Dynamically import vis-network for client-side rendering
let VisNetwork: any = null;
let VisDataSet: any = null;

const CLF_LEVEL_LABELS = [
  [1, 'Encyclopedic (also Semantic, Lexical)'],
  [2, 'Pragmatic (also referent classifier)'],
  [3, 'Derivational (also Grammatical)'],
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

export default function NetworkMapReport() {
  const navigate = useNavigate();
  const { projectId: urlProjectId } = useParams();
  const currentProjectId = useCurrentProjectId();
  
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
  const classifierFontFace = selectedProjectInfo?.type === "cuneiform"
    ? "cuneiform"
    : selectedProjectInfo?.type === "chinese"
      ? "Noto Sans TC"
      : selectedProjectInfo?.type === "hieroglyphic"
        ? "hierofont"
        : "sans-serif";
  const lemmaFontFace = selectedProjectInfo?.type === "cuneiform"
    ? "cuneiform"
    : selectedProjectInfo?.type === "chinese"
      ? "Noto Sans TC"
      : "Roboto";
  
  // Filter states for network generation
  const defaults = resolveNetworkDefaults(selectedProjectInfo || undefined);
  const [clfLevels, setClfLevels] = useState<Set<number>>(new Set(defaults.clfLevels));
  const [clfTypes, setClfTypes] = useState<Set<string>>(new Set(defaults.clfTypes));
  const [useAllData, setUseAllData] = useState(defaults.useAllData);
  const [selectedWitnesses, setSelectedWitnesses] = useState<Set<string>>(new Set());
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set());
  const [selectedPos, setSelectedPos] = useState<Set<string>>(new Set());
  const [useUnicode, setUseUnicode] = useState(defaults.useUnicode);
  const [fastMode, setFastMode] = useState(false);
  const [visReady, setVisReady] = useState(false);
  
  // Network state
  const networkRef = useRef<HTMLDivElement>(null);
  const networkInstanceRef = useRef<any>(null);
  const networkTokenRef = useRef(0);
  const [mapDrawn, setMapDrawn] = useState(false);
  const [isNetworkFrozen, setIsNetworkFrozen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [networkType, setNetworkType] = useState<'all' | 'filtered'>('filtered');
  
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
    setSelectedWitnesses(new Set());
    setSelectedScripts(new Set());
    setSelectedPos(new Set());
    const nextDefaults = resolveNetworkDefaults(selectedProjectInfo || undefined);
    setClfLevels(new Set(nextDefaults.clfLevels));
    setClfTypes(new Set(nextDefaults.clfTypes));
    setUseAllData(nextDefaults.useAllData);
    setUseUnicode(nextDefaults.useUnicode);
    setMapDrawn(false);
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

  // Generate network based on current settings
  const generateNetwork = useCallback(async (useAll: boolean = false) => {
    if (loading || !projectData) return;
    if (!Object.keys(tokenData).length) return;
    if (!visReady || !networkRef.current || !VisNetwork || !VisDataSet) {
      console.warn('Network libraries not loaded yet');
      return;
    }

    setIsGenerating(true);
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
        classifierFontFace,
        lemmaFontFace,
        classifierMeanings: projectData?.classifierMeanings,
        lemmaLabelMode: "transliteration",
        maxNodes: fastMode ? 400 : undefined
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

      // Store data for CSV export
      setCurrentNetworkData({
        lemEdgeDict: networkData.lemEdgeDict,
        clfEdgeDict: networkData.clfEdgeDict,
        clfNodeDict: networkData.clfNodeDict,
        lemNodeDict: networkData.lemNodeDict
      });
      setExportNetworkData({
        nodes: networkData.nodes,
        edges: networkData.edges
      });

      if (networkData.nodes.length === 0) {
        console.warn('No network nodes to display');
        setIsGenerating(false);
        return;
      }

      // Create network
      const visNetworkData = {
        nodes: new VisDataSet(networkData.nodes),
        edges: new VisDataSet(networkData.edges)
      };

      const options = {
        ...getNetworkOptions(),
        layout: {
          randomSeed: 2,
          improvedLayout: false
        },
        nodes: {
          ...(getNetworkOptions().nodes || {}),
          scaling: { min: 10, max: 30 },
          shadow: !fastMode
        }
      } as any;

      if (fastMode) {
        options.physics = {
          ...(options.physics || {}),
          stabilization: { iterations: 40, updateInterval: 30, fit: true },
          barnesHut: {
            springConstant: 0.02,
            avoidOverlap: 0.5
          }
        };
      }
      
      const network = new VisNetwork(networkRef.current, visNetworkData, options);
      networkInstanceRef.current = network;
      setMapDrawn(true);
      let finalized = false;
      const finalize = () => {
        if (finalized) return;
        if (networkTokenRef.current !== renderToken) return;
        finalized = true;
        window.clearTimeout(fallbackId);
        network.fit({ animation: { duration: 500, easingFunction: "easeInOutQuad" } });
        network.setOptions({ physics: { enabled: false } });
        if (typeof network.stopSimulation === "function") {
          network.stopSimulation();
        }
        setIsNetworkFrozen(true);
        setIsGenerating(false);
      };
      const fallbackId = window.setTimeout(() => finalize(), 5000);
      network.once("stabilizationIterationsDone", finalize);

      if (selectedProjectInfo?.type === "hieroglyphic") {
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
            visNetworkData.nodes.update({
              id: node.id,
              shape: "image",
              image: getJseshImageUrl(base64),
              size: 20,
              color: { background: "beige", border: "beige" },
              shapeProperties: { useBorderWithImage: true, interpolation: true }
            });
          })
        );
        finalize();
      }

      // Handle node clicks for navigation
      network.on('click', (params: any) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          if (nodeId.startsWith('classifier_')) {
            const classifier = nodeId.replace('classifier_', '');
            navigate(`/project/${selectedProject}/classifier?classifier=${encodeURIComponent(classifier)}`);
          } else if (nodeId.startsWith('lemma_')) {
            const lemmaId = nodeId.replace('lemma_', '');
            navigate(`/project/${selectedProject}/lemma/${lemmaId}`);
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
    selectedPos, useUnicode, fastMode, tokenData, lemmaData, witnessData, clfData, clfParseData, 
    navigate, selectedProject, selectedProjectInfo, projectData, loading, visReady
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
    if (networkRef.current && networkRef.current.requestFullscreen) {
      networkRef.current.requestFullscreen();
    }
  }, []);

  // Toggle network physics
  const toggleNetworkFreeze = useCallback(() => {
    if (networkInstanceRef.current) {
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
      <div className="space-y-6" id="network-report-content">
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/project/${selectedProject}/lemma`)}
            >
              📄 Lemma Report
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/project/${selectedProject}/classifier`)}
            >
              📊 Classifier Report
            </Button>
          </div>
        </div>

        {/* Network Visualization */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Interactive Network Map</span>
              {mapDrawn && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleNetworkFreeze}
                    className="flex items-center gap-1"
                  >
                    {isNetworkFrozen ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                    {isNetworkFrozen ? 'Unfreeze' : 'Freeze'}
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
                    onClick={() => downloadNetworkPNG(networkInstanceRef.current, 96, `${selectedProject}-network-96dpi.png`)}
                    className="flex items-center gap-1"
                  >
                    PNG 96
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadNetworkPNG(networkInstanceRef.current, 300, `${selectedProject}-network-300dpi.png`)}
                    className="flex items-center gap-1"
                  >
                    PNG 300
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadNetworkSVG(networkInstanceRef.current, `${selectedProject}-network.svg`)}
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
                </div>
              )}
            </CardTitle>
            {!mapDrawn && (
              <p className="text-sm text-gray-600">
                Configure filters below and click "Draw" to generate the network visualization
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div 
                ref={networkRef}
                className="w-full border border-gray-200 rounded-lg bg-white"
                style={{ 
                  height: '70vh',
                  minHeight: '600px'
                }}
              />
              {isGenerating && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/75">
                  <NetworkLoader title="Building network..." />
                </div>
              )}
            </div>
            {mapDrawn && (
              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-white border border-black rounded-full"></div>
                    <span>Lemmas</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-[beige] border border-[beige] rounded"></div>
                    <span>Classifiers</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-8 h-0.5 bg-blue-600"></div>
                    <span>Lemma-Classifier Links</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-8 h-0.5 bg-[brown]"></div>
                    <span>Classifier Co-occurrence</span>
                  </div>
                </div>
                <span>Drag nodes • Scroll to zoom • Click to navigate</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              {CLF_LEVEL_LABELS.map(([level, label]) => (
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
              {CLF_TYPE_LABELS.map(([type, label]) => (
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
            <CardTitle className="text-base flex items-center gap-2">
              <NetworkIcon className="w-4 h-4" />
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
                {isGenerating ? 'Generating...' : 'Draw with Selected Filters'}
              </Button>
              <Button
                onClick={() => {
                  setUseAllData(true);
                  generateNetwork(true);
                }}
                disabled={isGenerating}
                variant="outline"
              >
                {isGenerating ? 'Generating...' : 'Draw with All Data (Unanalysed)'}
              </Button>
              
              {/* Project-specific controls */}
              {selectedProjectInfo?.id !== 'egyptian' && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="use-unicode"
                    checked={useUnicode}
                    onCheckedChange={(checked) => setUseUnicode(checked as boolean)}
                  />
                  <Label htmlFor="use-unicode" className="text-sm">
                    Use Unicode glyphs for hieroglyphs when available
                  </Label>
                </div>
              )}
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
            </div>
          </CardContent>
        </Card>

        <div className="mt-12 pt-8 border-t border-gray-300 flex justify-center gap-4">
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
