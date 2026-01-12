import { useState, useMemo, useEffect, memo, useCallback } from "react";
import WitnessSelector from "@/components/filters/WitnessSelector";
import ScriptSelector from "@/components/filters/ScriptSelector";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search as SearchIcon, Download, BarChart3, Network } from "lucide-react";
import SidebarLayout from "@/components/SidebarLayout";
import { useProjectData, useAvailableProjects } from "@/lib/api";
import { projects, clfTypeArr, clfLevelArr } from "@/lib/sampleData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NetworkLoader from "@/components/NetworkLoader";

// Memoized lemma option component to prevent re-renders
const LemmaOption = memo(({ id, count, lemma }: any) => (
  <option value={id}>
    {count}: {lemma?.transliteration || "?"} ({lemma?.meaning || "?"})
  </option>
));

LemmaOption.displayName = "LemmaOption";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId") || "";
  const lemmaIdFromUrl = searchParams.get("lemmaId") ? parseInt(searchParams.get("lemmaId")!) : null;

  // Fetch available projects first
  const { data: availableProjectIds, loading: projectsLoading } = useAvailableProjects();

  // Map project IDs to project metadata
  const getAvailableProjects = useMemo(() => {
    return availableProjectIds
      .map((id) => projects.find((p) => p.id === id))
      .filter(Boolean) as typeof projects;
  }, [availableProjectIds]);

  // Determine initial project (prefer URL param, then first available, then fallback)
  const initialProject = useMemo(() => {
    if (projectIdFromUrl) return projectIdFromUrl;
    if (getAvailableProjects.length > 0) return getAvailableProjects[0].id;
    return "classifyingtheother";
  }, [projectIdFromUrl, getAvailableProjects]);

  const [selectedProject, setSelectedProject] = useState(initialProject);
  const [selectedLemmaId, setSelectedLemmaId] = useState<number | null>(lemmaIdFromUrl);
  const [lemmaSearchQuery, setLemmaSearchQuery] = useState("");

  // Token display settings
  const [tokenDisplayType, setTokenDisplayType] = useState<TokenDisplayType>("all");

  // Filter states
  const [selectedWitnesses, setSelectedWitnesses] = useState<Set<string>>(new Set());
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set());
  
  // Classifier filtering
  const [clfType, setClfType] = useState("any");
  const [clfLevel, setClfLevel] = useState("any");
  
  // Search and pagination
  const [lemmaPage, setLemmaPage] = useState(1);
  const LEMMAS_PER_PAGE = 50;

  // Statistics
  const [clfDict, setClfDict] = useState<ClassifierStats>({});
  const [comDict, setComDict] = useState<ClassifierStats>({});
  const [scrDict, setScrDict] = useState<ClassifierStats>({});
  const [outerCompoundClfDict, setOuterCompoundClfDict] = useState<ClassifierStats>({});

  // Update URL when project changes
  useEffect(() => {
    if (selectedProject !== projectIdFromUrl) {
      const params = new URLSearchParams(searchParams);
      params.set("projectId", selectedProject);
      if (selectedLemmaId) {
        params.set("lemmaId", selectedLemmaId.toString());
      } else {
        params.delete("lemmaId");
      }
      setSearchParams(params, { replace: true });
    }
  }, [selectedProject, selectedLemmaId, setSearchParams]);

  // Update URL when lemma changes
  useEffect(() => {
    if (selectedLemmaId !== lemmaIdFromUrl) {
      const params = new URLSearchParams(searchParams);
      params.set("projectId", selectedProject);
      if (selectedLemmaId) {
        params.set("lemmaId", selectedLemmaId.toString());
      } else {
        params.delete("lemmaId");
      }
      setSearchParams(params, { replace: true });
    }
  }, [selectedLemmaId, setSearchParams, selectedProject]);

  // Fetch data from API - only after we have a valid project
  const { data: projectData, loading, error } = useProjectData(selectedProject);

  // Ensure we have valid data
  const tokenData = projectData?.tokens || {};
  const lemmaData = projectData?.lemmas || {};
  const witnessData = projectData?.witnesses || {};

  // Get all lemmas sorted by frequency
  const lemmasWithCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    Object.values(tokenData).forEach((token: any) => {
      if (token?.lemma_id) {
        counts[token.lemma_id] = (counts[token.lemma_id] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([id, count]) => [parseInt(id), count] as const)
      .sort((a, b) => b[1] - a[1]);
  }, [tokenData]);

  // Filter lemmas based on search
  const filteredLemmas = useMemo(() => {
    return lemmasWithCounts.filter(([id]) => {
      const lemma = lemmaData[id];
      if (!lemma) return false;
      const query = lemmaSearchQuery.toLowerCase();
      return (
        (lemma.transliteration?.toLowerCase() || "").includes(query) ||
        (lemma.meaning?.toLowerCase() || "").includes(query)
      );
    });
  }, [lemmaSearchQuery, lemmasWithCounts, lemmaData]);

  // Reset pagination when search changes
  useEffect(() => {
    setLemmaPage(1);
  }, [lemmaSearchQuery]);

  // Helper function to extract classifiers from token markup
  const extractClfsFromString = useCallback((s: string | null): string[] => {
    if (!s) return [];
    let inside_clf = false;
    let temp: string[] = [];
    let result: string[] = [];
    
    for (let i = 0; i < s.length; i++) {
      if (s.charAt(i) === '~') {
        if (!inside_clf) {
          inside_clf = true;
          temp = [];
        } else {
          inside_clf = false;
          result.push(temp.join(''));
        }
      } else if (inside_clf) {
        temp.push(s.charAt(i));
      }
    }
    return result;
  }, []);

  // Helper function to color classifiers in markup
  const colourClassifiers = useCallback((mdc_w_markup: string | null): string => {
    if (!mdc_w_markup) return '';
    
    const colours = ['red', 'green', 'blue', 'brown', 'goldenrod', 'cyan', 'magenta', 'beige', 'orange'];
    let colourIndex = 0;
    let buffer: string[] = [];
    let insideClf = false;
    
    for (let i = 0; i < mdc_w_markup.length; i++) {
      if (mdc_w_markup.charAt(i) === '~') {
        if (!insideClf) {
          insideClf = true;
          buffer.push(`<span style="color: ${colours[colourIndex++]}">`);
        } else {
          insideClf = false;
          buffer.push('</span>');
        }
      } else {
        buffer.push(mdc_w_markup.charAt(i));
      }
    }
    return buffer.join('');
  }, []);

  // Get tokens for selected lemma with filtering
  const tokensForLemma = useMemo(() => {
    if (!selectedLemmaId) return [];
    
    const tokens = Object.values(tokenData).filter((token: any) => {
      if (token.lemma_id !== selectedLemmaId) return false;
      
      // Witness filtering
      if (selectedWitnesses.size > 0 && !selectedWitnesses.has(String(token.witness_id))) {
        return false;
      }
      
      // Script filtering (check witness script)
      if (selectedScripts.size > 0) {
        const witness = witnessData[token.witness_id];
        if (!witness || !selectedScripts.has(String(witness.script))) {
          return false;
        }
      }
      
      // Token type filtering
      if (tokenDisplayType === 'standalone' && token.compound_id) return false;
      if (tokenDisplayType === 'compound-part' && !token.compound_id) return false;
      if (tokenDisplayType === 'compound') {
        // This would need compound tokens logic - for now just return standalone
        return !token.compound_id;
      }
      
      return true;
    });
    
    return tokens.sort((a, b) => a.id - b.id);
  }, [selectedLemmaId, tokenData, selectedWitnesses, selectedScripts, tokenDisplayType, witnessData]);

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
        newScrDict[witness.script] = (newScrDict[witness.script] || 0) + 1;
      }
    });
    
    setClfDict(newClfDict);
    setComDict(newComDict);
    setScrDict(newScrDict);
  }, [selectedLemmaId, tokensForLemma, extractClfsFromString, witnessData]);

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
  };

  const selectedProjectInfo = getAvailableProjects.find(p => p.id === selectedProject);
  const selectedLemmaInfo = selectedLemmaId ? lemmaData[selectedLemmaId] : null;

  if (loading || projectsLoading) {
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Lemma Report</h1>
            <div className="text-gray-600">
              Analyze lemma usage and classifier patterns
              {selectedProjectInfo && (
                <span className="ml-2">
                  • <Badge variant="secondary">{selectedProjectInfo.name}</Badge>
                </span>
              )}
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
              onClick={() => navigate(`/project/${selectedProject}/map-report`)}
            >
              <Network className="w-4 h-4 mr-2" />
              Network Map
            </Button>
          </div>
        </div>

        {/* Project Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Project Selection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Project</label>
                <Select value={selectedProject} onValueChange={handleProjectChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lemma Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Lemma Selection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Search Lemmas
              </label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by transliteration or meaning..."
                  value={lemmaSearchQuery}
                  onChange={(e) => setLemmaSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Select Lemma</label>
              <Select 
                value={selectedLemmaId?.toString() || ""} 
                onValueChange={(value) => handleLemmaSelect(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a lemma..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredLemmas.slice(0, 100).map(([id, count]) => {
                    const lemma = lemmaData[id];
                    return (
                      <SelectItem key={id} value={id.toString()}>
                        {count}: {lemma?.transliteration || "?"} ({lemma?.meaning || "?"})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Witness Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <WitnessSelector
                witnessData={witnessData}
                selectedWitnesses={selectedWitnesses}
                setSelectedWitnesses={setSelectedWitnesses}
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
              />
            </CardContent>
          </Card>
        </div>

        {/* Report Content */}
        {selectedLemmaId && selectedLemmaInfo && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
              <CardTitle>
                Lemma: <em className="italic">{selectedLemmaInfo.transliteration}</em> ({selectedLemmaInfo.meaning})
              </CardTitle>
                <p className="text-sm text-gray-600">
                  {tokensForLemma.length} token{tokensForLemma.length !== 1 ? 's' : ''} found
                  {tokenDisplayType !== 'all' && ` (${tokenDisplayType} only)`}
                </p>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="statistics" className="w-full">
                  <TabsList>
                    <TabsTrigger value="statistics">Statistics</TabsTrigger>
                    <TabsTrigger value="tokens">Token List</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="statistics" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Classifier Statistics */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Classifier Statistics</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {sortedClfStats.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Classifier</TableHead>
                                  <TableHead className="text-right">Count</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedClfStats.slice(0, 10).map(([clf, count]) => (
                                  <TableRow key={clf}>
                                    <TableCell className="font-mono">{clf}</TableCell>
                                    <TableCell className="text-right">{count}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <p className="text-gray-500 text-sm">No classifiers found</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Classifier Combinations */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Classifier Combinations</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {sortedComStats.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Combination</TableHead>
                                  <TableHead className="text-right">Count</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedComStats.slice(0, 10).map(([com, count]) => (
                                  <TableRow key={com}>
                                    <TableCell className="font-mono text-xs">{com}</TableCell>
                                    <TableCell className="text-right">{count}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <p className="text-gray-500 text-sm">No combinations found</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Script Statistics */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Script Statistics</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {sortedScrStats.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Script</TableHead>
                                  <TableHead className="text-right">Count</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedScrStats.map(([script, count]) => (
                                  <TableRow key={script}>
                                    <TableCell>{script}</TableCell>
                                    <TableCell className="text-right">{count}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <p className="text-gray-500 text-sm">No script data found</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="tokens">
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
                              const coloredMarkup = colourClassifiers(token.mdc_w_markup);
                              const witness = witnessData[token.witness_id];
                              
                              return (
                                <li key={token.id} className="border-l-2 border-gray-200 pl-3">
                                  <div 
                                    className="font-mono text-sm"
                                    dangerouslySetInnerHTML={{ __html: coloredMarkup || token.mdc }}
                                  />
                                  {witness && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      Witness: {witness.name || witness.id}
                                      {token.coordinates_in_witness && (
                                        <span> • {token.coordinates_in_witness}</span>
                                      )}
                                      {token.pos && (
                                        <span> • POS: {token.pos}</span>
                                      )}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
