export interface Token {
  id: number;
  lemma_id: number;
  mdc_w_markup: string;
  mdc: string;
  witness_id: string;
  compound_id: number | null;
  pos?: string; // Part of speech
  supertext_id?: number | null;
  coordinates_in_txt?: string | null;
  coordinates_in_witness?: string | null;
  transliteration?: string | null;
  classification_status?: string | null;
  sign_comments?: string | null;
  context_meaning?: string | null;
  syntactic_relation?: string | null;
  register?: string | null;
  comments?: string | null;
  other?: string | null;
  phonetic_reconstruction?: string | null;
  translation?: string | null;
  tla_sentence_id?: string | null;
}

export interface ClassifierMetadata {
  gardiner_number: string;
  token_id: number;
  clf_type: string; // e.g., "taxonomic;taxonomic_repeater"
  clf_level: string; // e.g., "1", "2"
  clf_position?: string; // e.g., "pre", "post", "inner"
}

export interface Lemma {
  id: number;
  transliteration: string;
  meaning: string;
  lexical_field?: string | null;
  concept?: string | null;
}

export interface Witness {
  id: string;
  name: string;
  script: string;
  genre?: string;
  object_type?: string;
  location?: string;
  period_date_start?: string;
  period_date_end?: string;
  chrono_date_start?: string;
  chrono_date_end?: string;
  url?: string;
  comments?: string;
  supertext_id?: string | number | null;
}

export interface ClassifierStats {
  [key: string]: number;
}

export type ClassifierMeaningMap = Record<string, string>;

// Sample Lemma Data
export const lemmaData: Record<number, Lemma> = {
  1: {
    id: 1,
    transliteration: "šrm",
    meaning: "to greet"
  },
  2: {
    id: 2,
    transliteration: "sḏm",
    meaning: "to hear"
  },
  3: {
    id: 3,
    transliteration: "rdi̯",
    meaning: "to give"
  },
  4: {
    id: 4,
    transliteration: "wni̯",
    meaning: "to open"
  },
  5: {
    id: 5,
    transliteration: "ḫd",
    meaning: "to cut"
  }
};

// Sample Witness Data
export const witnessData: Record<string, Witness> = {
  "O. Turin 9588/57365": {
    id: "O. Turin 9588/57365",
    name: "O. Turin 9588/57365",
    script: "Hieratic"
  },
  "Medinet Habu": {
    id: "Medinet Habu",
    name: "Medinet Habu",
    script: "Hieroglyphic"
  },
  "P. Harris I": {
    id: "P. Harris I",
    name: "P. Harris I",
    script: "Hieratic"
  },
  "P. Boulaq 6": {
    id: "P. Boulaq 6",
    name: "P. Boulaq 6",
    script: "Hieratic"
  },
  "Amada Merneptah": {
    id: "Amada Merneptah",
    name: "Amada Merneptah",
    script: "Hieroglyphic"
  },
  "Gebel Barkal": {
    id: "Gebel Barkal",
    name: "Gebel Barkal",
    script: "Hieroglyphic"
  }
};

