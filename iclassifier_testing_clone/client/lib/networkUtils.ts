import type { ClassifierMetadata, ClassifierMeaningMap } from "./sampleData";
import { mdc2uni } from "./mdc2uni";
import { formatClassifierLabelText } from "./classifierLabel";

/**
 * Network Visualization Utilities
 * 
 * This module provides comprehensive network visualization functionality
 * ported from the original JavaScript implementation to TypeScript/React.
 * Supports lemma networks, classifier networks, and general map networks.
 */

// Types
export interface NetworkNode {
  id: string;
  label: string;
  mdc?: string;
  color: { background: string; border: string };
  font: { color: string; size: number; face: string };
  size: number;
  shape: 'box' | 'ellipse' | 'circle';
  type?: 'lemma' | 'classifier' | 'related_lemma';
}

export interface NetworkEdge {
  from: string;
  to: string;
  width: number;
  color: { color: string; opacity?: number };
  label?: string;
  font?: { size: number; color: string };
  dashes?: boolean;
  length?: number;
}

export interface ClfData {
  [key: string]: {
    id: number;
    mdc: string;
    type: string;
    level: number;
    meaning?: string;
    comments?: string;
  };
}

export interface ClfParseData {
  [key: string]: {
    id: number;
    token_id: number;
    clf_id: number;
    clf_position: number;
  };
}

export interface NetworkConfig {
  clfLevels?: Set<number>;
  clfTypes?: Set<string>;
  selectedWitnesses?: Set<string>;
  selectedScripts?: Set<string>;
  selectedPos?: Set<string>;
  useUnicode?: boolean;
  lemmaFontFace?: string;
  classifierFontFace?: string;
  classifierMeanings?: ClassifierMeaningMap;
  lemmaLabelMode?: "transliteration" | "meaning";
  maxNodes?: number;
}

export const DEFAULT_CLF_LEVELS = new Set([1, 2, 3, 4, 5]);
export const DEFAULT_CLF_TYPES = new Set(['taxonomic', 'taxonomic_repeater', 'taxonomic_metaphoric', 'schematic', 'unclear']);

const LEVEL_ALIASES: Record<string, number> = {
  encyclopedic: 1,
  semantic: 1,
  lexical: 1,
  pragmatic: 2,
  referent: 2,
  derivational: 3,
  grammatical: 3,
  metatextual: 4,
  phonetic: 5,
  primary: 1,
  secondary: 2
};

function normalizeClfLevel(levelValue: unknown): number {
  if (typeof levelValue === "number" && Number.isFinite(levelValue)) {
    return levelValue;
  }
  const raw = String(levelValue ?? "").trim().toLowerCase();
  if (!raw) return 1;
  const parsed = parseInt(raw, 10);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return LEVEL_ALIASES[raw] || 1;
}

function classifierTypeMatches(typeValue: string | null | undefined, clfTypes: Set<string>): boolean {
  if (clfTypes.has("anything")) return true;
  if (!typeValue) return false;
  const raw = String(typeValue).trim();
  if (!raw) return false;
  const types = raw.split(";").map((entry) => entry.trim()).filter(Boolean);
  if (types.length === 0) return false;
  return types.some((type) => clfTypes.has(type));
}

export function buildClassifierMapsFromMetadata(metadata: ClassifierMetadata[]) {
  const clfData: ClfData = {};
  const clfParseData: ClfParseData = {};
  const clfKeyToId = new Map<string, number>();
  let nextClfId = 1;

  metadata.forEach((entry, index) => {
    if (!entry.gardiner_number) return;
    const level = normalizeClfLevel(entry.clf_level);
    const key = `${entry.gardiner_number}|${entry.clf_type || ""}|${level}`;
    let clfId = clfKeyToId.get(key);
    if (!clfId) {
      clfId = nextClfId++;
      clfKeyToId.set(key, clfId);
      clfData[clfId] = {
        id: clfId,
        mdc: entry.gardiner_number,
        type: entry.clf_type || "",
        level
      };
    }

    const parseKey = `${entry.token_id}_${clfId}_${index}`;
    clfParseData[parseKey] = {
      id: index + 1,
      token_id: entry.token_id,
      clf_id: clfId,
      clf_position: 0
    };
  });

  return { clfData, clfParseData };
}

