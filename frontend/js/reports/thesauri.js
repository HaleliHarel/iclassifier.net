// Classifier thesauri: the order of elements in tuples
// is value, title

const clfTypeArr = [
	['any', 'Any'],
	['taxonomic', 'Taxonomic'],
	['taxonomic_repeater', 'Taxonomic repeater'],
	['taxonomic_metaphoric', 'Taxonomic metaphoric'],
	['schematic', 'Schematic'],
	['unclear', 'Unclear']
];

const clfLevelArr = [
	['any', 'Any'],
	[1, 'Lexical'],
	[2, 'Pragmatic'],
	[3, 'Derivational'],
	[4, 'Metatextual'],
	[5, 'Phonetic (incl. false etymology)']
];

const POSArr = [
    ['any', 'Any'],
    ['ADJ', 'Adjective'],
    ['ADV', 'Adverb'],
    ['CONJ', 'Conjunction'],
    ['DET', 'Determiner'],
    ['DEV', 'Deverbal'],
    ['DN', 'Divine name'],
    ['N', 'Noun'],
    ['NUM', 'Numeral'],
    ['FN', 'Other function word'],
    ['PART', 'Particle'],
    ['POSTP', 'Postposition'],
    ['PREP', 'Preposition'],
    ['PRON', 'Pronoun'],
    ['PN', 'Proper name'],
    ['TN', 'Toponym'],
    ['VB', 'Verb'],
    ['not set', 'Not set']
];

function arr2Select(arr, style, onchange) {
    return m(
        'select',
        {style: style, onchange: onchange},
        arr.map(tuple => m(
            'option',
            {value: tuple[0]},
            tuple[1]))
    )
}

function arr2checkboxes(arr, targetSet) {
    return m('div', arr.map(v => m('div', [
            m('input[type=checkbox]', {
                checked: targetSet.has(v[0]),
                id: `${v[0]}-${v[1]}-checkbox`,
                onclick: e => { toggleSetValue(e, targetSet, v[0]) }
            }),
            m('label', {for: `${v[0]}-${v[1]}-checkbox`}, v[1]),
            m('br')
        ])
    ))
}

function toggleSetValue(event, targetSet, value) {
    if (event.target.checked) {
        targetSet.add(value);
    } else {
        targetSet.delete(value);
    }
}

// Witness thesauri: the order of elements in tuples
// is title, value

const chineseScripts = [
    ["Oracle bones inscriptions", "Oracle bones inscriptions"],
    ["Bronze inscriptions", "Bronze inscriptions"],
    ["Chu script", "Chu script"],
    ["Qin script", "Qin script"],
    ["Qi script", "Qi script"],
    ["Jin script", "Jin script"],
    ["Yan script", "Yan script"],
    ["Seal script", "Seal script"],
    ["Clerical script", "Clerical script"],
    ["Regular script (Traditional)", "Regular script (Traditional)"],
    ["Regular script (Simplified)", "Regular script (Simplified)"]
];

const chineseGenres = [
    ["Philosophical (literary)", "Philosophical (literary)"],
    ["Poetry (literary)", "Poetry (literary)"],
    ["Narrative", "Narrative"],
    ["Oracle text", "Oracle text"],
    ["Offering list", "Offering list"],
    ["Legal text", "Legal text"],
    ["Medical text", "Medical text"],
    ["Administrative", "Administrative"],
    ["Other", "Other"]
];

