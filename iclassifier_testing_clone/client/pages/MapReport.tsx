import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Download, MapPin, Network, Settings } from "lucide-react";
import SidebarLayout from "@/components/SidebarLayout";
import VisNetwork from "@/components/VisNetwork";
import WitnessSelector from "@/components/filters/WitnessSelector";
import ScriptSelector from "@/components/filters/ScriptSelector";
import POSSelector from "@/components/filters/POSSelector";
import Citation from "@/components/Citation";
import ReportActions from "@/components/ReportActions";
import { cn } from "@/lib/utils";
import { extractClassifiersFromString } from "@/lib/networkUtils";
import { useProjectData, useAvailableProjects } from "@/lib/api";
import {
  projects,
  type Witness,
  posArr,
  tokenData as sampleTokenData,
  lemmaData as sampleLemmaData,
  witnessData as sampleWitnessData,
} from "@/lib/sampleData";

interface WitnessStats {
  witness: Witness;
  tokenCount: number;
  lemmaCount: number;
  classifierCount: number;
  classifiers: Set<string>;
}

export default function MapReport() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId: urlProjectId } = useParams();
  
  // Fetch available projects
  // const { data: availableProjectIds } = useAvailableProjects();

  // Map project IDs to project metadata
  const getAvailableProjects = projects.slice(0, 3); // Use first 3 projects for demo

  // Determine initial project (URL param first, then first available, or fallback)
  const initialProject = useMemo(() => {
    if (urlProjectId) return urlProjectId;
    if (getAvailableProjects.length > 0) return getAvailableProjects[0].id;
    return "ancient-egyptian";
  }, [urlProjectId, getAvailableProjects]);

  const [selectedProjectId, setSelectedProjectId] = useState("classifyingtheother");
  // const { data: projectData, loading, error } = useProjectData(selectedProjectId);
  // const selectedProjectInfo = getAvailableProjects.find(p => p.id === selectedProjectId);
  const selectedProjectInfo = projects.find(p => p.id === selectedProjectId);

  // Update URL when project changes
  useEffect(() => {
    if (!location.pathname.includes("/network")) return;
    if (selectedProjectId) {
      const targetPath = `/project/${selectedProjectId}/network`;
      if (window.location.pathname !== targetPath) {
        navigate(targetPath, { replace: true });
      }
    }
  }, [selectedProjectId, navigate, location.pathname]);

  // Use sample data directly for now to ensure the page loads
  const tokenData = sampleTokenData;
  const lemmaData = sampleLemmaData;
  const witnessData = sampleWitnessData;
  const clfData: any[] = [];
  
  // Mock loading and error states
  const loading = false;
  const error = null;

  // Network configuration state
  const [selectedWitnesses, setSelectedWitnesses] = useState<Set<string>>(new Set());
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set());
  const [selectedPOS, setSelectedPOS] = useState<Set<string>>(new Set());
  const [networkLoading, setNetworkLoading] = useState(false);
  
  // Classifier level filters (encyclopedic/semantic/lexical, pragmatic/referent, derivational/grammatical, etc.)
  const [clfLevels, setClfLevels] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  
  // Classifier type filters
  const [clfTypes, setClfTypes] = useState<Set<string>>(new Set([
    'taxonomic', 'taxonomic_repeater', 'taxonomic_metaphoric', 'schematic', 'unclear'
  ]));
  
  // Network drawing mode
  const [useAnalyzed, setUseAnalyzed] = useState(true);
  const [useUnicode, setUseUnicode] = useState(true);
  const [networkDrawn, setNetworkDrawn] = useState(false);

  const [selectedWitness, setSelectedWitness] = useState<string | null>(null);
  const [selectedScript, setSelectedScript] = useState<string | null>(null);

  // Extract classifiers from tokens
  const extractClassifiers = (mdc_w_markup: string | null | undefined): string[] => {
    return extractClassifiersFromString(mdc_w_markup || null);
  };

  // Get all unique scripts
  const allScripts = useMemo(() => {
    return Array.from(new Set(Object.values(witnessData).map((w) => w.script)));
  }, []);

  // Calculate witness statistics
  const witnessStats = useMemo(() => {
    const stats: Record<string, WitnessStats> = {};

    Object.values(witnessData).forEach((witness) => {
      stats[witness.id] = {
        witness,
        tokenCount: 0,
        lemmaCount: 0,
        classifierCount: 0,
        classifiers: new Set<string>(),
      };
    });

    Object.values(tokenData).forEach((token) => {
      const stat = stats[token.witness_id];
      if (stat) {
        stat.tokenCount += 1;
        extractClassifiers(token.mdc_w_markup).forEach((c) => {
          stat.classifiers.add(c);
        });
      }
    });

    Object.values(stats).forEach((stat) => {
      stat.lemmaCount = new Set(
        Object.values(tokenData)
          .filter((t) => t.witness_id === stat.witness.id)
          .map((t) => t.lemma_id)
      ).size;
      stat.classifierCount = stat.classifiers.size;
    });

    return stats;
  }, []);

  // Get filtered witnesses
  const filteredWitnesses = useMemo(() => {
    return Object.values(witnessStats)
      .filter((stat) => {
        if (selectedScript && stat.witness.script !== selectedScript) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.tokenCount - a.tokenCount);
  }, [selectedScript, witnessStats]);

  // Get lemmas for selected witness
  const selectedWitnessLemmas = useMemo(() => {
    if (!selectedWitness) return [];
    const lemmas = new Set<number>();
    Object.values(tokenData)
      .filter((t) => t.witness_id === selectedWitness)
      .forEach((t) => lemmas.add(t.lemma_id));
    return Array.from(lemmas)
      .map((id) => lemmaData[id])
      .filter(Boolean);
  }, [selectedWitness]);

  // Calculate distribution statistics
  const stats = useMemo(() => {
    const totalTokens = Object.keys(tokenData).length;
    const totalWitnesses = Object.keys(witnessStats).length;
    const totalLemmas = Object.keys(lemmaData).length;
    const scriptCounts: Record<string, number> = {};

    Object.values(witnessStats).forEach((stat) => {
      const script = stat.witness.script;
      scriptCounts[script] = (scriptCounts[script] || 0) + stat.tokenCount;
    });

    return { totalTokens, totalWitnesses, totalLemmas, scriptCounts };
  }, [witnessStats]);

  // Generate network data based on selected filters
  const networkData = useMemo(() => {
    if (!networkDrawn) return null;
    
    const clfNodeDict: Record<string, number> = {};
    const lemNodeDict: Record<string, number> = {};
    const lemEdgeDict: Record<string, number> = {};
    const clfEdgeDict: Record<string, number> = {};
    
    // Use all classifiers from token data (unanalyzed mode)
    for (const tokenId in tokenData) {
      const token = tokenData[tokenId];
      
      // Apply filters
      if (selectedWitnesses.size > 0 && !selectedWitnesses.has(String(token.witness_id))) continue;
      if (selectedScripts.size > 0) {
        const witness = witnessData[token.witness_id];
        if (!witness || !selectedScripts.has(String(witness.script))) continue;
      }
      if (selectedPOS.size > 0 && !selectedPOS.has(String(token.pos || '').trim())) continue;
      
      const clfs = extractClassifiers(token.mdc_w_markup || '');
      const lemmaId = token.lemma_id;
      
      if (clfs.length > 0 && lemmaId && lemmaData[lemmaId]) {
        // Add clf-lemma edges
        clfs.forEach(clf => {
          const edgeKey = `${clf}>${lemmaId}`;
          lemEdgeDict[edgeKey] = (lemEdgeDict[edgeKey] || 0) + 1;
        });
        
        // Add clf-clf edges for co-occurring classifiers
        for (let i = 0; i < clfs.length - 1; i++) {
          for (let j = i + 1; j < clfs.length; j++) {
            const edgeKey = `${clfs[i]}>${clfs[j]}`;
            clfEdgeDict[edgeKey] = (clfEdgeDict[edgeKey] || 0) + 1;
          }
        }
      }
    }
    
    // Build nodes and edges for vis.js
    const nodes: any[] = [];
    const edges: any[] = [];
    let nodeId = 1;
    const nodeMap: Record<string, number> = {};
    
    // Count occurrences for node sizing
    for (const key in lemEdgeDict) {
      const [clf, lemmaId] = key.split('>');
      clfNodeDict[clf] = (clfNodeDict[clf] || 0) + lemEdgeDict[key];
      lemNodeDict[lemmaId] = (lemNodeDict[lemmaId] || 0) + lemEdgeDict[key];
    }
    
    for (const key in clfEdgeDict) {
      const [clf1, clf2] = key.split('>');
      clfNodeDict[clf1] = (clfNodeDict[clf1] || 0) + clfEdgeDict[key];
      clfNodeDict[clf2] = (clfNodeDict[clf2] || 0) + clfEdgeDict[key];
    }
    
    // Add classifier nodes (beige color) - limit to top 40 most frequent
    const sortedClassifiers = Object.entries(clfNodeDict)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 40);
      
    for (const [clf, count] of sortedClassifiers) {
      const id = nodeId++;
      nodeMap[`clf_${clf}`] = id;
      nodes.push({
        id,
        label: clf,
        color: { background: 'beige', border: '#d4b896' },
        font: { 
          face: selectedProjectInfo?.type === 'hieroglyphic' ? 'hierofont' : 'monospace',
          size: 14 
        },
        size: Math.max(20, Math.min(50, Math.log(count + 1) * 8)),
        group: 'classifier',
        title: `Classifier: ${clf}\nOccurrences: ${count}`
      });
    }
    
    // Add lemma nodes (white color) - limit to top 30 most frequent
    const sortedLemmas = Object.entries(lemNodeDict)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 30);
      
    for (const [lemmaIdStr, count] of sortedLemmas) {
      const lemmaId = parseInt(lemmaIdStr);
      const lemma = lemmaData[lemmaId];
      if (lemma) {
        const id = nodeId++;
        nodeMap[`lem_${lemmaIdStr}`] = id;
        const label = lemma.meaning ? `${lemma.transliteration}\n'${lemma.meaning}'` : lemma.transliteration;
        nodes.push({
          id,
          label,
          color: { background: 'white', border: 'black' },
          font: { face: 'Roboto', size: 11 },
          size: Math.max(15, Math.min(40, Math.log(count + 1) * 6)),
          group: 'lemma',
          title: `Lemma: ${lemma.transliteration}\nMeaning: ${lemma.meaning || 'N/A'}\nOccurrences: ${count}`
        });
      }
    }
    
    // Add clf-lemma edges (solid lines)
    for (const key in lemEdgeDict) {
      const [clf, lemmaId] = key.split('>');
      const clfNodeId = nodeMap[`clf_${clf}`];
      const lemNodeId = nodeMap[`lem_${lemmaId}`];
      if (clfNodeId && lemNodeId) {
        edges.push({
          from: clfNodeId,
          to: lemNodeId,
          label: lemEdgeDict[key] > 5 ? lemEdgeDict[key].toString() : '',
          color: { color: '#4B5563' },
          width: Math.max(1, Math.min(5, Math.log(lemEdgeDict[key] + 1))),
          title: `Classifier-Lemma co-occurrence: ${lemEdgeDict[key]} times`
        });
      }
    }
    
    // Add clf-clf edges (dashed lines)
    for (const key in clfEdgeDict) {
      const [clf1, clf2] = key.split('>');
      const clf1NodeId = nodeMap[`clf_${clf1}`];
      const clf2NodeId = nodeMap[`clf_${clf2}`];
      if (clf1NodeId && clf2NodeId) {
        edges.push({
          from: clf1NodeId,
          to: clf2NodeId,
          label: clfEdgeDict[key] > 3 ? clfEdgeDict[key].toString() : '',
          color: { color: '#EF4444' },
          width: Math.max(1, Math.min(5, Math.log(clfEdgeDict[key] + 1))),
          dashes: true,
          title: `Classifier-Classifier co-occurrence: ${clfEdgeDict[key]} times`
        });
      }
    }
    
    return { 
      nodes, 
      edges, 
      stats: {
        classifiers: Object.keys(clfNodeDict).length,
        lemmas: Object.keys(lemNodeDict).length,
        clfLemmaEdges: Object.keys(lemEdgeDict).length,
        clfClfEdges: Object.keys(clfEdgeDict).length
      },
      rawData: { lemEdgeDict, clfEdgeDict }
    };
  }, [tokenData, lemmaData, selectedWitnesses, selectedScripts, selectedPOS]);

  // Export network data as CSV
  const exportNetworkCSV = () => {
    if (!networkData?.rawData) return;
    
    const { lemEdgeDict, clfEdgeDict } = networkData.rawData;
    let csvContent = "lemma_id,lemma_meaning,clf_id,clf_id_1,clf_id_2,value\n";
    
    // Process lemma edges
    for (const key in lemEdgeDict) {
      const [clfId, lemmaId] = key.split('>');
      const lemma = lemmaData[parseInt(lemmaId)];
      const lemmaMeaning = lemma?.meaning?.replace(/,/g, ';') || '';
      csvContent += `${lemmaId},"${lemmaMeaning}",${clfId},,,${lemEdgeDict[key]}\n`;
    }
    
    // Process classifier edges
    for (const key in clfEdgeDict) {
      const [clfId1, clfId2] = key.split('>');
      csvContent += `,,,${clfId1},${clfId2},${clfEdgeDict[key]}\n`;
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network_${selectedProjectId}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const networkOptions = useMemo(() => ({
    layout: {
      improvedLayout: false
    },
    physics: {
      enabled: true,
      stabilization: { iterations: 60, fit: true }
    },
    nodes: {
      borderWidth: 1,
      font: {
        size: 12,
        face: selectedProjectInfo?.type === 'hieroglyphic' ? 'hierofont, monospace' : 'monospace'
      }
    },
    edges: {
      smooth: false,
      font: { size: 10, color: '#374151' }
    },
    groups: {
      classifier: {
        color: { background: 'beige', border: '#f6d47a' }
      },
      lemma: {
        color: { background: 'white', border: 'black' }
      }
    }
  }), [selectedProjectInfo?.type]);

  const handleDownloadWitnessReport = () => {
    const headers = ["Witness", "Script", "Token Count", "Lemma Count", "Classifiers"];

    const rows = filteredWitnesses.map((stat) => [
      stat.witness.id,
      stat.witness.script,
      stat.tokenCount,
      stat.lemmaCount,
      Array.from(stat.classifiers).join("; "),
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
    link.setAttribute("download", `witness-report-${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <SidebarLayout>
      <div className="max-w-[1600px] mx-auto" id="map-report-content">
        <div className="mb-6">
          <h1 className="text-4xl font-bold page-accent-text mb-2">
            iClassifier Map Report
          </h1>
          <p className="text-gray-600">
            Witness distribution and source analysis
            {error && (
              <span className="block text-yellow-600 text-sm mt-1">
                ⚠️ API Error: {error} - Using sample data
              </span>
            )}
          </p>
        </div>

        {/* Project Selector */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          {error && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
              <p className="text-yellow-800 text-sm">
                <strong>Note:</strong> Could not connect to database API. Displaying sample data for demonstration.
                <br />
                <em>Error: {error}</em>
              </p>
            </div>
          )}
          <label htmlFor="project-select" className="block text-sm font-semibold mb-3">
            Select Project ({getAvailableProjects.length} available):
          </label>
          {loading ? (
            <p className="text-sm text-gray-500">Loading projects...</p>
          ) : getAvailableProjects.length === 0 ? (
            <p className="text-sm text-red-500">No projects available. Please ensure database files are in the databases folder.</p>
          ) : (
            <select
              id="project-select"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {getAvailableProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-2">Total Tokens</div>
            <div className="text-3xl font-bold text-black">
              {stats.totalTokens}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-2">Total Witnesses</div>
            <div className="text-3xl font-bold text-black">
              {stats.totalWitnesses}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-2">Total Lemmas</div>
            <div className="text-3xl font-bold text-black">
              {stats.totalLemmas}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-2">Scripts</div>
            <div className="text-3xl font-bold text-black">
              {allScripts.length}
            </div>
          </div>
        </div>

        {/* Network Visualization Interface */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold text-black mb-4">
            <Network className="w-6 h-6 inline-block mr-2" />
            Classifier-Lemma Network Map
          </h2>
          
          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {/* Text Selection */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Text Selection</h4>
              <WitnessSelector
                witnessData={witnessData}
                selectedWitnesses={selectedWitnesses}
                setSelectedWitnesses={setSelectedWitnesses}
              />
            </div>
            
            {/* Script Selection */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Script Selection</h4>
              <ScriptSelector
                witnessData={witnessData}
                selectedScripts={selectedScripts}
                setSelectedScripts={setSelectedScripts}
              />
            </div>
            
            {/* POS Selection */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Part of Speech</h4>
              <POSSelector
                availablePOS={posArr}
                selectedPOS={selectedPOS}
                onSelectionChange={setSelectedPOS}
              />
            </div>
          </div>
          
          {/* Network Controls */}
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              onClick={() => {
                setNetworkDrawn(true);
              }}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Network className="w-4 h-4" />
              Generate Network
            </button>
            
            {networkData && (
              <button
                onClick={exportNetworkCSV}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
            
            <button
              onClick={() => setNetworkDrawn(false)}
              className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Clear Network
            </button>
          </div>
          
          {/* Network Stats */}
          {networkData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">{networkData.stats.classifiers}</div>
                <div className="text-xs text-gray-600">Classifiers</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">{networkData.stats.lemmas}</div>
                <div className="text-xs text-gray-600">Lemmas</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-600">{networkData.stats.clfLemmaEdges}</div>
                <div className="text-xs text-gray-600">Clf-Lemma Links</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-red-600">{networkData.stats.clfClfEdges}</div>
                <div className="text-xs text-gray-600">Clf-Clf Links</div>
              </div>
            </div>
          )}
          
          {/* Network Visualization */}
          {networkData ? (
            <div className="border border-gray-300 rounded-lg">
              <VisNetwork 
                data={networkData} 
                options={networkOptions}
                className="h-96"
              />
              <div className="p-3 bg-gray-50 border-t text-xs text-gray-600">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>• <span className="inline-block w-3 h-3 bg-yellow-200 border border-yellow-600 mr-1"></span> Beige nodes: Classifiers</div>
                  <div>• <span className="inline-block w-3 h-3 bg-blue-200 border border-blue-600 mr-1"></span> Blue nodes: Lemmas</div>
                  <div>• Solid lines: Classifier-Lemma relationships | Dashed lines: Classifier co-occurrences</div>
                </div>
              </div>
            </div>
          ) : networkDrawn ? (
            <div className="text-center py-6 text-gray-500">
              <Network className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Generating network data...</p>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
              <Network className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Click "Generate Network" to create classifier-lemma visualization</p>
              <p className="text-sm mt-2">Network shows relationships between classifiers and lemmas in your corpus</p>
            </div>
          )}
        </div>

        {/* Script Distribution */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold text-black mb-4">
            Token Distribution by Script
          </h2>
          <div className="space-y-3">
            {allScripts.map((script) => {
              const count = stats.scriptCounts[script] || 0;
              const percentage = ((count / stats.totalTokens) * 100).toFixed(1);
              return (
                <div key={script}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-black">{script}</span>
                    <span className="text-sm text-gray-600">
                      {count} tokens ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Script Filter */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold text-black mb-4">
            Filter by Script
          </h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setSelectedScript(null)}
              className={cn(
                "px-3 py-2 rounded text-sm font-medium transition-colors",
                selectedScript === null
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
              )}
            >
              All Scripts
            </button>
            {allScripts.map((script) => (
              <button
                key={script}
                onClick={() => setSelectedScript(script)}
                className={cn(
                  "px-3 py-2 rounded text-sm font-medium transition-colors",
                  selectedScript === script
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                )}
              >
                {script}
              </button>
            ))}
          </div>
        </div>

        {/* Witness List and Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Witness List */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-black text-white px-4 py-3 flex items-center justify-between">
                <h3 className="font-semibold">Witnesses ({filteredWitnesses.length})</h3>
                <button
                  onClick={handleDownloadWitnessReport}
                  className="p-1 hover:bg-black/20 rounded transition-colors"
                  title="Download report"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {filteredWitnesses.map((stat) => (
                  <button
                    key={stat.witness.id}
                    onClick={() => setSelectedWitness(stat.witness.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-gray-200 hover:bg-gray-50 transition-colors",
                      selectedWitness === stat.witness.id && "bg-blue-50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-black text-sm truncate">
                          {stat.witness.id}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {stat.tokenCount} tokens · {stat.lemmaCount} lemmas
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Witness Details */}
          <div className="lg:col-span-2">
            {selectedWitness ? (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-black mb-4">
                  {selectedWitness}
                </h3>

                {/* Witness Info */}
                <div className="mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Script</div>
                      <div className="font-medium text-black">
                        {witnessData[selectedWitness]?.script}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Tokens</div>
                      <div className="font-medium text-black">
                        {witnessStats[selectedWitness]?.tokenCount || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Lemmas</div>
                      <div className="font-medium text-black">
                        {witnessStats[selectedWitness]?.lemmaCount || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Classifiers</div>
                      <div className="font-medium text-black">
                        {witnessStats[selectedWitness]?.classifierCount || 0}
                      </div>
                    </div>
                  </div>
                </div>

                {witnessData[selectedWitness]?.url && (
                  <div className="mb-4">
                    <div className="text-sm text-gray-600 mb-1">TLA Link</div>
                    <a
                      href={witnessData[selectedWitness].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {witnessData[selectedWitness].url}
                    </a>
                  </div>
                )}

                {/* Lemmas in Witness */}
                <div>
                  <h4 className="font-semibold text-black mb-3">Lemmas:</h4>
                  <div className="space-y-2">
                    {selectedWitnessLemmas.length > 0 ? (
                      selectedWitnessLemmas.map((lemma) => (
                        <div
                          key={lemma.id}
                          className="p-3 bg-gray-50 rounded border border-gray-200"
                        >
                          <div className="font-medium text-black">
                            <em className="italic">{lemma.transliteration}</em>
                          </div>
                          <div className="text-sm text-gray-600">
                            {lemma.meaning}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">No lemmas found.</p>
                    )}
                  </div>
                </div>

                {/* Classifiers in Witness */}
                {witnessStats[selectedWitness] &&
                  witnessStats[selectedWitness].classifiers.size > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-black mb-3">
                        Classifiers:
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {Array.from(
                          witnessStats[selectedWitness].classifiers
                        ).sort().map((classifier) => (
                          <span
                            key={classifier}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                          >
                            {classifier}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg p-8 flex items-center justify-center">
                <p className="text-gray-500 text-center">
                  Select a witness from the list to view details
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Witness Table */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-xl font-semibold text-black mb-4">
            Witness Summary
          </h2>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black text-white">
                  <th className="px-3 py-3 text-left">Witness</th>
                  <th className="px-3 py-3 text-left">Script</th>
                  <th className="px-3 py-3 text-center">Tokens</th>
                  <th className="px-3 py-3 text-center">Lemmas</th>
                  <th className="px-3 py-3 text-center">Classifiers</th>
                </tr>
              </thead>
              <tbody>
                {filteredWitnesses.map((stat, idx) => (
                  <tr
                    key={stat.witness.id}
                    className={cn(
                      "border-b border-gray-200 cursor-pointer hover:bg-gray-50",
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50",
                      selectedWitness === stat.witness.id && "bg-blue-50"
                    )}
                    onClick={() => setSelectedWitness(stat.witness.id)}
                  >
                    <td className="px-3 py-3 font-medium text-black">
                      {stat.witness.id}
                    </td>
                    <td className="px-3 py-3">{stat.witness.script}</td>
                    <td className="px-3 py-3 text-center">{stat.tokenCount}</td>
                    <td className="px-3 py-3 text-center">{stat.lemmaCount}</td>
                    <td className="px-3 py-3 text-center">
                      {stat.classifierCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Citation Section */}
        <Citation
          type="network"
          projectName={projects.find((p) => p.id === selectedProjectId)?.name || "Unknown"}
          authors={projects.find((p) => p.id === selectedProjectId)?.authors || "Unknown"}
          projectId={selectedProjectId}
        />

        {/* Action Buttons - Bottom */}
        <div className="mt-8 pt-6 border-t border-gray-300 flex justify-center gap-3">
          <ReportActions
            reportId="map-report-content"
            reportType="network"
            projectId={selectedProjectId}
          />
        </div>
      </div>
    </SidebarLayout>
  );
}