/**
 * Colors for classifier highlighting (from original implementation)
 */
export const COLOURS = [
  'red', 'green', 'blue', 'brown', 'goldenrod', 
  'cyan', 'magenta', 'beige', 'white', 'orange'
];

/**
 * Extract classifiers from MDC markup string
 */
export function extractClassifiersFromString(s: string | null): string[] {
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
}

/**
 * Color classifiers in markup for display
 */
export function colourClassifiers(mdc_w_markup: string | null): string {
  if (!mdc_w_markup) return '';
  
  let colourIndex = 0;
  let buffer: string[] = [];
  let insideClf = false;
  
  for (let i = 0; i < mdc_w_markup.length; i++) {
    if (mdc_w_markup.charAt(i) === '~') {
      if (!insideClf) {
        insideClf = true;
        buffer.push(`<span style="color: ${COLOURS[colourIndex % COLOURS.length]}">`);
        colourIndex++;
      } else {
        insideClf = false;
        buffer.push('</span>');
      }
    } else {
      buffer.push(mdc_w_markup.charAt(i));
    }
  }
  return buffer.join('');
}

/**
 * Compare classifier MDC strings for sorting (from original implementation)
 */
export function compareClfMDC(a: string, b: string): number {
  const isNumber = (c: string) => '0123456789'.indexOf(c) >= 0;
  let alphaA = '', alphaB = '', numericA = '', numericB = '', restA = '', restB = '';
  let stage = 1;
  
  // Parse string A
  for (let i = 0; i < a.length; i++) {
    const c = a.charAt(i);
    if (isNumber(c) && stage === 1) {
      stage = 2;
      numericA += c;
    } else if (isNumber(c)) {
      numericA += c;
    } else if (stage === 1) {
      alphaA += c;
    } else {
      restA += c;
    }
  }
  
  // Parse string B
  stage = 1;
  for (let i = 0; i < b.length; i++) {
    const c = b.charAt(i);
    if (isNumber(c) && stage === 1) {
      stage = 2;
      numericB += c;
    } else if (isNumber(c)) {
      numericB += c;
    } else if (stage === 1) {
      alphaB += c;
    } else {
      restB += c;
    }
  }
  
  const numA = numericA === '' ? 0 : parseInt(numericA);
  const numB = numericB === '' ? 0 : parseInt(numericB);
  
  if (alphaA.localeCompare(alphaB) !== 0) {
    return alphaA.localeCompare(alphaB);
  }
  if (numA !== numB) {
    return numA - numB;
  }
  return restA.localeCompare(restB);
}

/**
 * Check if token should be included based on filters
 */
