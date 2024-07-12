const emptyLemmaInfo = {
    id: null,
    add_lemma_with_id: false,
    description: {
        transliteration: null,
        meaning: null,
        root: null,
        lb_status: null,
        lexical_field: null,
        lexical_field_secondary: null,
        demotic: null,
        demotic_meaning: null,
        demotic_lexicon_entry: null,
        demotic_lexicon_entry_pages: null,
        coptic: null,
        coptic_meaning: null,
        coptic_lexicon_entry: null,
        coptic_lexicon_entry_pages: null,
        comments: null
    },
    id_query: null,
    // The primary variant is baked in.
    variants: [
        {
            id: null,
            description: {
                lemma_id: null,
                transliteration: null,
                meaning: null,
                source_id: null,
                source_pages: null,
                primary: true
            }
        }
    ],
    variant_tmp: {
        id: null,
        description: {
            lemma_id: null,
            transliteration: null,
            meaning: null,
            source_id: null,
            source_pages: null,
            primary: false
        }
    },
    borrowing_info: {
        id: null,
        description: {
            lemma_id: null,
            source_root: "",  // Cannot be null because of a deprecated constraint in the database schema.
            source_meaning: null,
            contact_type: null,
            certainty_level: null,
            hoch_n_occurrences: null,
            comments: null
        }
    },
    cognates: [],
    cognate_tmp: {
        id: null,
        description: {
            lemma_id: null,
            language: null,
            cognate: null,
            meaning: null,
            publication_id: null,
            page_n: null,
            discussion: null
        }
    },
    biblio_tmp: null,
    biblio_refs: [],
    menu_data: {
        biblio_filter: '',
        dictionaryQueryTimeout: null,
        allow_short_searches: false,
        dict_query_transliteration: null,
		dict_query_translation: null,
        previous_dict_query: null,
        dictionary_cache: null,  // Not shared. NB not to send this to the server.
		demotic_source_filter: '',
		demotic_source_title: '',
		coptic_source_filter: '',
		coptic_source_title: ''
    },
    menu_switches: {
        dictionary: false,
        variants: false,
        biblio: false,
		demotic_source: false,
        coptic_source: false,
        show_lemma_details: false,
        borrowing_info: false,
        cognates: false
    },
    menu_timeouts: {}
};

// The primary variant is already embedded
// in the main template.
const emptyLemmaVariant = {
    id: null,
    description: {
        lemma_id: null,
        transliteration: null,
        meaning: null,
        source_id: null,
        source_pages: null,
        primary: false
    }
};

const emptyBorrowingInfo = {
    id: null,
    description: {
        lemma_id: null,
        source_root: null,
        source_meaning: null,
        contact_type: null,
        certainty_level: null,
        hoch_n_occurrences: null,
        comments: null
    }
};

const emptyLemmaLexiconEntry = {
    id: null,
	title: null,
	description: {
		lemma_id: null,
		dictionary_id: null,
		pages: null,
		url: null
	}
};

const emptyCognateInfo = {
    id: null,
    description: {
        lemma_id: null,
        language: null,
        cognate: null,
        meaning: null,
        publication_id: null,
        page_n: null,
        discussion: null
    }
};

// Values are equal to labels
const semanticFields = [
    'The physical world',
    'Kinship',
    'Animals',
    'The body',
    'Food and drink',
    'Clothing and grooming',
    'The house',
    'Agriculture and vegetation',
    'Basic actions and technology',
    'Motion',
    'Possession',
    'Spatial relations',
    'Quantity',
    'Time',
    'Sense perception',
    'Emotions and values',
    'Cognition',
    'Speech and language',
    'Social and political relations',
    'Warfare and hunting',
    'Law',
    'Religion and belief',
    'Modern world',
    'Miscellaneous function words',
    'Other'
];

const semanticFieldsSecondary = [
    'Other'
];

