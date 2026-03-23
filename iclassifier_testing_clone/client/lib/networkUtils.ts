import type { ClassifierMetadata, ClassifierMeaningMap } from "./sampleData";
import {
  DEFAULT_NETWORK_CLF_LEVELS,
  DEFAULT_NETWORK_CLF_TYPES,
  classifierTypeMatchesSelection,
  normalizeClassifierLevelNumber,
} from "./sampleData";
import { mdc2uni } from "./mdc2uni";
import { getLuwianGlyphSvgPath } from "./luwianGlyphs";
import { getExtendedSignName } from "./extendedSigns";
import { formatClassifierMeaning, formatClassifierMeaningLabel } from "./classifierMeaningFormat";

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
  font: { color: string; size: number; face: string; align?: string; valign?: string; multi?: any };
  size: number;
  shape: 'box' | 'ellipse' | 'circle' | 'image';
  type?: 'lemma' | 'classifier' | 'related_lemma';
  title?: string;
  x?: number;
  y?: number;
  fixed?: boolean | { x?: boolean; y?: boolean };
  widthConstraint?: any;
  heightConstraint?: any;
  margin?: any;
  image?: string;
  brokenImage?: string;
  shapeProperties?: any;
}

export interface NetworkEdge {
  from: string;
  to: string;
  width: number;
  weight?: number;
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
  classifierFontScale?: number;
  classifierMeanings?: ClassifierMeaningMap;
  projectId?: string;
  lemmaLabelMode?: "transliteration" | "meaning";
  lemmaDisplayMode?: "origin" | "translation" | "both"; // origin = lemma transliteration, translation = meaning/translation
  classifierDisplayMode?: "visual" | "meaning"; // visual = glyph/JSesh image, meaning = classifier meaning label
  projectType?: string;
  classifierNodeSize?: number;
  classifierNodeWidth?: number;
  classifierNodeHeight?: number;
  classifierNodeRadius?: number;
  lemmaColorMode?: "default" | "pos";
  lemmaPosById?: Record<number, string>;
  posColorMap?: Record<string, string>;
  maxNodes?: number;
}

export interface NetworkMapData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  clfNodeDict: Record<string, number>;
  lemNodeDict: Record<string, number>;
  lemEdgeDict: Record<string, number>;
  clfEdgeDict: Record<string, number>;
}

export const JSESH_NODE_COLOR = "rgb(245, 245, 220)";
export const BROKEN_IMAGE_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'/%3E";
export const CLF_NODE_BG_HEX = "#f5f5dc";
export const LEMMA_CLASSIFIER_EDGE_COLOR = "#1D4ED8";
export const CLASSIFIER_COOCCURRENCE_EDGE_COLOR = "#8B0000";
export const NETWORK_TEXT_COLOR = "#000000";
export const NETWORK_EDGE_LENGTH = 150;
export const NETWORK_EDGE_ROUNDNESS = 0.18;
export const CLF_NODE_WIDTH = 80;
export const CLF_NODE_HEIGHT = 44;
export const CLF_NODE_RADIUS = 8;
export const CLF_NODE_PADDING = 6;
export const CLF_IMAGE_WIDTH_SCALE = 0.4;
export const EDGE_WIDTH_REFERENCE = 50;
export const NETWORK_TOP_CLASSIFIER_LIMIT = 100;
export const TOP_CLASSIFIER_LIMIT_DISCLAIMER = 'for fast loading- the top 100 classifiers are visualized in this network, to see the entire dataset plot "all classifiers" in the network report';
const WRAPPED_IMAGE_MARKER = "iclassifier-clf-wrapper-v1";
const needsHtmlLabel = (label: string) => /<[^>]+>/.test(label);
const normalizeClassifierMdc = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};
export const EGYPTIAN_LEMMA_FONT_FACE = "Noto Sans";

export const getLemmaNodeFontFace = (projectType?: string) => {
  if (projectType === "cuneiform") return "cuneiform";
  if (projectType === "chinese") return "Noto Sans TC";
  if (projectType === "hieroglyphic") return EGYPTIAN_LEMMA_FONT_FACE;
  return "Roboto";
};

const POS_COLOR_PALETTE = [
  "#2563eb",
  "#22c55e",
  "#f5c842",
  "#ec4899",
  "#ef4444",
  "#93c5fd",
  "#86efac",
  "#f6d47a",
  "#fbcfe8",
  "#fca5a5"
];

