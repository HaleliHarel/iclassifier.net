// The main data structure. It stores all the information
// about the token and classifiers in it. The menus are
// (re)drawn based on these data.
// Fields that get sent to the server are null by default.
// "Populated on load" means that an async fetch is needed.
let tokenInfoTemplate = {
    id: null,
    img_src: '',            // Jsesh visualisation of MDC. Populated on load.
    lemma_info: null,       // Populated on load.
    type: null,             // simple/part/compound; populated on load.
    supertext_name: null,   // Populated on load.
    witness_name: null,     // Populated on load.
    compound_elements: [],  // Populated on load.
    // This dict maps directly to the SQL schema.
    description: {
        lemma_id: null,
        is_part_of_compound: null,
        compound_id: null,
        supertext_id: null,
        coordinates_in_txt: null,
        witness_id: null,
        coordinates_in_witness: null,
        mdc: null,
        mdc_w_markup: null,
        transliteration: null,
        classification_status: null,
        sign_comments: null,
        context_meaning: null,
        syntactic_relation: null,
        pos: null,
        register: null,
        comments: null,
        other: null,
        phonetic_reconstruction: null,
        translation: null
    },
    clfParses: [],
    witness_pictures: [],  // A cache for storing witness pics used to select token pics.
    token_pictures: [],    // Populated on load.
    biblio_refs: [],       // Populated on load.
    menu_switches: {
        supertext: false,
        lemma: false,
        witness: false,
        biblio: false
    },
    menu_data: {
        supertext_filter: '',
        lemma_filter: '',
        witness_filter: '',
        biblio_filter: '',
    },
    menu_timeouts: {},
    // This field is initialised with a copy of emptyBiblioRef on load and when
    // "Add a bibliographical reference" is pressed and gets updated when a publication
    // is selected. A copy is pushed to biblio_refs when "Add a reference" is pressed.
    biblio_tmp: null,
    id_query: null,  // For fetching tokens by id.
    admin_comments: []
};

// Templates for children data structures that govern subcomponents.
const emptyClfParse = {
    id: null,
    img_src: '',
    description: {
        token_id: null,
        gardiner_number: null,
        clf_n: null,
        clf_type: null,
        clf_level: null,
        semantic_relation: null,
        phonetic_classifier: null,
        false_etymology: null,
        comments: null
    },
    pictures: [],
    biblio_refs: []
};

const emptyBiblioRef = {
    id: null,
    token_id: null,
    source_id: null,
    source_abbrev: null,
    source_name: null,
    pages: null,
    comments: null
};

// TODO: move to component.js or smth
// Extracts clf parses from the marked-up mdc string.
function createClfParses(menu_idx) {
    menuArr[menu_idx].clfParses = [];
    let clfs = extractClfs(menuArr[menu_idx].description.mdc_w_markup);
    if (clfs.length > 0) {
        menuArr[menu_idx].description.classification_status = 'CL';
    }
    for (let i = 0; i < clfs.length; i++) {
        let clfParse = JSON.parse(JSON.stringify(emptyClfParse));
        clfParse.description.gardiner_number = clfs[i];
        clfParse.description.token_id = menuArr[menu_idx].id;
        clfParse.description.clf_n = i + 1;
        menuArr[menu_idx].clfParses.push(clfParse);
    }
}

function extractClfs(mdc) {
    let result = [],
        temp = '',
        inside = false;
    for (let i = 0; i < mdc.length; i++) {
        if (inside) {
            if (mdc[i] === '~') {
                result.push(temp);
                temp = '';
                inside = false;
            } else {
                temp += mdc[i];
            }
        } else if (mdc[i] === '~')
            inside = true;
    }
    // if (inside) {
    //     // alert("Unbalanced ~’s in the marked-up MDC!");
    //     return [];
    // }
    return result;
}