const egyptianGenres = [
    ['Administrative text', 'thot-18741'],
    ['-- Account', 'thot-18742'],
    ['-- Census list', 'thot-18748'],
    ['-- Fiscal document', 'thot-18744'],
    ['-- Inventory', 'thot-18747'],
    ['-- List of estates', 'thot-18749'],
    ['-- List of materials', 'thot-18745'],
    ['-- List of names', 'thot-18746'],
    ['-- Log book', 'thot-18751'],
    ['-- Necropolis journal', 'thot-18752'],
    ['-- Payment list', 'thot-18750'],
    ['-- Receipt', 'thot-18743'],
    ['Biographical text', 'thot-18712'],
    ['Dream interpretation', 'thot-18783'],
    ['Expedition text', 'thot-18713'],
    ['Funerary text', 'thot-18635'],
    ['-- Amduat', 'thot-18639'],
    ['-- Book of breathing', 'thot-18643'],
    ['-- Book of caverns', 'thot-18641'],
    ['-- Book of day and night', 'thot-18642'],
    ['-- Book of gates', 'thot-18640'],
    ['-- Book of the dead', 'thot-18638'],
    ['-- Book of traversing eternity', 'thot-18644'],
    ['-- Coffin texts', 'thot-18637'],
    ['-- Formula htp-di-nsw.t', 'thot-18646'],
    ['-- Funerary formula', 'thot-18648'],
    ['---- Canopic jar text', 'thot-18650'],
    ['---- Scarab text', 'thot-18651'],
    ['---- Shabti text', 'thot-18649'],
    ['-- Funerary lament', 'thot-18652'],
    ['-- Funerary offering list', 'thot-18647'],
    ['-- Funerary ritual text', 'thot-18654'],
    ['---- Embalmment ritual', 'thot-18655'],
    ['---- Libation text', 'thot-18657'],
    ['---- Opening the mouth ritual', 'thot-18656'],
    ['---- Religious tomb scene caption', 'thot-18658'],
    ['-- Glorification text', 'thot-18653'],
    ['-- Litany of the sun', 'thot-18645'],
    ['-- Pyramid texts', 'thot-18636'],
    ['-- Unspecified funerary text', 'thot-18659'],
    ['Geographical text', 'thot-18714'],
    ['-- List of foreign countries', 'thot-18716'],
    ['-- Topographical list', 'thot-18715'],
    ['Legal text', 'thot-18718'],
    ['-- Cadastral document', 'thot-18740'],
    ['-- Contract', 'thot-18719'],
    ['---- Adoption contract', 'thot-18722'],
    ['---- Contract of guarantee', 'thot-18730'],
    ['---- Deed of association', 'thot-18728'],
    ['---- Deed of gift', 'thot-18725'],
    ['---- Deed of loan', 'thot-18724'],
    ['---- Deed of partition', 'thot-18726'],
    ['---- Deed of sale', 'thot-18723'],
    ['---- Deed of service', 'thot-18727'],
    ['---- Deposit', 'thot-18731'],
    ['---- Divorce document', 'thot-18721'],
    ['---- Document of exchange', 'thot-18729'],
    ['---- Funerary contract', 'thot-18737'],
    ['---- Imit-per document/will', 'thot-18736'],
    ['---- Lease', 'thot-18734'],
    ['---- Marriage contract', 'thot-18720'],
    ['---- Pay warrant', 'thot-18732'],
    ['---- Statement of debt', 'thot-18733'],
    ['---- Unspecified private contract', 'thot-18738'],
    ['---- Work contract', 'thot-18735'],
    ['-- Court record/deposition', 'thot-18739'],
    ['Letter', 'thot-18760'],
    ['-- Letter (to the living)', 'thot-18761'],
    ['-- Letter to the dead', 'thot-18762'],
    ['-- Letter to the gods', 'thot-18766'],
    ['-- Model letter', 'thot-18764'],
    ['-- Model letter as a literary form', 'thot-18763'],
    ['-- Unspecified letter', 'thot-18765'],
    ['Literary text', 'thot-18772'],
    ['-- Discourse', 'thot-18778'],
    ['-- Instruction', 'thot-18774'],
    ['-- Lamentation', 'thot-18776'],
    ['-- Prophecy', 'thot-18777'],
    ['-- Tale', 'thot-18775'],
    ['-- Wisdom text', 'thot-18773'],
    ['Magical text', 'thot-18684'],
    ['Mythological text', 'thot-18678'],
    ['-- Aetiological text', 'thot-18681'],
    ['---- Book of the divine cow', 'thot-18682'],
    ['-- Cosmogonic text', 'thot-18680'],
    ['-- Cosmographic text', 'thot-18679'],
    ['-- Unspecified mythological text', 'thot-18683'],
    ['Name/filiation/title', 'thot-18711'],
    ['Non-royal historical text', 'thot-18710'],
    ['Onomasticon', 'thot-18759'],
    ['Petition', 'thot-18779'],
    ['-- Petition to official', 'thot-18782'],
    ['-- Petition to the gods', 'thot-18780'],
    ['-- Petition to the king', 'thot-18781'],
    ['Royal text', 'thot-18696'],
    ['-- Royal annals', 'thot-18704'],
    ['---- Royal list', 'thot-18705'],
    ['-- Royal decree/warrant', 'thot-18708'],
    ['-- Royal historical text', 'thot-18703'],
    ['-- Royal letter', 'thot-18707'],
    ['-- Royal name and titles', 'thot-18697'],
    ['---- Golden horus', 'thot-18700'],
    ['---- Horus name', 'thot-18698'],
    ['---- Nebty name', 'thot-18699'],
    ['---- Nomen', 'thot-18702'],
    ['---- Prenomen', 'thot-18701'],
    ['-- Unspecified royal text', 'thot-18709'],
    ['-- «königsnovelle»', 'thot-18706'],
    ['Scientific text', 'thot-18753'],
    ['-- Astronomical/astrological text', 'thot-18758'],
    ['-- Mathematical text', 'thot-18757'],
    ['-- Medical text', 'thot-18754'],
    ['---- Human medical text', 'thot-18755'],
    ['---- Veterinary text', 'thot-18756'],
    ['Song', 'thot-18767'],
    ["-- Harpist's song", 'thot-18770'],
    ['-- Love song', 'thot-18768'],
    ['-- Unspecified non-religious song', 'thot-18771'],
    ['-- Work song', 'thot-18769'],
    ['Text relating to cult', 'thot-18660'],
    ['-- Divine cult text', 'thot-18667'],
    ['---- Divine names and epitheta', 'thot-18668'],
    ['---- Dramatic text', 'thot-18669'],
    ['---- Hymn', 'thot-18670'],
    ['---- Ritual text', 'thot-18671'],
    ['---- Unspecified divine cult text', 'thot-18672'],
    ['-- Royal cult text', 'thot-18673'],
    ['---- Dramatic text', 'thot-18674'],
    ['---- Hymn', 'thot-18675'],
    ['---- Ritual text', 'thot-18676'],
    ['---- Unspecified royal cult text', 'thot-18677'],
    ['-- Text relating to temples', 'thot-18661'],
    ['---- Divine annals', 'thot-18666'],
    ['---- Temple decree', 'thot-18663'],
    ['---- Temple foundation text', 'thot-18665'],
    ['---- Temple name', 'thot-18662'],
    ['---- Temple scene caption', 'thot-18664'],
    ['Text relating to professional duties', 'thot-18717'],
    ['Undefinable text', 'thot-18785'],
    ['Unspecified religious text', 'thot-18685'],
    ['-- Address to the living', 'thot-18690'],
    ['-- Amuletic text', 'thot-18692'],
    ['-- Divine decree', 'thot-18688'],
    ['-- Donation text', 'thot-18693'],
    ['-- Offering list', 'thot-18694'],
    ['-- Oracle', 'thot-18686'],
    ['-- Priestly decree', 'thot-18689'],
    ['-- Saïtic formula', 'thot-18691'],
    ['-- Text relating to personal piety', 'thot-18687'],
    ['-- Undefinable religious text', 'thot-18695'],
    ['Unspecified text', 'thot-18784']
];