export function shouldIncludeToken(
  token: any,
  config: NetworkConfig = {},
  witnessData: any = {},
  clfData: ClfData = {},
  clfParseData: ClfParseData = {}
): boolean {
  const {
    selectedWitnesses = new Set(),
    selectedScripts = new Set(),
    selectedPos = new Set()
  } = config;
  
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
  
  // POS filtering
  if (selectedPos.size > 0) {
    const tokenPos = token.pos === null || token.pos === undefined
      ? ""
      : String(token.pos).trim();
    if (!tokenPos || !selectedPos.has(tokenPos)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Draw lemma-specific classifier network
 */
export function createLemmaNetwork(
  lemmaId: number,
  lemmaData: any,
  tokenData: any,
  clfDict: { [key: string]: number },
  config: NetworkConfig = {}
): { nodes: NetworkNode[]; edges: NetworkEdge[] } {
  const nodes: NetworkNode[] = [];
  const edges: NetworkEdge[] = [];
  const nodeIds = new Set<string>();
  
  const lemma = lemmaData[lemmaId];
  if (!lemma) return { nodes, edges };
  
  const {
    useUnicode = false,
    lemmaFontFace = 'Roboto',
    classifierFontFace = 'hierofont',
    classifierMeanings
  } = config;

  // Central lemma node (legacy styling)
  const lemmaNodeId = `lemma_${lemmaId}`;
  const lemmaLabel = lemma.meaning
    ? `${lemma.transliteration}\n(${lemma.meaning})`
    : `${lemma.transliteration}`;
  nodes.push({
    id: lemmaNodeId,
    label: lemmaLabel,
    color: { background: 'lightgreen', border: 'lightgreen' },
    font: { color: '#111827', size: 14, face: lemmaFontFace },
    size: 40,
    shape: 'ellipse',
    type: 'lemma'
  });
  nodeIds.add(lemmaNodeId);
  
  // Classifier nodes
  Object.entries(clfDict).forEach(([classifier, count]) => {
    const classifierNodeId = `classifier_${classifier}`;
    if (!nodeIds.has(classifierNodeId)) {
      const glyph = useUnicode && mdc2uni[classifier]
        ? mdc2uni[classifier]
        : classifier;
      const baseLabel = useUnicode ? `${glyph} (${classifier})` : classifier;
      const label = formatClassifierLabelText(classifier, classifierMeanings, baseLabel);
      nodes.push({
        id: classifierNodeId,
        label,
        mdc: classifier,
        color: { background: '#b0c0ff', border: '#b0c0ff' },
        font: { color: '#1e3a8a', size: 12, face: classifierFontFace },
        size: 10,
        shape: 'ellipse',
        type: 'classifier'
      });
      nodeIds.add(classifierNodeId);
    }
    
    // Edge from lemma to classifier
    edges.push({
      from: lemmaNodeId,
      to: classifierNodeId,
      width: Math.max(count, 1),
      color: { color: '#b0c0ff' },
      label: undefined,
      font: undefined
    });
    const edge = edges[edges.length - 1];
    edge.length = count > 0 ? 5.0 / count : 1;
  });
  
  return { nodes, edges };
}

/**
 * Draw network map from classifier and lemma dictionaries (all data)
 */
export function createMapNetworkAll(
  tokenData: any,
  lemmaData: any,
  witnessData: any,
  config: NetworkConfig = {}
): { nodes: NetworkNode[]; edges: NetworkEdge[]; clfNodeDict: any; lemNodeDict: any; lemEdgeDict: any; clfEdgeDict: any } {
  const clfNodeDict: { [key: string]: number } = {};
  const lemNodeDict: { [key: string]: number } = {};
  const lemEdgeDict: { [key: string]: number } = {};
  const clfEdgeDict: { [key: string]: number } = {};
  
  for (const key in tokenData) {
    const token = tokenData[key];
    if (!shouldIncludeToken(token, config, witnessData)) continue;
    
    const clfs = extractClassifiersFromString(token.mdc_w_markup);
    if (clfs.length === 0) continue;
    
    const lemmaId = token.lemma_id;
    if (!lemmaId) continue;
    
    if (clfs.length === 1) {
      const edgeKey = `${clfs[0]}>${lemmaId}`;
      lemEdgeDict[edgeKey] = (lemEdgeDict[edgeKey] || 0) + 1;
      continue;
    }

    clfs.sort(compareClfMDC);
    for (let i = 0; i < clfs.length - 1; i++) {
      const lemEdgeKey = `${clfs[i]}>${lemmaId}`;
      lemEdgeDict[lemEdgeKey] = (lemEdgeDict[lemEdgeKey] || 0) + 1;
      for (let j = i + 1; j < clfs.length; j++) {
        const edgeKey = `${clfs[i]}>${clfs[j]}`;
        clfEdgeDict[edgeKey] = (clfEdgeDict[edgeKey] || 0) + 1;
      }
    }
  }
  
  return createMapNetworkFromDicts(clfNodeDict, lemNodeDict, lemEdgeDict, clfEdgeDict, lemmaData, config);
}

/**
 * Draw filtered network map based on classifier levels and types
 */
export function createMapNetworkByLevelAndType(
  tokenData: any,
  lemmaData: any,
  witnessData: any,
  clfData: ClfData,
  clfParseData: ClfParseData,
  config: NetworkConfig = {}
): { nodes: NetworkNode[]; edges: NetworkEdge[]; clfNodeDict: any; lemNodeDict: any; lemEdgeDict: any; clfEdgeDict: any } {
  const {
    clfLevels = DEFAULT_CLF_LEVELS,
    clfTypes = DEFAULT_CLF_TYPES
  } = config;
  
  const clfNodeDict: { [key: string]: number } = {};
  const lemNodeDict: { [key: string]: number } = {};
  const lemEdgeDict: { [key: string]: number } = {};
  const clfEdgeDict: { [key: string]: number } = {};
  const clfCombsDict: { [key: string]: string[] } = {}; // Track which clfs appear together
  
  const tokenIdsByClfId: Record<number, number[]> = {};
  Object.values(clfParseData).forEach((parse: any) => {
    if (!tokenIdsByClfId[parse.clf_id]) {
      tokenIdsByClfId[parse.clf_id] = [];
    }
    tokenIdsByClfId[parse.clf_id].push(parse.token_id);
  });

  // Iterate over clf_parses; extract clfs that have valid tokens
  for (const clfId in clfData) {
    const clf = clfData[clfId];
    
    // Check if classifier matches level and type filters
    if (!clfLevels.has(clf.level)) continue;
    if (!classifierTypeMatches(clf.type, clfTypes)) continue;
    
    // Find tokens that use this classifier
    const tokensWithClf = tokenIdsByClfId[parseInt(clfId, 10)] || [];
    
    tokensWithClf.forEach((tokenId: number) => {
      const token = tokenData[tokenId];
      if (!token || !shouldIncludeToken(token, config, witnessData)) return;
      
      const lemmaId = token.lemma_id;
      if (!lemmaId) return;
      
      // Edge from lemma to classifier
      const lemEdgeKey = `${clf.mdc}>${lemmaId}`;
      lemEdgeDict[lemEdgeKey] = (lemEdgeDict[lemEdgeKey] || 0) + 1;
      
      // Track classifier combinations for this token
      if (!clfCombsDict[tokenId]) {
        clfCombsDict[tokenId] = [];
      }
      clfCombsDict[tokenId].push(clf.mdc);
    });
  }
  
  // Add classifier-to-classifier edges
  for (const tokenId in clfCombsDict) {
    const clfs = clfCombsDict[tokenId];
    for (let i = 0; i < clfs.length; i++) {
      for (let j = i + 1; j < clfs.length; j++) {
        const key = `${clfs[i]}>${clfs[j]}`;
        clfEdgeDict[key] = (clfEdgeDict[key] || 0) + 1;
      }
    }
  }
  
  return createMapNetworkFromDicts(clfNodeDict, lemNodeDict, lemEdgeDict, clfEdgeDict, lemmaData, config);
}

/**
 * Create network visualization from data dictionaries
 */
function createMapNetworkFromDicts(
  clfNodeDict: { [key: string]: number },
  lemNodeDict: { [key: string]: number },
  lemEdgeDict: { [key: string]: number },
  clfEdgeDict: { [key: string]: number },
  lemmaData: any,
  config: NetworkConfig = {}
): { nodes: NetworkNode[]; edges: NetworkEdge[]; clfNodeDict: any; lemNodeDict: any; lemEdgeDict: any; clfEdgeDict: any } {
  Object.keys(clfEdgeDict).forEach((edgeKey) => {
    const [head] = edgeKey.split(">");
    clfNodeDict[head] = (clfNodeDict[head] || 0) + 1;
  });
  Object.keys(lemEdgeDict).forEach((edgeKey) => {
    const [head, tail] = edgeKey.split(">");
    clfNodeDict[head] = (clfNodeDict[head] || 0) + 1;
    lemNodeDict[tail] = (lemNodeDict[tail] || 0) + 1;
  });

  const maxNodes = typeof config.maxNodes === "number" ? config.maxNodes : 0;
  let limitedClfNodeDict = clfNodeDict;
  let limitedLemNodeDict = lemNodeDict;
  let limitedLemEdgeDict = lemEdgeDict;
  let limitedClfEdgeDict = clfEdgeDict;

  if (maxNodes > 0) {
    const clfEntries = Object.entries(clfNodeDict);
    const lemEntries = Object.entries(lemNodeDict);
    const totalNodes = clfEntries.length + lemEntries.length;
    if (totalNodes > maxNodes) {
      const clfQuota = Math.max(1, Math.round((maxNodes * clfEntries.length) / totalNodes));
      const lemQuota = Math.max(1, maxNodes - clfQuota);
      const topClfs = new Set(
        clfEntries
          .sort((a, b) => b[1] - a[1])
          .slice(0, clfQuota)
          .map(([key]) => key)
      );
      const topLems = new Set(
        lemEntries
          .sort((a, b) => b[1] - a[1])
          .slice(0, lemQuota)
          .map(([key]) => key)
      );

      limitedClfNodeDict = {};
      topClfs.forEach((key) => {
        limitedClfNodeDict[key] = clfNodeDict[key];
      });
      limitedLemNodeDict = {};
      topLems.forEach((key) => {
        limitedLemNodeDict[key] = lemNodeDict[key];
      });

      limitedLemEdgeDict = {};
      Object.entries(lemEdgeDict).forEach(([key, value]) => {
        const [clf, lemmaId] = key.split(">");
        if (topLems.has(lemmaId) && topClfs.has(clf)) {
          limitedLemEdgeDict[key] = value;
        }
      });

      limitedClfEdgeDict = {};
      Object.entries(clfEdgeDict).forEach(([key, value]) => {
        const [clf1, clf2] = key.split(">");
        if (topClfs.has(clf1) && topClfs.has(clf2)) {
          limitedClfEdgeDict[key] = value;
        }
      });
    }
  }

  const nodes: NetworkNode[] = [];
  const edges: NetworkEdge[] = [];
  const lemmaFontFace = config.lemmaFontFace || "sans-serif";
  const classifierFontFace = config.classifierFontFace || "sans-serif";
  const useUnicode = config.useUnicode !== false;
  const classifierMeanings = config.classifierMeanings;
  const lemmaLabelMode = config.lemmaLabelMode || "transliteration";
  
  // Add classifier nodes
  const sortedClfs = Object.keys(limitedClfNodeDict).sort(compareClfMDC);
  sortedClfs.forEach(clf => {
    const glyph = useUnicode && mdc2uni[clf] ? mdc2uni[clf] : clf;
    const baseLabel = useUnicode ? `${glyph} (${clf})` : clf;
    const label = formatClassifierLabelText(clf, classifierMeanings, baseLabel);
    const size = 20;
    nodes.push({
      id: `classifier_${clf}`,
      label,
      mdc: clf,
      color: { background: 'beige', border: 'beige' },
      font: { color: '#111827', size: 16, face: classifierFontFace },
      size,
      shape: 'ellipse',
      type: 'classifier'
    });
  });
  
  // Add lemma nodes
  Object.keys(limitedLemNodeDict).forEach(lemmaIdStr => {
    const lemmaId = parseInt(lemmaIdStr);
    const lemma = lemmaData[lemmaId];
    if (!lemma) return;
    
    const size = 20;
    const lemmaLabel = lemmaLabelMode === "meaning"
      ? (lemma.meaning || lemma.transliteration || `${lemmaId}`)
      : (lemma.transliteration || lemma.meaning || `${lemmaId}`);
    nodes.push({
      id: `lemma_${lemmaId}`,
      label: lemmaLabel,
      color: { background: 'white', border: 'black' },
      font: { color: '#111827', size: 12, face: lemmaFontFace },
      size,
      shape: 'circle',
      type: 'lemma'
    });
  });
  
  // Add lemma-classifier edges
  Object.keys(limitedLemEdgeDict).forEach(edgeKey => {
    const [clf, lemmaId] = edgeKey.split('>');
    const count = limitedLemEdgeDict[edgeKey];
    
    edges.push({
      from: `classifier_${clf}`,
      to: `lemma_${lemmaId}`,
      width: Math.max(count, 1),
      color: { color: 'blue' }
    });
  });
  
  // Add classifier-classifier edges
  Object.keys(limitedClfEdgeDict).forEach(edgeKey => {
    const [clf1, clf2] = edgeKey.split('>');
    const count = limitedClfEdgeDict[edgeKey];
    
    edges.push({
      from: `classifier_${clf1}`,
      to: `classifier_${clf2}`,
      width: Math.max(count, 1),
      color: { color: 'brown' }
    });
  });
  
  return {
    nodes,
    edges,
    clfNodeDict: limitedClfNodeDict,
    lemNodeDict: limitedLemNodeDict,
    lemEdgeDict: limitedLemEdgeDict,
    clfEdgeDict: limitedClfEdgeDict
  };
}

/**
 * Get default network options for vis.js
 */
export function getNetworkOptions() {
  return {
    physics: {
      enabled: true,
      stabilization: { iterations: 60 },
      barnesHut: {
        springConstant: 0.05,
        avoidOverlap: 0.45
      }
    },
    interaction: {
      dragNodes: true,
      dragView: true,
      zoomView: true,
      selectConnectedEdges: false
    },
    layout: {
      improvedLayout: false
    },
    nodes: {
      borderWidth: 1,
      borderWidthSelected: 2,
      chosen: {
        node: function(values: any, id: string, selected: boolean, hovering: boolean) {
          values.borderWidth = selected || hovering ? 2 : 1;
        }
      }
    },
    edges: {
      smooth: {
        type: 'continuous',
        roundness: 0.2
      },
      chosen: {
        edge: function(values: any, id: string, selected: boolean, hovering: boolean) {
          values.color = selected || hovering ? '#1f2937' : values.color;
        }
      }
    }
  };
}

export function getLegacyMapOptions() {
  return {
    layout: {
      improvedLayout: false
    }
  };
}

/**
 * Create CSV export data for network
 */
export function createNetworkCSV(
  lemEdgeDict: { [key: string]: number },
  clfEdgeDict: { [key: string]: number },
  lemmaData: any
): string {
  let csvContent = "lemma_id,lemma_meaning,clf_id,clf_id_1,clf_id_2,value\n";
  
  // Process lemma edges (clf_id>lemma_id)
  for (const key in lemEdgeDict) {
    const [clf, lemmaId] = key.split('>');
    const lemma = lemmaData[parseInt(lemmaId, 10)];
    const meaning = lemma ? String(lemma.meaning || "").replace(/,/g, ";") : 'unknown';
    csvContent += `${lemmaId},"${meaning}",${clf},,,${lemEdgeDict[key]}\n`;
  }
  
  // Process classifier edges (clf_id_1>clf_id_2)
  for (const key in clfEdgeDict) {
    const [clf1, clf2] = key.split('>');
    csvContent += `,,,${clf1},${clf2},${clfEdgeDict[key]}\n`;
  }
  
  return csvContent;
}

/**
 * Download network data as CSV file
 */
export function downloadNetworkCSV(csvContent: string, filename: string = 'network_data.csv') {
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