// Sample Token Data
export const tokenData: Record<number, Token> = {
  493: { id: 493, lemma_id: 1, mdc_w_markup: "SA-A-Z4:r-Z1-m:a-A30~Y1~", mdc: "SA-A-Z4:r-Z1-m:a-A30-Y1", witness_id: "O. Turin 9588/57365", compound_id: null, pos: "Verb" },
  494: { id: 494, lemma_id: 1, mdc_w_markup: "SA-A-r-Z1-M:a-A30~", mdc: "SA-A-r-Z1-M:a-A30", witness_id: "Medinet Habu", compound_id: null, pos: "Verb" },
  495: { id: 495, lemma_id: 1, mdc_w_markup: "SA-A-r:Z1-M:a-A30~", mdc: "SA-A-r:Z1-M:a-A30", witness_id: "Medinet Habu", compound_id: null, pos: "Noun" },
  496: { id: 496, lemma_id: 1, mdc_w_markup: "SA-A-Z4:r-Z1-m:a-A30~A2~", mdc: "SA-A-Z4:r-Z1-m:a-A30-A2", witness_id: "P. Harris I", compound_id: null, pos: "Verb" },
  497: { id: 497, lemma_id: 1, mdc_w_markup: "SA-A-r-Z1-mA-A-A30~Z5:F18~A2~", mdc: "SA-A-r-Z1-mA-A-A30-Z5:F18-A2", witness_id: "P. Boulaq 6", compound_id: null, pos: "Noun" },
  498: { id: 498, lemma_id: 1, mdc_w_markup: "SA-A-r-Z1-m:a~D51:D40~", mdc: "SA-A-r-Z1-m:a-D51:D40", witness_id: "P. Harris I", compound_id: null, pos: "Verb" },
  499: { id: 499, lemma_id: 1, mdc_w_markup: "SA-A-r:Z1-G20-A30~", mdc: "SA-A-r:Z1-G20-A30", witness_id: "Medinet Habu", compound_id: null, pos: "Adjective" },
  500: { id: 500, lemma_id: 1, mdc_w_markup: "SA:G3-r:G3-A4C~", mdc: "SA:G3-r:G3-A4C", witness_id: "Amada Merneptah", compound_id: null, pos: "Noun" },
  501: { id: 501, lemma_id: 2, mdc_w_markup: "sḏ-m:a~D2~", mdc: "sḏ-m:a-D2", witness_id: "Medinet Habu", compound_id: null, pos: "Verb" },
  502: { id: 502, lemma_id: 2, mdc_w_markup: "sḏ:D2-m:a~", mdc: "sḏ:D2-m:a", witness_id: "Gebel Barkal", compound_id: null, pos: "Verb" },
  503: { id: 503, lemma_id: 3, mdc_w_markup: "r-di̯~D37~", mdc: "r-di̯-D37", witness_id: "P. Harris I", compound_id: null, pos: "Verb" },
  504: { id: 504, lemma_id: 3, mdc_w_markup: "r-di̯:D37~", mdc: "r-di̯:D37", witness_id: "Medinet Habu", compound_id: null, pos: "Verb" },
  505: { id: 505, lemma_id: 4, mdc_w_markup: "wn:n-i̯~F31~", mdc: "wn:n-i̯-F31", witness_id: "Amada Merneptah", compound_id: null, pos: "Verb" },
  506: { id: 506, lemma_id: 5, mdc_w_markup: "ḫ-d:D46~", mdc: "ḫ-d:D46", witness_id: "P. Boulaq 6", compound_id: null, pos: "Verb" }
};

// Compound parts and tokens (for filtering)
export const compoundParts = new Set<number>([]);
export const compoundTokens = new Set<number>([]);
export const part2Compound: Record<number, number> = {};

// Classifier metadata (for type, level, position filtering)
export const clfData: Record<string, ClassifierMetadata> = {
  "Y1_493": { gardiner_number: "Y1", token_id: 493, clf_type: "action", clf_level: "primary", clf_position: "post" },
  "A30_493": { gardiner_number: "A30", token_id: 493, clf_type: "agent", clf_level: "primary", clf_position: "pre" },
  "A30_494": { gardiner_number: "A30", token_id: 494, clf_type: "agent", clf_level: "secondary", clf_position: "pre" },
  "A2_496": { gardiner_number: "A2", token_id: 496, clf_type: "agent", clf_level: "primary", clf_position: "post" },
  "D51_498": { gardiner_number: "D51", token_id: 498, clf_type: "action", clf_level: "primary", clf_position: "post" },
  "D2_501": { gardiner_number: "D2", token_id: 501, clf_type: "action", clf_level: "primary", clf_position: "post" },
  "D37_503": { gardiner_number: "D37", token_id: 503, clf_type: "action", clf_level: "primary", clf_position: "post" },
  "D37_504": { gardiner_number: "D37", token_id: 504, clf_type: "action", clf_level: "primary", clf_position: "post" },
  "F31_505": { gardiner_number: "F31", token_id: 505, clf_type: "action", clf_level: "primary", clf_position: "post" },
  "D46_506": { gardiner_number: "D46", token_id: 506, clf_type: "action", clf_level: "secondary", clf_position: "post" },
};

export const DEFAULT_NETWORK_CLF_LEVELS = [1, 2, 4];
export const DEFAULT_NETWORK_CLF_TYPES = [
  "taxonomic",
  "taxonomic_repeater",
  "taxonomic_metaphoric",
  "schematic"
];