const egyptianScripts = [
    ['Hieroglyphs', 'thot-83'],
    ['-- Cryptographic Use', 'thot-84'],
    ['-- Ptolemaic script', 'thot-85'],
    ['-- Cursive Hieroglyphs', 'thot-87'],
    ['Demotic', 'thot-67'],
    ['-- Early Demotic', 'thot-68'],
    ['-- Late Demotic', 'thot-70'],
    ['-- Middle Demotic', 'thot-69'],
    ['Hieratic', 'thot-71'],
    ['-- Old Hieratic', 'thot-73'],
    ['-- Archaic Hieratic', 'thot-74'],
    ['-- Middle Hieratic', 'thot-75'],
    ['---- Administrative Middle Hieratic', 'thot-77'],
    ['---- Literary Middle Hieratic', 'thot-76'],
    ['-- Ramesside Hieratic', 'thot-78'],
    ['---- Administrative Ramesside Hieratic', 'thot-80'],
    ['---- Literary Ramesside Hieratic', 'thot-79'],
    ['-- Later Hieratic', 'thot-81'],
    ['---- Literary Late Hieratic', 'thot-82'],
    ['Cursive Hieratic', 'thot-72'],
    ['Abjad scripts', 'thot-108'],
    ['-- Arabic', 'thot-88'],
    ['-- Aramäisch', 'thot-89'],
    ['-- Phoenician', 'thot-99'],
    ['-- Syriac', 'thot-100'],
    ['Abudiga scripts', 'thot-112'],
    ['-- Meroitic Hieroglyphs', 'thot-96'],
    ['-- Meroitic Cursive', 'thot-97'],
    ['Alphabetic scripts', 'thot-109'],
    ['-- Coptic', 'thot-91'],
    ['---- Coptic, half-uncial', 'thot-92'],
    ['---- Coptic, cursive', 'thot-93'],
    ['---- Coptic, uncial', 'thot-94'],
    ['-- Greek', 'thot-90'],
    ['-- Latin', 'thot-95']
];

const thesauriDict = {
    'chinese': {
        'scripts': chineseScripts,
        'genres': chineseGenres
    },
    'hieroglyphic': {
        'scripts': egyptianScripts,
        'genres': egyptianGenres
    }
};

function thesaurus2Select(thesaurus, style, onchange) {
    return m(
        'select',
        {style: style, onchange: onchange},
        [['Any', 'any']]
            .concat(thesaurus)
            .map(tuple => m(
            'option',
            {value: tuple[1]},
            tuple[0]))
    )
}

function getSelectFromThesaurus(thesaurusName, style, onchange) {
    try {
        return thesaurus2Select(
            thesauriDict[projectType][thesaurusName],
            style,
            onchange);
    } catch (error) {
        return thesaurus2Select([], style, onchange);
    }
}

