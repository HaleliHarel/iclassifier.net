//
// The root component. A thin wrapper around the menus that allows us to have a bunch of those.
//
let menuArr           = [],
    menuTypeArray     = [],
	projectTypeArray  = [],
    componentSelector = {
        'token': menu,
        'lemma': lemma_menu,
        'object': object_menu,
        'witness': witness_menu,
        'biblio': biblio_menu,
        'supertext': supertext_menu,
		'tokens-from-text': bulk_entry_menu,
        'info': info_div,
        'annotation': clf_annotation_menu,
        'admin-comments-tokens': admin_comments_menu
    };

let meta = {
    view: () => m('div#menu-wrapper', menuArr.map((_, menu_idx) => m(
        Object.assign({},componentSelector[menuTypeArray[menu_idx]]),
        {menu_idx: menu_idx})))
};

function addMenu(menu_type) {
    switch (menu_type) {
        case 'supertext':
            menuArr.push(JSON.parse(JSON.stringify(superTextInfoTemplate)));
            menuTypeArray.push(menu_type);
            projectTypeArray.push(projectType);
            m.redraw();
            break;
        case 'token':
            menuArr.push(JSON.parse(JSON.stringify(tokenInfoTemplate)));
            menuTypeArray.push(menu_type);
            projectTypeArray.push(projectType);
            m.redraw();
            break;
        case 'biblio':
            menuArr.push(JSON.parse(JSON.stringify(bibtexEntryTemplate)));
            menuTypeArray.push(menu_type);
            projectTypeArray.push(projectType);
            m.redraw();
            break;
        case 'lemma':
            menuArr.push(JSON.parse(JSON.stringify(emptyLemmaInfo)));
            menuTypeArray.push(menu_type);
            projectTypeArray.push(projectType);
            m.redraw();
            break;
		case 'tokens-from-text':
            menuArr.push(copy(bulkInputInfo));
            menuTypeArray.push(menu_type);
            projectTypeArray.push(projectType);
            m.redraw();
            break;
        case 'object':
            menuArr.push(copy(objectInfoTemplate));
            menuTypeArray.push(menu_type);
            projectTypeArray.push(projectType);
            m.redraw();
            break;
        case 'witness':
            menuArr.push(copy(witnessInfoTemplate));
            menuTypeArray.push(menu_type);
            projectTypeArray.push(projectType);
            m.redraw();
            break;
        case 'info':
            menuArr.push({});
            menuTypeArray.push(menu_type);
            projectTypeArray.push(projectType);
            m.redraw();
            break;
        case 'annotation':
            menuArr.push(copy(clfAnnotationTemplate));
            menuTypeArray.push(menu_type);
            projectTypeArray.push(projectType);
            m.redraw();
            break;
        case 'admin-comments-tokens':
            menuArr.push(copy(adminCommentTemplate));
            menuTypeArray.push(menu_type);
            projectTypeArray.push(projectType);
            m.redraw();
            break;
        default:
            throw `The menu type ${menu_type} is not recognised.`;
    }
}

//
// Share menu data between menus.
//
let menu_data_cache = {
    supertext: [],
    lemma: [],
    'object': [],
    witness: [],
    biblio: [],
    tokensWithMDC: [],
    lemmaBasic: [],
    concepts: [],
    classifiers: [],
    biblioAbbrevTitle: []
};

const projectTypesWithDictionaries = [
    'hieroglyphic',
    'chinese'
];