export const CLASSIFIER_LEVEL_LABELS: Array<[number, string]> = [
  [1, "Encyclopedic (also Semantic, Lexical)"],
  [2, "Pragmatic (also referent classifier)"],
  [3, "Derivational (also Grammatical)"],
  [4, "Metatextual"],
  [5, "Phonetic"],
];

export const CLASSIFIER_TYPE_LABELS: Array<[string, string]> = [
  ["taxonomic", "Taxonomic"],
  ["taxonomic_repeater", "Taxonomic repeater"],
  ["taxonomic_metaphoric", "Taxonomic metaphoric"],
  ["schematic", "Schematic"],
  ["unclear", "Unclear"],
];

export const CLASSIFIER_TYPE_LABELS_WITH_ANYTHING: Array<[string, string]> = [
  ...CLASSIFIER_TYPE_LABELS,
  ["anything", "Any type (including unanalysed classifiers)"],
];

// Classifier type and level arrays (for filtering menus)
export const clfTypeArr: Array<[string, string]> = [
  ["any", "All types"],
  ...CLASSIFIER_TYPE_LABELS,
];

export const clfLevelArr: Array<[string, string]> = [
  ["any", "All levels"],
  ...CLASSIFIER_LEVEL_LABELS.map(([level, label]) => [String(level), label] as [string, string]),
];

const LEVEL_ALIASES: Record<string, number> = {
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  encyclopedic: 1,
  semantic: 1,
  lexical: 1,
  pragmatic: 2,
  "referent classifier": 2,
  referent: 2,
  derivational: 3,
  grammatical: 3,
  metatextual: 4,
  phonetic: 5,
  primary: 1,
  secondary: 2,
  tertiary: 3,
};

const TAXONOMIC_TYPE_GROUP = new Set([
  "taxonomic",
  "taxonomic_repeater",
  "taxonomic_metaphoric",
]);

export function normalizeClassifierLevelNumber(levelValue: unknown): number {
  if (typeof levelValue === "number" && Number.isFinite(levelValue)) {
    return levelValue;
  }
  const raw = String(levelValue ?? "").trim().toLowerCase();
  if (!raw) return -1;
  const parsed = parseInt(raw, 10);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return LEVEL_ALIASES[raw] ?? -1;
}

