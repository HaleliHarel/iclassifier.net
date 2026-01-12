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
  clf_type: string; // e.g., "action;agent"
  clf_level: string; // e.g., "primary", "secondary"
  clf_position?: string; // e.g., "pre", "post", "inner"
}

export interface Lemma {
  id: number;
  transliteration: string;
  meaning: string;
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

// Classifier type and level arrays (for filtering menus)
export const clfTypeArr = [
  ["any", "All types"],
  ["action", "Action"],
  ["agent", "Agent"],
  ["object", "Object"],
  ["location", "Location"]
];

export const clfLevelArr = [
  ["any", "All levels"],
  ["primary", "Primary"],
  ["secondary", "Secondary"],
  ["tertiary", "Tertiary"]
];

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
  networkDefaults?: NetworkDefaults;
}

export interface NetworkDefaults {
  clfLevels?: number[];
  clfTypes?: string[];
  useAllData?: boolean;
  useUnicode?: boolean;
}

const NETWORK_DEFAULTS_BY_TYPE: Record<Project["type"], Required<NetworkDefaults>> = {
  hieroglyphic: {
    clfLevels: [1],
    clfTypes: ["taxonomic", "taxonomic_repeater", "taxonomic_metaphoric"],
    useAllData: false,
    useUnicode: true
  },
  cuneiform: {
    clfLevels: [1, 2, 3, 4, 5],
    clfTypes: ["taxonomic", "taxonomic_repeater", "taxonomic_metaphoric", "schematic", "unclear"],
    useAllData: false,
    useUnicode: false
  },
  chinese: {
    clfLevels: [1, 2, 3, 4, 5],
    clfTypes: ["taxonomic", "taxonomic_repeater", "taxonomic_metaphoric", "schematic", "unclear"],
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

const PUBLIC_IMAGE_BASE = `${import.meta.env.BASE_URL}images/`;

export const combinedEgyptianProject: Project = {
  id: "ancient-egyptian",
  name: "Ancient Egyptian (Unified)",
  description: "Unified classifier-based semantic network across all Ancient Egyptian corpora.",
  type: "hieroglyphic",
  image: `${PUBLIC_IMAGE_BASE}egyptian.png`,
  authors: "iClassifier Team"
};

// Individual Egyptian Projects (for detailed access)
export const egyptianProjects: Project[] = [
  {
    id: "classifyingtheother",
    name: "Classifying the Other",
    description: "A Network of Lexical Borrowings in Ancient Egyptian Texts of the New Kingdom",
    type: "hieroglyphic",
    image: `${PUBLIC_IMAGE_BASE}classtheother.jpg`,
    authors: "Haleli Harel"
  },
  {
    id: "dissimilationgraphique",
    name: "La dissimilation graphique",
    description: "Study of Graphical Dissimilation in Egyptian texts", 
    type: "hieroglyphic",
    image: `${PUBLIC_IMAGE_BASE}dissimilation.png`,
    authors: "Simon Thault"
  },
  {
    id: "coffintextsjgverbs",
    name: "Coffin Texts Verbs (JG)",
    description: "Analysis of verbal forms in Middle Kingdom Coffin Texts",
    type: "hieroglyphic", 
    image: `${PUBLIC_IMAGE_BASE}coffintexts.jpg`,
    authors: "Jorke Grotenhuis"
  },
  {
    id: "digitizingseth",
    name: "Digitizing Seth",
    description: "Digital corpus of texts related to the god Seth",
    type: "hieroglyphic",
    image: `${PUBLIC_IMAGE_BASE}digitizingseth.jpg`, 
    authors: "Jorke Grotenhuis"
  },
  {
    id: "neuaegyptischeerzaehlungen",
    name: "Neuaegyptische Erzaehlungen",
    description: "New Kingdom Egyptian Narrative Texts",
    type: "hieroglyphic",
    image: `${PUBLIC_IMAGE_BASE}les.jpg`,
    authors: "TLA, Haleli Harel"
  },
  {
    id: "pebersold",
    name: "pEbers",
    description: "The Ebers medical papyrus classifier network", 
    type: "hieroglyphic",
    image: `${PUBLIC_IMAGE_BASE}pebers.jpg`,
    authors: "TLA, Tanja Pommerening, Svenja Stern",
    networkDefaults: {
      useAllData: true
    }
  },
  {
    id: "ptahhotep",
    name: "Ptahhotep",
    description: "The Instructions of Ptahhotep, an sample study of Middle Kingdom classifiers",
    type: "hieroglyphic", 
    image: `${PUBLIC_IMAGE_BASE}ptahotep.jpeg`,
    authors: "TLA, Yanru Xu"
  },
  {
    id: "sinuhetlacopy", 
    name: "The Tale of Sinuhe",
    description: "The Tale of Sinuhe from TLA database with classifier annotations",
    type: "hieroglyphic",
    image: `${PUBLIC_IMAGE_BASE}sinuhe.jpg`,
    authors: "TLA, Susana Soler"
  },
  {
    id: "womenandwomanhood",
    name: "Women and Womanhood", 
    description: "Texts related to women and concepts of womanhood in ancient Egypt",
    type: "hieroglyphic",
    image: `${PUBLIC_IMAGE_BASE}womenandwomanhood.jpg`,
    authors: "Arthur Lesage"
  }
];

// Non-Egyptian projects
export const nonEgyptianProjects: Project[] = [
  {
    id: "gebhardselz",
    name: "Sumerian",
    description: "A Classifier Dictionary of the Sumerian Lexicon",
    type: "cuneiform", 
    image: `${PUBLIC_IMAGE_BASE}sumerian.png`,
    authors: "ePSD2, Gebhard Selz, Bo Zhang",
    networkDefaults: {
      useAllData: false,
      clfTypes: ["taxonomic", "taxonomic_repeater", "taxonomic_metaphoric", "schematic", "unclear", "anything"],
      clfLevels: [1]
    }
  },
  {
    id: "kilivilatest",
    name: "Kilivila",
    description: "Kilivila Classificatory Particles Network in Oral Folktales",
    type: "cuneiform",
    image: `${PUBLIC_IMAGE_BASE}kilivila.png`,
    authors: "Kilivila Project",
    networkDefaults: {
      useAllData: false,
      clfTypes: ["taxonomic", "taxonomic_repeater", "taxonomic_metaphoric", "schematic", "unclear", "anything"],
      clfLevels: [1]
    }
  },
  {
    id: "rinap",
    name: "RINAP (Neo-Assyrian)",
    description: "The Classifier Network of The Royal Inscriptions of the Neo-Assyrian Period (RINAP)",
    type: "cuneiform",
    image: `${PUBLIC_IMAGE_BASE}rinap.jpg`,
    authors: "RINAP Project",
    networkDefaults: {
      useAllData: true,
      clfTypes: ["taxonomic", "taxonomic_repeater", "taxonomic_metaphoric"],
      clfLevels: [1]
    }
  },
  {
    id: "guodianimported",
    name: "Ancient Chinese",
    description: "Ancient Chinese sample corpus-study of the Guodian Bamboo Philosophical Inscriptions",
    type: "chinese",
    image: `${PUBLIC_IMAGE_BASE}chinese.png`,
    authors: "Yanru Xu",
    networkDefaults: {
      useAllData: false,
      clfTypes: ["taxonomic", "taxonomic_repeater", "taxonomic_metaphoric"],
      clfLevels: [1]
    }
  },
  {
    id: "luwiancorpus",
    name: "Luwian",
    description: "The Corpus of Anatolian Hieroglyphic Luwian Texts as a Classifier Network",
    type: "anatolian",
    image: `${PUBLIC_IMAGE_BASE}luwian.png`,
    authors: "Annick Payne, Olga Olina",
    networkDefaults: {
      useAllData: true,
      clfTypes: ["anything"],
      clfLevels: [1, 2, 3, 4, 5]
    }
  }
];

// Combined projects list for backward compatibility
export const projects: Project[] = [
  combinedEgyptianProject,
  ...egyptianProjects,
  ...nonEgyptianProjects
];