export const buildPosColorMap = (posList: string[]) => {
  const unique = Array.from(
    new Set(posList.map((pos) => String(pos || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const map: Record<string, string> = {};
  unique.forEach((pos, index) => {
    map[pos] = POS_COLOR_PALETTE[index % POS_COLOR_PALETTE.length];
  });
  return map;
};

const getDominantPos = (posCounts: Record<string, number>) => {
  const entries = Object.entries(posCounts);
  if (entries.length === 0) return "";
  entries.sort((a, b) => {
    const diff = b[1] - a[1];
    if (diff !== 0) return diff;
    return a[0].localeCompare(b[0]);
  });
  return entries[0][0];
};

export const wrapClassifierImage = (imageUrl: string) => {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("data:image/svg+xml,") && imageUrl.includes(WRAPPED_IMAGE_MARKER)) {
    return imageUrl;
  }
  const safeUrl = imageUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const baseInnerWidth = Math.max(CLF_NODE_WIDTH - CLF_NODE_PADDING * 2, 1);
  const baseInnerHeight = Math.max(CLF_NODE_HEIGHT - CLF_NODE_PADDING * 2, 1);
  const innerWidth = Math.max(Math.round(baseInnerWidth * CLF_IMAGE_WIDTH_SCALE), 1);
  const innerHeight = baseInnerHeight;
  const innerX = Math.max(Math.round((CLF_NODE_WIDTH - innerWidth) / 2), 0);
  const innerY = CLF_NODE_PADDING;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CLF_NODE_WIDTH}" height="${CLF_NODE_HEIGHT}" viewBox="0 0 ${CLF_NODE_WIDTH} ${CLF_NODE_HEIGHT}">
  <metadata>${WRAPPED_IMAGE_MARKER}</metadata>
  <rect width="${CLF_NODE_WIDTH}" height="${CLF_NODE_HEIGHT}" rx="${CLF_NODE_RADIUS}" ry="${CLF_NODE_RADIUS}" fill="${CLF_NODE_BG_HEX}" />
  <image href="${safeUrl}" x="${innerX}" y="${innerY}" width="${innerWidth}" height="${innerHeight}" preserveAspectRatio="xMidYMid meet" />
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

export function scaleEdgeWidths<T extends { width?: number; weight?: number }>(
  edges: T[],
  maxWidth = EDGE_WIDTH_REFERENCE
) {
  let maxEdgeWidth = 0;
  edges.forEach((edge) => {
    const width = Number(edge.width);
    if (Number.isFinite(width)) {
      maxEdgeWidth = Math.max(maxEdgeWidth, width);
    }
  });

  if (maxEdgeWidth <= maxWidth || maxEdgeWidth === 0) {
    return { edges, scale: 1 };
  }

  const scale = maxEdgeWidth / maxWidth;
  const scaledEdges = edges.map((edge) => {
    const width = Number(edge.width);
    if (!Number.isFinite(width)) {
      return edge;
    }
    return {
      ...edge,
      width: width / scale,
      weight: edge.weight ?? width
    };
  });

  return { edges: scaledEdges, scale };
}

export const getExtendedSignUrl = (mdc: string | null | undefined): string | null => {
  if (!mdc) return null;
  const trimmed = String(mdc).trim();
  if (!trimmed) return null;
  const fileBase = getExtendedSignName(trimmed);
  if (!fileBase) return null;
  return `/extended_signs/${fileBase}.svg`;
};

export const fetchExtendedSignDataUrl = async (mdc: string | null | undefined): Promise<string | null> => {
  const url = getExtendedSignUrl(mdc);
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    let svgText = (await response.text()).trim();
    // Strip injected script tags that may be added by proxies
    svgText = svgText.split("<script")[0].trim();
    if (!svgText) return null;
    return `data:image/svg+xml,${encodeURIComponent(svgText)}`;
  } catch {
    return null;
  }
};

export const DEFAULT_CLF_LEVELS = new Set(DEFAULT_NETWORK_CLF_LEVELS);
export const DEFAULT_CLF_TYPES = new Set(DEFAULT_NETWORK_CLF_TYPES);

const TRANSLATION_STOPWORDS = new Set([
  "to",
  "the",
  "a",
  "an",
  "of",
  "and",
  "or",
  "in",
  "on",
  "for",
  "with",
  "from",
  "by",
  "into",
  "onto",
  "over",
  "under",
  "about",
  "around",
  "between",
  "within",
  "without",
  "through",
  "across",
  "toward",
  "towards",
  "up",
  "down",
  "off",
  "as",
  "at",
  "is",
  "are",
  "be",
  "being",
  "been",
  "was",
  "were"
]);

const POS_PREFIXES = [
  "adj",
  "adjective",
  "adv",
  "adverb",
  "n",
  "noun",
  "v",
  "verb",
  "vb",
  "pron",
  "pronoun",
  "prep",
  "preposition",
  "conj",
  "conjunction",
  "det",
  "determiner",
  "art",
  "article",
  "part",
  "particle",
  "num",
  "numeral",
  "int",
  "interj",
  "interjection",
  "aux",
  "auxiliary",
  "cop",
  "copula",
  "modal",
  "prefix",
  "suffix",
  "inf",
  "infinitive",
  "ptcp",
  "participle"
];
const POS_PREFIX_SET = new Set(POS_PREFIXES);
const MEANING_SKIP_WORDS = new Set([
  ...TRANSLATION_STOPWORDS,
  ...POS_PREFIXES,
  "eg",
  "e.g",
  "ie",
  "i.e",
  "etc",
  "cf",
  "esp",
  "misc",
  "abbr"
]);

const POS_PREFIX_RE = new RegExp(
  `^\\s*[\\[(]?\\s*(?:${POS_PREFIXES.join("|")})\\b\\.?\\s*[\\])]?\\s*(?:[\\s.:;,/|\\-]+)(.*)$`,
  "i"
);

const normalizeTranslationWord = (word: string) => {
  return word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
};

const stripLeadingInfinitive = (text: string) => {
  const match = String(text || "").trim().match(/^to\s+(.+)/i);
  if (!match || !match[1]) return String(text || "").trim();
  const stripped = match[1].trim();
  return stripped || String(text || "").trim();
};

const stripLeadingPosMarkers = (text: string) => {
  let cleaned = String(text || "").trim();
  if (!cleaned) return "";
  let safety = 0;
  while (safety < 5) {
    const match = cleaned.match(POS_PREFIX_RE);
    if (!match || !match[1]) break;
    cleaned = match[1].trim();
    safety += 1;
  }
  return cleaned;
};

const countContentWords = (text: string) => {
  if (!text) return 0;
  const words = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let count = 0;
  for (const word of words) {
    const normalized = normalizeTranslationWord(word);
    if (!normalized) continue;
    if (!TRANSLATION_STOPWORDS.has(normalized)) {
      count += 1;
    }
  }
  return count;
};

const NON_BREAKING_SPACE = "\u00A0";

const getWordLength = (word: string) => {
  const cleaned = word.replace(/[^A-Za-z0-9]/g, "");
  return cleaned ? cleaned.length : word.length;
};

const joinTranslationWords = (words: string[], lockWords = false) => {
  if (words.length === 0) return "";
  const parts: string[] = [];
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    if (i === words.length - 1) {
      parts.push(word);
      continue;
    }
    const wordLen = getWordLength(word);
    const spacer = lockWords
      ? NON_BREAKING_SPACE
      : wordLen > 0 && wordLen <= 3
        ? NON_BREAKING_SPACE
        : " ";
    parts.push(`${word}${spacer}`);
  }
  return parts.join("");
};

const DASH_CHARS = "-\u2010\u2011\u2012\u2013\u2014\u2015\u2212";
const DASH_RE = new RegExp(`[${DASH_CHARS}]`);

const MAX_TRANSLATION_LINE_CHARS = 13;

const splitLongDashWord = (word: string, maxLen: number) => {
  if (!DASH_RE.test(word)) return word;
  let breakIndex = -1;
  for (let i = 0; i < word.length; i += 1) {
    if (DASH_RE.test(word[i])) {
      const segmentLen = getWordLength(word.slice(0, i + 1));
      if (segmentLen <= maxLen) {
        breakIndex = i;
      }
    }
  }
  if (breakIndex === -1) return word;
  return `${word.slice(0, breakIndex + 1)}\n${word.slice(breakIndex + 1)}`;
};

const formatTranslationForNetwork = (translation: string) => {
  const words = translation
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return translation;

  if (words.length === 1) {
    return splitLongDashWord(words[0], MAX_TRANSLATION_LINE_CHARS);
  }

  if (words.length === 2) {
    const firstLen = getWordLength(words[0]);
    const secondLen = getWordLength(words[1]);
    if (firstLen + secondLen > MAX_TRANSLATION_LINE_CHARS) {
      const firstLine = joinTranslationWords([words[0]], true);
      const secondLine = joinTranslationWords([words[1]], true);
      return `${firstLine}\n${secondLine}`;
    }
    return joinTranslationWords(words, true);
  }

  const firstLen = getWordLength(words[0]);
  const secondLen = words.length > 1 ? getWordLength(words[1]) : 0;
  const shouldBreakAfterTwo = words.length > 2 && (firstLen + secondLen <= MAX_TRANSLATION_LINE_CHARS);

  if (shouldBreakAfterTwo) {
    const firstLine = joinTranslationWords(words.slice(0, 2), true);
    const secondLine = joinTranslationWords(words.slice(2), true);
    return secondLine ? `${firstLine}\n${secondLine}` : firstLine;
  }

  return joinTranslationWords(words, true);
};

function normalizeClfLevel(levelValue: unknown): number {
  const normalized = normalizeClassifierLevelNumber(levelValue);
  return normalized > 0 ? normalized : 1;
}

function classifierTypeMatches(typeValue: string | null | undefined, clfTypes: Set<string>): boolean {
  return classifierTypeMatchesSelection(typeValue, clfTypes);
}

export function buildClassifierMapsFromMetadata(metadata: ClassifierMetadata[]) {
  const clfData: ClfData = {};
  const clfParseData: ClfParseData = {};
  const clfKeyToId = new Map<string, number>();
  let nextClfId = 1;

  metadata.forEach((entry, index) => {
    if (!entry.gardiner_number) return;
    const level = normalizeClfLevel(entry.clf_level);
    const rawType = entry.clf_type ?? (entry as any).type ?? "";
    const normalizedType = String(rawType || "").trim() || "taxonomic";
    const key = `${entry.gardiner_number}|${normalizedType}|${level}`;
    let clfId = clfKeyToId.get(key);
    if (!clfId) {
      clfId = nextClfId++;
      clfKeyToId.set(key, clfId);
      clfData[clfId] = {
        id: clfId,
        mdc: entry.gardiner_number,
        type: normalizedType,
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
 * Get color for classifier based on its level
 * level 1 (semantic/encyclopedic): blue
 * level 2: orange
 * level 3: purple
 * level 5 (phonetic): grey
 */
export function getClassifierColorByLevel(level: number | string): string {
  const lvl = typeof level === 'string' ? parseInt(level, 10) : level;

  switch(lvl) {
    case 1:
      return 'blue';
    case 2:
      return 'orange';
    case 3:
      return 'purple';
    case 5:
      return 'grey';
    default:
      return 'red'; // fallback color
  }
}

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
        const classifier = temp.join('').trim();
        if (classifier) {
          result.push(classifier);
        }
      }
    } else if (inside_clf) {
      temp.push(s.charAt(i));
    }
  }
  return result;
}

/**
 * Color classifiers in markup for display
 * @param mdc_w_markup - The MDC string with classifier markup (~clf~)
 * @param classifierMetadata - Optional map of classifier MDC to metadata (with level info)
 * @param projectType - Optional project type; if "hieroglyphic", always use blue for Egyptian
 */
export function colourClassifiers(
  mdc_w_markup: string | null,
  classifierMetadata?: Record<string, any>,
  projectType?: string
): string {
  if (!mdc_w_markup) return '';

  let buffer: string[] = [];
  let insideClf = false;
  let currentClf = '';

  for (let i = 0; i < mdc_w_markup.length; i++) {
    if (mdc_w_markup.charAt(i) === '~') {
      if (!insideClf) {
        insideClf = true;
        currentClf = '';
      } else {
        insideClf = false;
        // Determine color for this classifier
        let color = 'blue'; // default

        if (projectType === 'hieroglyphic') {
          // Egyptian projects: always blue
          color = 'blue';
        } else if (classifierMetadata && classifierMetadata[currentClf]) {
          // Other projects: color based on level
          const meta = classifierMetadata[currentClf];
          const level = normalizeClfLevel(meta.clf_level || meta.level);
          color = getClassifierColorByLevel(level);
        }

        buffer.push(`<span style="color: ${color}">`);
        buffer.push(currentClf);
        buffer.push('</span>');
        currentClf = '';
      }
    } else if (insideClf) {
      currentClf += mdc_w_markup.charAt(i);
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
 * Extract English translation from lemma meaning
 * Looks for pattern "en: [...]" and extracts content from brackets
 * Example: "ḥm.w 'en: [a plant (fenugreek?)]; de: [Pflanzenteil]'"
 * Returns: "a plant (fenugreek?)"
 */
function extractEnglishMeaning(meaning: string | null | undefined): string | null {
  if (!meaning) return null;

  const meaningStr = decodeHtmlEntities(String(meaning).trim());
  // Look for "en: [content]" pattern
  const enMatch = meaningStr.match(/en:\s*\[([^\]]+)\]/);
  if (enMatch && enMatch[1]) {
    return enMatch[1].trim();
  }

  // If no en: pattern found, return original meaning (for backward compatibility)
  return meaningStr;
}

/**
 * Extract lemma translation from meaning field
 * Extracts ALL WORDS before the first punctuation mark
 * Handles both Egyptian ("en: ...") and Sumerian (parentheses) formats
 *
 * Examples:
 *   Egyptian: "en: charioteer (Sem. loan word); de: Wagenlenker" -> "charioteer"
 *   Egyptian: "en: to send quickly; de: aussenden" -> "to send quickly"
 *   Sumerian: "dug (speech; to do, perform; ...)" -> "speech"
 *   Fallback: "misery; pain; injury" -> "misery"
 */
export function extractLemmaTranslation(meaning: string | null | undefined): string | null {
  if (!meaning) return null;

  const meaningStr = stripHtmlTags(decodeHtmlEntities(String(meaning).trim()));

  const extractLang = (code: string) => {
    const bracketMatch = meaningStr.match(new RegExp(`${code}:\\s*\\[([^\\]]*)\\]`, "i"));
    if (bracketMatch) return (bracketMatch[1] || "").trim();
    const plainMatch = meaningStr.match(new RegExp(`${code}:\\s*([^;()]+)`, "i"));
    if (plainMatch) return (plainMatch[1] || "").trim();
    return "";
  };

  const normalizeLangContent = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const unwrapped = trimmed.replace(/^\[|\]$/g, "").trim();
    return stripHtmlTags(unwrapped);
  };

  let englishContent = normalizeLangContent(extractLang("en"));

  if (!englishContent) {
    englishContent = normalizeLangContent(extractLang("de"));
  }

  if (!englishContent) {
    // Priority 3: Look for content in early parentheses (Sumerian format)
    // Pattern: "word (content; more content; ...)" or "(adj. ...)"
    const firstParen = meaningStr.indexOf("(");
    const firstSemicolon = meaningStr.indexOf(";");
    const hasEarlyParen = firstParen !== -1
      && (firstSemicolon === -1 || firstParen < firstSemicolon)
      && firstParen <= 12;
    if (hasEarlyParen) {
      const parenMatch = meaningStr.slice(firstParen).match(/^\(([^;)]+)/);
      if (parenMatch && parenMatch[1]) {
        englishContent = parenMatch[1].trim();
      }
    }
  }

  if (!englishContent) {
    // Priority 4: Fallback - use the whole meaning string
    englishContent = meaningStr;
  }

  if (!englishContent) return null;

  // Extract ALL WORDS before punctuation, but keep the next segment if the first is only stopwords
  const segments = englishContent
    .split(/[;,()[\]]/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) return null;

  let combined = segments[0];
  let contentCount = countContentWords(combined);
  let index = 1;
  while (contentCount === 0 && index < segments.length) {
    combined = `${combined} ${segments[index]}`.trim();
    contentCount = countContentWords(combined);
    index += 1;
  }

  const stripped = stripLeadingInfinitive(combined);
  return stripHtmlTags(stripped) || null;
}

const truncateLemmaTransliteration = (transliteration: string | null | undefined) => {
  const trimmed = String(transliteration || "").trim();
  if (!trimmed) return "";
  let dashCount = 0;
  for (let i = 0; i < trimmed.length; i += 1) {
    if (trimmed[i] === "-") {
      dashCount += 1;
      if (dashCount === 3) {
        return trimmed.slice(0, i + 1);
      }
    }
  }
  return trimmed;
};

const truncateLemmaTranslation = (meaning: string | null | undefined) => {
  const translation = extractLemmaTranslation(meaning);
  if (!translation) return "";
  const cleaned = stripLeadingPosMarkers(translation);
  if (!cleaned) return "";
  const firstSegment = cleaned
    .split(/[;；]/)
    .map((segment) => segment.trim())
    .find((segment) => segment.length > 0) || "";
  if (!firstSegment) return "";

  const withoutTo = stripLeadingInfinitive(firstSegment);
  if (withoutTo && withoutTo !== firstSegment) {
    return formatTranslationForNetwork(withoutTo);
  }

  const tokens = firstSegment.match(/[A-Za-z][A-Za-z0-9'’-]*/g) || [];
  if (tokens.length === 0) return "";

  let firstWord = "";
  let firstWordIndex = -1;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const normalized = normalizeTranslationWord(token);
    if (!normalized) continue;
    const compact = normalized.replace(/[^a-z0-9]/g, "");
    if (!compact) continue;
    if (MEANING_SKIP_WORDS.has(normalized) || MEANING_SKIP_WORDS.has(compact)) continue;
    if (POS_PREFIX_SET.has(normalized) || POS_PREFIX_SET.has(compact)) continue;
    firstWord = token;
    firstWordIndex = i;
    break;
  }

  if (!firstWord) {
    firstWord = tokens[0];
  }

  if (normalizeTranslationWord(firstWord) === "do" && firstWordIndex >= 0) {
    const nextToken = tokens[firstWordIndex + 1];
    if (nextToken) {
      return formatTranslationForNetwork(`${firstWord} ${nextToken}`);
    }
  }

  return formatTranslationForNetwork(firstWord);
};

const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const stripHtmlTags = (value: string) => {
  if (!value || !value.includes("<")) return value;
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
};

const decodeHtmlEntities = (value: string) => {
  if (!value || !value.includes("&")) return value;
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: " "
  };
  return value.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity.startsWith("#x")) {
      const code = parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith("#")) {
      const code = parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return Object.prototype.hasOwnProperty.call(named, entity) ? named[entity] : match;
  });
};

export const formatLemmaOriginLabel = (
  transliteration: string | null | undefined,
  fallback = ""
) => {
  const label = truncateLemmaTransliteration(transliteration);
  if (label) return label;
  const fallbackLabel = truncateLemmaTransliteration(fallback);
  return fallbackLabel || "";
};

const isEgyptianProjectType = (projectType?: string) => projectType === "hieroglyphic";

const formatTranslationLabel = (translation: string, asHtml: boolean) => {
  const lines = String(translation || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";
  if (asHtml) {
    return lines.map((line) => escapeHtml(line)).join("\n");
  }
  return lines.join("\n");
};

export const formatLemmaOriginLabelItalic = (
  transliteration: string | null | undefined,
  fallback = "",
  projectType?: string
) => {
  const label = formatLemmaOriginLabel(transliteration, fallback);
  if (!label) return "";
  if (isEgyptianProjectType(projectType)) {
    return `<i>${escapeHtml(label)}</i>`;
  }
  return label;
};

export const formatLemmaTranslationLabel = (
  meaning: string | null | undefined,
  transliteration?: string | null,
  fallback = "",
  projectType?: string
) => {
  const translation = extractLemmaTranslation(meaning);
  if (translation) {
    const cleaned = stripLeadingPosMarkers(translation) || translation;
    const formatted = formatTranslationForNetwork(cleaned);
    return formatTranslationLabel(formatted, isEgyptianProjectType(projectType));
  }
  const fallbackLabel = formatLemmaOriginLabel(transliteration, fallback);
  if (!fallbackLabel) return "";
  return isEgyptianProjectType(projectType) ? escapeHtml(fallbackLabel) : fallbackLabel;
};

export const formatLemmaOriginTranslationLabel = (
  meaning: string | null | undefined,
  transliteration?: string | null,
  fallback = "",
  projectType?: string
) => {
  const origin = formatLemmaOriginLabel(transliteration, fallback);
  const translation = truncateLemmaTranslation(meaning);
  const originHtml = isEgyptianProjectType(projectType)
    ? `<i>${escapeHtml(origin)}</i>`
    : origin;
  if (!translation) return originHtml;
  const translationHtml = formatTranslationLabel(translation, isEgyptianProjectType(projectType));
  if (!originHtml) return translationHtml;
  return `${originHtml}\n${translationHtml}`;
};
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
    lemmaFontFace,
    classifierFontFace = 'hierofont',
    classifierMeanings,
    projectId,
    classifierDisplayMode = 'visual',
    lemmaDisplayMode = 'origin',
    classifierNodeSize = CLF_NODE_HEIGHT,
    classifierNodeWidth = CLF_NODE_WIDTH,
    classifierNodeHeight = CLF_NODE_HEIGHT,
    classifierNodeRadius = CLF_NODE_RADIUS
  } = config;
  const resolvedLemmaFontFace = lemmaFontFace || getLemmaNodeFontFace(config.projectType);
  const isLuwianProject = projectId === "luwiancorpus";

  const classifierEntries = Object.entries(clfDict);
  const classifierCount = classifierEntries.length;
  const radialBase = Math.max(140, Math.min(360, 80 + Math.sqrt(classifierCount) * 50));
  const edgeLength = Math.max(120, radialBase * 0.85);

  // Central lemma node (legacy styling)
  const lemmaNodeId = `lemma_${lemmaId}`;

  const lemmaLabel = lemmaDisplayMode === "both"
    ? formatLemmaOriginTranslationLabel(lemma.meaning, lemma.transliteration, String(lemmaId), config.projectType)
    : lemmaDisplayMode === "translation"
      ? formatLemmaTranslationLabel(lemma.meaning, lemma.transliteration, String(lemmaId), config.projectType)
      : formatLemmaOriginLabelItalic(lemma.transliteration, String(lemmaId), config.projectType);

  // Build tooltip showing translation
  const lemmaTooltipBase = formatLemmaOriginLabel(lemma.transliteration, String(lemmaId));
  let lemmaTooltip = lemmaTooltipBase;
  const translation = extractLemmaTranslation(lemma.meaning);
  if (translation) {
    lemmaTooltip = `${lemmaTooltipBase}\n→ ${translation}`;
  }

  nodes.push({
    id: lemmaNodeId,
    label: lemmaLabel,
    color: { background: 'white', border: 'black' },
    font: {
      color: NETWORK_TEXT_COLOR,
      size: 14,
      face: resolvedLemmaFontFace,
      align: 'center',
      valign: 'top',
      multi: needsHtmlLabel(lemmaLabel) ? "html" : true
    },
    size: 40,
    shape: 'circle',
    type: 'lemma',
    x: 0,
    y: 0,
    fixed: { x: true, y: true },
    title: lemmaTooltip
  });
  nodeIds.add(lemmaNodeId);

  // Classifier nodes - keep a consistent rectangular size across networks
  classifierEntries.forEach(([classifier, count], index) => {
    const classifierNodeId = `classifier_${classifier}`;
    if (!nodeIds.has(classifierNodeId)) {
      const meaning = classifierMeanings?.[classifier] || "";
      const formattedMeaning = formatClassifierMeaning(meaning, projectId);
      let label = "";
      let fontFace = classifierFontFace;
      let fontSize = 18;
      const meaningLabel = formatClassifierMeaningLabel(meaning, projectId, { html: true });
      const luwianSvgPath =
        isLuwianProject && classifierDisplayMode === "visual"
          ? getLuwianGlyphSvgPath(classifier)
          : null;
      const luwianImage = luwianSvgPath ? wrapClassifierImage(luwianSvgPath) : null;

      if (classifierDisplayMode === "meaning") {
        label = meaningLabel || classifier;
        fontFace = "sans-serif";
        fontSize = 10;
      } else if (luwianImage) {
        label = "";
      } else if (useUnicode && mdc2uni[classifier]) {
        label = `<b>${escapeHtml(String(mdc2uni[classifier]))}</b>`;
        fontSize = Math.round(18 * 1.5);
      } else {
        label = classifier;
        fontSize = 11;
      }

      // Build tooltip showing meaning
      const glyph = mdc2uni[classifier] || classifier;
      let tooltip = `${glyph} ${classifier}`;
      if (formattedMeaning) {
        tooltip = `${tooltip}\n→ ${formattedMeaning}`;
      }

      const angle = classifierCount > 0 ? (index / classifierCount) * Math.PI * 2 : 0;
      const x = Math.cos(angle) * radialBase;
      const y = Math.sin(angle) * radialBase;

      nodes.push({
        id: classifierNodeId,
        label,
        mdc: classifier,
        color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
        font: {
          color: '#000000',
          size: fontSize,
          face: fontFace,
          align: 'center',
          valign: 'middle',
          multi: needsHtmlLabel(label) ? "html" : false
        },
        size: classifierNodeSize,
        shape: luwianImage ? "image" : "box",
        image: luwianImage || undefined,
        brokenImage: luwianImage ? BROKEN_IMAGE_PLACEHOLDER : undefined,
        shapeProperties: luwianImage
          ? { borderDashes: false, useBorderWithImage: false, interpolation: false, useImageSize: true }
          : { borderRadius: classifierNodeRadius, borderDashes: false },
        widthConstraint: { minimum: classifierNodeWidth, maximum: classifierNodeWidth },
        heightConstraint: { minimum: classifierNodeHeight, maximum: classifierNodeHeight },
        type: 'classifier',
        x,
        y,
        title: tooltip,
      });
      nodeIds.add(classifierNodeId);
    }

    // Edge from lemma to classifier
    edges.push({
      from: lemmaNodeId,
      to: classifierNodeId,
      width: Math.max(count, 1),
      color: { color: LEMMA_CLASSIFIER_EDGE_COLOR },
      label: undefined,
      font: undefined
    });
    const edge = edges[edges.length - 1];
    edge.length = edgeLength;
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
): NetworkMapData {
  const clfNodeDict: { [key: string]: number } = {};
  const lemNodeDict: { [key: string]: number } = {};
  const lemEdgeDict: { [key: string]: number } = {};
  const clfEdgeDict: { [key: string]: number } = {};
  const lemmaPosCounts: Record<number, Record<string, number>> = {};
  const posSet = new Set<string>();
  
  for (const key in tokenData) {
    const token = tokenData[key];
    if (!shouldIncludeToken(token, config, witnessData)) continue;
    
    const clfs = extractClassifiersFromString(token.mdc_w_markup)
      .map(normalizeClassifierMdc)
      .filter(Boolean);
    if (clfs.length === 0) continue;
    
    const lemmaId = token.lemma_id;
    if (!lemmaId) continue;

    const tokenPos = token?.pos === null || token?.pos === undefined
      ? ""
      : String(token.pos).trim();
    if (tokenPos) {
      posSet.add(tokenPos);
      if (!lemmaPosCounts[lemmaId]) {
        lemmaPosCounts[lemmaId] = {};
      }
      lemmaPosCounts[lemmaId][tokenPos] = (lemmaPosCounts[lemmaId][tokenPos] || 0) + 1;
    }
    
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

  const lemmaPosById: Record<number, string> = {};
  Object.entries(lemmaPosCounts).forEach(([lemmaId, counts]) => {
    const dominant = getDominantPos(counts);
    if (dominant) {
      lemmaPosById[Number(lemmaId)] = dominant;
    }
  });
  const mergedLemmaPosById = { ...(config.lemmaPosById || {}), ...lemmaPosById };
  const posColorMap = config.posColorMap || buildPosColorMap(Array.from(posSet));
  
  return createMapNetworkFromDicts(
    clfNodeDict,
    lemNodeDict,
    lemEdgeDict,
    clfEdgeDict,
    lemmaData,
    { ...config, lemmaPosById: mergedLemmaPosById, posColorMap }
  );
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
): NetworkMapData {
  const {
    clfLevels = DEFAULT_CLF_LEVELS,
    clfTypes = DEFAULT_CLF_TYPES
  } = config;
  
  const clfNodeDict: { [key: string]: number } = {};
  const lemNodeDict: { [key: string]: number } = {};
  const lemEdgeDict: { [key: string]: number } = {};
  const clfEdgeDict: { [key: string]: number } = {};
  const clfCombsDict: { [key: string]: string[] } = {}; // Track which clfs appear together
  const lemmaPosCounts: Record<number, Record<string, number>> = {};
  const posSet = new Set<string>();
  const posCountedTokens = new Set<number>();
  
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

      if (!posCountedTokens.has(tokenId)) {
        posCountedTokens.add(tokenId);
        const tokenPos = token?.pos === null || token?.pos === undefined
          ? ""
          : String(token.pos).trim();
        if (tokenPos) {
          posSet.add(tokenPos);
          if (!lemmaPosCounts[lemmaId]) {
            lemmaPosCounts[lemmaId] = {};
          }
          lemmaPosCounts[lemmaId][tokenPos] = (lemmaPosCounts[lemmaId][tokenPos] || 0) + 1;
        }
      }
      
      const normalizedClf = normalizeClassifierMdc(clf.mdc);
      if (!normalizedClf) return;

      // Edge from lemma to classifier
      const lemEdgeKey = `${normalizedClf}>${lemmaId}`;
      lemEdgeDict[lemEdgeKey] = (lemEdgeDict[lemEdgeKey] || 0) + 1;
      
      // Track classifier combinations for this token
      if (!clfCombsDict[tokenId]) {
        clfCombsDict[tokenId] = [];
      }
      clfCombsDict[tokenId].push(normalizedClf);
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

  const lemmaPosById: Record<number, string> = {};
  Object.entries(lemmaPosCounts).forEach(([lemmaId, counts]) => {
    const dominant = getDominantPos(counts);
    if (dominant) {
      lemmaPosById[Number(lemmaId)] = dominant;
    }
  });
  const mergedLemmaPosById = { ...(config.lemmaPosById || {}), ...lemmaPosById };
  const posColorMap = config.posColorMap || buildPosColorMap(Array.from(posSet));
  
  return createMapNetworkFromDicts(
    clfNodeDict,
    lemNodeDict,
    lemEdgeDict,
    clfEdgeDict,
    lemmaData,
    { ...config, lemmaPosById: mergedLemmaPosById, posColorMap }
  );
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
): NetworkMapData {
  Object.keys(clfEdgeDict).forEach((edgeKey) => {
    const [rawHead] = edgeKey.split(">");
    const head = normalizeClassifierMdc(rawHead);
    if (!head) return;
    clfNodeDict[head] = (clfNodeDict[head] || 0) + 1;
  });
  Object.keys(lemEdgeDict).forEach((edgeKey) => {
    const [rawHead, tail] = edgeKey.split(">");
    const head = normalizeClassifierMdc(rawHead);
    if (!head) return;
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
  const lemmaFontFace = config.lemmaFontFace || getLemmaNodeFontFace(config.projectType);
  const classifierFontFace = config.classifierFontFace || "sans-serif";
  const classifierFontScale = config.classifierFontScale ?? 1;
  const useUnicode = config.useUnicode !== false;
  const classifierMeanings = config.classifierMeanings;
  const projectId = config.projectId;
  const lemmaLabelMode = config.lemmaLabelMode || "transliteration";
  const projectType = config.projectType;
  const isHieroglyphic = projectType === "hieroglyphic";
  const classifierNodeSize = config.classifierNodeSize ?? CLF_NODE_HEIGHT;
  const classifierNodeWidth = config.classifierNodeWidth ?? CLF_NODE_WIDTH;
  const classifierNodeHeight = config.classifierNodeHeight ?? CLF_NODE_HEIGHT;
  const classifierNodeRadius = config.classifierNodeRadius ?? CLF_NODE_RADIUS;
  const lemmaColorMode = config.lemmaColorMode || "default";
  const lemmaPosById = config.lemmaPosById || {};
  const posColorMap = config.posColorMap || {};
  const isLuwianProject = projectId === "luwiancorpus";
  
  // Add classifier nodes
  const sortedClfs = Object.keys(limitedClfNodeDict).sort(compareClfMDC);
  const classifierDisplayMode = config.classifierDisplayMode || "visual";

  sortedClfs.forEach((clf) => {
    const normalizedClf = normalizeClassifierMdc(clf);
    const unicodeGlyph = useUnicode ? mdc2uni[normalizedClf] : undefined;
    const hasUnicodeGlyph = isHieroglyphic && Boolean(unicodeGlyph);
    const meaning = classifierMeanings?.[normalizedClf] || "";
    const meaningLabel = formatClassifierMeaningLabel(meaning, projectId, { html: true });
    let label = "";
    let fontFace = classifierFontFace;
    let fontSize = 12;
    const luwianSvgPath =
      isLuwianProject && classifierDisplayMode === "visual"
        ? getLuwianGlyphSvgPath(clf)
        : null;
    const luwianImage = luwianSvgPath ? wrapClassifierImage(luwianSvgPath) : null;

    if (classifierDisplayMode === "meaning") {
      label = meaningLabel || normalizedClf;
      fontFace = "sans-serif";
      fontSize = 10;
    } else if (luwianImage) {
      label = "";
    } else if (hasUnicodeGlyph) {
      label = `<b>${escapeHtml(String(unicodeGlyph || ""))}</b>`;
      fontSize = Math.round(18 * 1.5);
    } else {
      // JSesh/SVG will replace this label after render; keep fallback visible
      label = normalizedClf;
      fontSize = 11;
    }

    if (classifierFontScale !== 1) {
      fontSize *= classifierFontScale;
    }

    const displayGlyph = hasUnicodeGlyph ? unicodeGlyph : normalizedClf;
    const tooltipMeaning = formatClassifierMeaning(meaning, projectId);

    nodes.push({
      id: `classifier_${normalizedClf}`,
      label: label || "",
      mdc: normalizedClf,
      color: { background: JSESH_NODE_COLOR, border: JSESH_NODE_COLOR },
      font: {
        color: '#000000',
        size: fontSize,
        face: fontFace,
        align: 'center',
        valign: 'middle',
        multi: needsHtmlLabel(label) ? "html" : false
      },
      size: classifierNodeSize,
      shape: luwianImage ? "image" : "box",
      image: luwianImage || undefined,
      brokenImage: luwianImage ? BROKEN_IMAGE_PLACEHOLDER : undefined,
      shapeProperties: luwianImage
        ? { borderDashes: false, useBorderWithImage: false, interpolation: false, useImageSize: true }
        : { borderRadius: classifierNodeRadius, borderDashes: false },
      widthConstraint: { minimum: classifierNodeWidth, maximum: classifierNodeWidth },
      heightConstraint: { minimum: classifierNodeHeight, maximum: classifierNodeHeight },
      type: 'classifier',
      title: `${displayGlyph}${tooltipMeaning ? ` [${tooltipMeaning}]` : ''}\n\nClick: Toggle display mode | Double-click: Open classifier`,
    });
  });
  
  // Add lemma nodes
  Object.keys(limitedLemNodeDict).forEach(lemmaIdStr => {
    const lemmaId = parseInt(lemmaIdStr);
    const lemma = lemmaData[lemmaId];
    if (!lemma) return;

    const size = 20;
    let lemmaLabel: string;

    if (config.lemmaDisplayMode === "both") {
      lemmaLabel = formatLemmaOriginTranslationLabel(lemma.meaning, lemma.transliteration, `${lemmaId}`, config.projectType);
    } else if (config.lemmaDisplayMode === "translation") {
      lemmaLabel = formatLemmaTranslationLabel(lemma.meaning, lemma.transliteration, `${lemmaId}`, config.projectType);
    } else {
      lemmaLabel = formatLemmaOriginLabelItalic(lemma.transliteration, `${lemmaId}`, config.projectType);
    }

    const lemmaPos = lemmaPosById[lemmaId];
    const posColor =
      lemmaColorMode === "pos" && lemmaPos && posColorMap[lemmaPos]
        ? posColorMap[lemmaPos]
        : null;
    const lemmaBackground = posColor || "white";
    const lemmaBorder = posColor ? NETWORK_TEXT_COLOR : "black";
    const lemmaTitle = posColor && lemmaPos
      ? `POS: ${lemmaPos}\n\nClick: Toggle display mode | Double-click: Open lemma`
      : `Click: Toggle display mode | Double-click: Open lemma`;

    nodes.push({
      id: `lemma_${lemmaId}`,
      label: lemmaLabel,
      color: { background: lemmaBackground, border: lemmaBorder },
      font: {
        color: NETWORK_TEXT_COLOR,
        size: 12,
        face: lemmaFontFace,
        align: 'center',
        valign: 'top',
        multi: needsHtmlLabel(lemmaLabel) ? "html" : true
      },
      size,
      shape: 'circle',
      type: 'lemma',
      title: lemmaTitle
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
      color: { color: LEMMA_CLASSIFIER_EDGE_COLOR }
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
      color: { color: CLASSIFIER_COOCCURRENCE_EDGE_COLOR }
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

const getClassifierFromNodeId = (nodeId: string): string | null => {
  return nodeId.startsWith("classifier_") ? nodeId.slice("classifier_".length) : null;
};

const getLemmaFromNodeId = (nodeId: string): string | null => {
  return nodeId.startsWith("lemma_") ? nodeId.slice("lemma_".length) : null;
};

/**
 * Limit a computed network to the top classifiers by token frequency.
 * Token frequency is estimated from lemma-classifier edge weights.
 */
export function limitNetworkToTopClassifiers(
  networkData: NetworkMapData,
  maxClassifiers: number = NETWORK_TOP_CLASSIFIER_LIMIT
): {
  networkData: NetworkMapData;
  wasLimited: boolean;
  totalClassifierCount: number;
  visibleClassifierCount: number;
} {
  const classifierEntries = Object.entries(networkData?.clfNodeDict || {});
  const totalClassifierCount = classifierEntries.length;
  if (maxClassifiers <= 0 || totalClassifierCount <= maxClassifiers) {
    return {
      networkData,
      wasLimited: false,
      totalClassifierCount,
      visibleClassifierCount: totalClassifierCount
    };
  }

  const tokenCounts: Record<string, number> = {};
  Object.entries(networkData.lemEdgeDict || {}).forEach(([edgeKey, rawWeight]) => {
    const [clf] = edgeKey.split(">");
    const weight = Number(rawWeight);
    tokenCounts[clf] = (tokenCounts[clf] || 0) + (Number.isFinite(weight) ? weight : 0);
  });

  const rankedClassifiers = classifierEntries
    .map(([clf, nodeCount]) => ({
      clf,
      nodeCount,
      tokenCount: tokenCounts[clf] || 0
    }))
    .sort((a, b) => {
      const byTokens = b.tokenCount - a.tokenCount;
      if (byTokens !== 0) return byTokens;
      const byNodes = b.nodeCount - a.nodeCount;
      if (byNodes !== 0) return byNodes;
      return a.clf.localeCompare(b.clf);
    });

  const visibleClassifiers = new Set(
    rankedClassifiers.slice(0, maxClassifiers).map(({ clf }) => clf)
  );

  const clfNodeDict: Record<string, number> = {};
  visibleClassifiers.forEach((clf) => {
    clfNodeDict[clf] = networkData.clfNodeDict[clf] || 0;
  });

  const lemEdgeDict: Record<string, number> = {};
  const visibleLemmaIds = new Set<string>();
  Object.entries(networkData.lemEdgeDict || {}).forEach(([edgeKey, weight]) => {
    const [clf, lemmaId] = edgeKey.split(">");
    if (!visibleClassifiers.has(clf)) return;
    lemEdgeDict[edgeKey] = weight;
    visibleLemmaIds.add(lemmaId);
  });

  const lemNodeDict: Record<string, number> = {};
  visibleLemmaIds.forEach((lemmaId) => {
    lemNodeDict[lemmaId] = networkData.lemNodeDict[lemmaId] || 1;
  });

  const clfEdgeDict: Record<string, number> = {};
  Object.entries(networkData.clfEdgeDict || {}).forEach(([edgeKey, weight]) => {
    const [clf1, clf2] = edgeKey.split(">");
    if (!visibleClassifiers.has(clf1) || !visibleClassifiers.has(clf2)) return;
    clfEdgeDict[edgeKey] = weight;
  });

  const nodes = (networkData.nodes || []).filter((node) => {
    const classifierId = getClassifierFromNodeId(node.id);
    if (classifierId !== null) {
      return visibleClassifiers.has(classifierId);
    }
    const lemmaId = getLemmaFromNodeId(node.id);
    if (lemmaId !== null) {
      return visibleLemmaIds.has(lemmaId);
    }
    return true;
  });

  const isVisibleNodeId = (nodeId: string) => {
    const classifierId = getClassifierFromNodeId(nodeId);
    if (classifierId !== null) return visibleClassifiers.has(classifierId);
    const lemmaId = getLemmaFromNodeId(nodeId);
    if (lemmaId !== null) return visibleLemmaIds.has(lemmaId);
    return true;
  };

  const edges = (networkData.edges || []).filter(
    (edge) => isVisibleNodeId(edge.from) && isVisibleNodeId(edge.to)
  );

  return {
    networkData: {
      nodes,
      edges,
      clfNodeDict,
      lemNodeDict,
      lemEdgeDict,
      clfEdgeDict
    },
    wasLimited: true,
    totalClassifierCount,
    visibleClassifierCount: visibleClassifiers.size
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
        centralGravity: 0.16,
        springLength: NETWORK_EDGE_LENGTH,
        springConstant: 0.035,
        damping: 0.24,
        avoidOverlap: 0.65
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
      font: {
        color: NETWORK_TEXT_COLOR
      },
      chosen: {
        node: function(values: any, id: string, selected: boolean, hovering: boolean) {
          values.borderWidth = selected || hovering ? 2 : 1;
        }
      }
    },
    edges: {
      length: NETWORK_EDGE_LENGTH,
      smooth: {
        enabled: true,
        type: 'dynamic',
        roundness: NETWORK_EDGE_ROUNDNESS
      },
      font: {
        color: NETWORK_TEXT_COLOR,
        strokeWidth: 0
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