export function parseClassifierTypes(typeValue: string | null | undefined): string[] {
  return String(typeValue ?? "")
    .split(/[;,]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function classifierTypeMatchesSelection(
  typeValue: string | null | undefined,
  selectedTypes: Set<string>
): boolean {
  if (selectedTypes.size === 0 || selectedTypes.has("anything")) return true;

  const normalizedTypes = parseClassifierTypes(typeValue);
  if (normalizedTypes.length === 0) return false;

  if (selectedTypes.has("taxonomic") && normalizedTypes.some((type) => TAXONOMIC_TYPE_GROUP.has(type))) {
    return true;
  }

  return normalizedTypes.some((type) => selectedTypes.has(type));
}

// Available POS tags
export const posArr = [
  "Verb",
  "Noun",
  "Adjective",
  "Adverb",
  "Preposition",
  "Conjunction"
];

// Projects
export interface Project {
  id: string;
  name: string;
  description: string;
  type: "hieroglyphic" | "cuneiform" | "chinese" | "anatolian";
  image: string;
  authors: string;
  tags?: ProjectTag[];
  scriptType?: ProjectScriptType;
  networkDefaults?: NetworkDefaults;
}

export type ProjectTag = "egyptian" | "egyptian_unified";

export type ProjectScriptType =
  | "hieroglyphic"
  | "hieratic"
  | "cursive hieroglyphs"
  | "mixed"
  | "other";

export interface NetworkDefaults {
  clfLevels?: number[];
  clfTypes?: string[];
  useAllData?: boolean;
  useUnicode?: boolean;
}

const NETWORK_DEFAULTS_BY_TYPE: Record<Project["type"], Required<NetworkDefaults>> = {
  hieroglyphic: {
    clfLevels: [...DEFAULT_NETWORK_CLF_LEVELS],
    clfTypes: [...DEFAULT_NETWORK_CLF_TYPES],
    useAllData: false,
    useUnicode: false
  },
  cuneiform: {
    clfLevels: [...DEFAULT_NETWORK_CLF_LEVELS],
    clfTypes: [...DEFAULT_NETWORK_CLF_TYPES],
    useAllData: false,
    useUnicode: false
  },
  chinese: {
    clfLevels: [...DEFAULT_NETWORK_CLF_LEVELS],
    clfTypes: [...DEFAULT_NETWORK_CLF_TYPES],
    useAllData: false,
    useUnicode: false
  },
  anatolian: {
    clfLevels: [1, 2, 3, 4, 5],
    clfTypes: ["anything"],
    useAllData: true,
    useUnicode: false
  }
};

export function resolveNetworkDefaults(project?: Project) {
  const base = NETWORK_DEFAULTS_BY_TYPE[project?.type || "hieroglyphic"];
  const overrides = project?.networkDefaults || {};
  return {
    clfLevels: overrides.clfLevels || base.clfLevels,
    clfTypes: overrides.clfTypes || base.clfTypes,
    useAllData: overrides.useAllData ?? base.useAllData,
    useUnicode: overrides.useUnicode ?? base.useUnicode
  };
}

export const combinedEgyptianProject: Project = {
  id: "ancient-egyptian",
  name: "Ancient Egyptian (Unified)",
  description: "Unified classifier-based semantic network across all Ancient Egyptian sources digitized by TLA with added classifier annotations.",
  type: "hieroglyphic",
  image: "/public/images_line/egyptian.png",
  authors: "iClassifier Team, TLA",
  tags: ["egyptian", "egyptian_unified"],
  scriptType: "mixed"
};

// Individual Egyptian Projects (for detailed access)
export const egyptianProjects: Project[] = [
  {
    id: "classifyingtheother",
    name: "Classifying the Other",
    description: "A Network of Lexical Borrowings in Ancient Egyptian Texts of the New Kingdom",
    type: "hieroglyphic",
    image: "/public/images_line/classtheother.jpg",
    authors: "Haleli Harel",
    tags: ["egyptian"],
    scriptType: "hieroglyphic"
  },
  {
    id: "dissimilationgraphique",
    name: "La dissimilation graphique",
    description: "Study of Graphical Dissimilation in Egyptian texts", 
    type: "hieroglyphic",
    image: "/public/images_line/dissimilation.png",
    authors: "Simon Thault",
    tags: ["egyptian"],
    scriptType: "hieroglyphic"
  },

  {
    id: "digitizingseth",
    name: "Digitizing Seth",
    description: "Digital corpus of texts related to the god Seth",
    type: "hieroglyphic",
    image: "/public/images_line/digitizingseth.png", 
    authors: "Jorke Grotenhuis",
    tags: ["egyptian"],
    scriptType: "hieroglyphic"
  },
  {
    id: "aaell",
    name: "AAELL",
    description: "AAELL corpus project",
    type: "hieroglyphic",
    image: "/public/images_line/lovepoems.png",
    authors: "TLA, Haleli Harel",
    tags: ["egyptian"],
    scriptType: "hieratic"
  },
  {
    id: "ct335",
    name: "Coffin Texts (JG)",
    description: "The Coffin Texts",
    type: "hieroglyphic",
    image: "/public/images_line/coffintexts.png", 
    authors: "Jorke Grotenhuis",
    tags: ["egyptian"],
    scriptType: "cursive hieroglyphs"
  },

  {
    id: "neuaegyptischeerzaehlungen",
    name: "Late Egyptian Stories",
    description: "New Kingdom Egyptian Narrative Texts",
    type: "hieroglyphic",
    image: "/public/images_line/les.png",
    authors: "TLA, Haleli Harel",
    tags: ["egyptian", "egyptian_unified"],
    scriptType: "hieratic"
  },
  {
    id: "pebersold",
    name: "The medical Papyrus Ebers",
    description: "The Ebers medical papyrus classifier network", 
    type: "hieroglyphic",
    image: "/public/images_line/pebers.png",
    authors: "TLA, Tanja Pommerening, Svenja Stern",
    tags: ["egyptian", "egyptian_unified"],
    scriptType: "hieratic",
    networkDefaults: {
      useAllData: true
    }
  },
  {
    id: "ptahhotep",
    name: "Ptahhotep",
    description: "The Instructions of Ptahhotep, an sample study of Middle Kingdom classifiers",
    type: "hieroglyphic", 
    image: "/public/images_line/ptahhotep.jpeg",
    authors: "TLA, Yanru Xu",
    tags: ["egyptian", "egyptian_unified"],
    scriptType: "hieratic"
  },
  {
    id: "sinuhetlacopy", 
    name: "The Tale of Sinuhe",
    description: "The Tale of Sinuhe from TLA database with classifier annotations",
    type: "hieroglyphic",
    image: "/public/images_line/sinuhe.png",
    authors: "TLA, Susana Soler",
    tags: ["egyptian", "egyptian_unified"],
    scriptType: "hieratic"
  },
  {
    id: "tlasinuhesoler-filled",
    name: "The Tale of Sinuhe",
    description: "TLA Sinuhe updated corpus (March 2026) variant with classifier annotations",
    type: "hieroglyphic",
    image: "/public/images_line/sinuhe.png",
    authors: "TLA, Susana Soler",
    tags: ["egyptian"],
    scriptType: "hieratic"
  },
  {
    id: "tlaharelletters",
    name: "Ancient Egyptian Letters",
    description: "TLA  Letters corpus with classifier annotations",
    type: "hieroglyphic",
    image: "/public/images_line/letters.png",
    authors: "TLA, Haleli Harel",
    tags: ["egyptian"],
    scriptType: "hieratic"
  },

  {
    id: "womenandwomanhood",
    name: "Women and Womanhood", 
    description: "Texts related to women and concepts of womanhood in ancient Egypt",
    type: "hieroglyphic",
    image: "/public/images_line/womenandwomanhood.jpg",
    authors: "Arthur Lesage",
    tags: ["egyptian"],
    scriptType: "mixed"
  }
];

export const unifiedEgyptianProjects: Project[] = egyptianProjects.filter((project) =>
  project.tags?.includes("egyptian_unified")
);

// Non-Egyptian projects
export const nonEgyptianProjects: Project[] = [
  {
    id: "gebhardselz",
    name: "Sumerian",
    description: "A Classifier Dictionary of Sumerian",
    type: "cuneiform", 
    image: "/public/images_line/sumerian.png",
    authors: "ePSD2, Gebhard Selz, Bo Zhang",
    networkDefaults: {
      useAllData: false,
      clfTypes: [...DEFAULT_NETWORK_CLF_TYPES],
      clfLevels: [...DEFAULT_NETWORK_CLF_LEVELS]
    }
  },
   {
    id: "guodianimported",
    name: "Ancient Chinese",
    description: "Ancient Chinese Classifier List (based on sample corpus-study of the Guodian Bamboo Philosophical Inscriptions)",
    type: "chinese",
    image: "/public/images_line/chinese.jpg",
    authors: "Yanru Xu",
    networkDefaults: {
      useAllData: false,
      clfTypes: [...DEFAULT_NETWORK_CLF_TYPES],
      clfLevels: [...DEFAULT_NETWORK_CLF_LEVELS]
    }
  },
  {
    id: "luwiancorpus",
    name: "Luwian",
    description: "The Corpus of Anatolian Hieroglyphic Luwian Texts as a Classifier Network",
    type: "anatolian",
    image: "/public/images_line/luwian.png",
    authors: "Annick Payne, Olga Olina",
    networkDefaults: {
      useAllData: true,
      clfTypes: ["anything"],
      clfLevels: [1, 2, 3, 4, 5]
    }
  },

  {
    id: "kilivilatest",
    name: "Kilivila",
    description: "Kilivila Classificatory Particles Network in Oral Folktales",
    type: "cuneiform",
    image: "/public/images_line/kilivila.png",
    authors: "Kilivila Project",
    networkDefaults: {
      useAllData: false,
      clfTypes: [...DEFAULT_NETWORK_CLF_TYPES],
      clfLevels: [...DEFAULT_NETWORK_CLF_LEVELS]
    }
  },
  
  {
    id: "rinap",
    name: "RINAP (Neo-Assyrian)",
    description: "The Classifier Network of The Royal Inscriptions of the Neo-Assyrian Period (RINAP)",
    type: "cuneiform",
    image: "/public/images_line/rinap.png",
    authors: "RINAP Project",
    networkDefaults: {
      useAllData: true,
      clfTypes: [...DEFAULT_NETWORK_CLF_TYPES],
      clfLevels: [...DEFAULT_NETWORK_CLF_LEVELS]
    }
  },
 
];

// Combined projects list for backward compatibility
export const projects: Project[] = [
  combinedEgyptianProject,
  ...egyptianProjects,
  ...nonEgyptianProjects
];
