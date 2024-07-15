const bibtexEntryTemplate = {
    id: null,
    entry_type: 'book',
    abbreviation: null,
    description: getFields(bibtexBookTemplateAuthor)
};

let biblioEditorFilterDict = {};

let biblio_menu = {
    view: (vnode) => {
        const menu_idx = vnode.attrs.menu_idx;
        return m(
            'div',
            {class: 'biblio-menu-wrapper'},
            [
                m(killButton, {menu_idx: menu_idx}),

                m(biblioEditorSearchByTitleComponent, {menu_idx: menu_idx}),
                m('br'),

                m('h4', {style: {'margin-bottom': '5px'}}, "Select the publication type:"),
                m(
                    'select',
                    {
                        id: `bibtex-type-selector-${menu_idx}`,
                        value: menuArr[menu_idx].entry_type === undefined ? 'book' : menuArr[menu_idx].entry_type,
                        onchange: () => {
                            menuArr[menu_idx].entry_type = byID(`bibtex-type-selector-${menu_idx}`).value;
                            changeBibtexType(menu_idx, menuArr[menu_idx].entry_type);
                        },
                        style: {width: '200px'}
                    },
                    [
                        m('option', {value: "book"}, "Book"),
                        m('option', {value: "book (edited)"}, "Book (edited)"),
                        m('option', {value: "article"}, "Journal article"),
                        m('option', {value: "chapter"}, "Book chapter"),
                        m('option', {value: "thesis"}, "Thesis")
                    ]
                ),
                getMenu(menu_idx),
                m('input[type=button]', {
                    value: menuArr[menu_idx].id === null ? 'Add new record' : 'Modify record',
                    onclick: () => {
                        biblioEditorSubmit(menu_idx);
                    }
                })
            ])}};

function getMenu(menu_idx) {
    switch (menuArr[menu_idx].entry_type) {
        case "book":
            return m('div.menu-inner', {id: 'biblio-menu'}, bookMenu(menu_idx));
        case "book (edited)":
            return m('div.menu-inner', {id: 'biblio-menu'}, bookMenuEdited(menu_idx));
        case "article":
            return m('div.menu-inner', {id: 'biblio-menu'}, articleMenu(menu_idx));
        case "chapter":
            return m('div.menu-inner', {id: 'biblio-menu'}, chapterMenu(menu_idx));
        case "thesis":
            return m('div.menu-inner', {id: 'biblio-menu'}, thesisMenu(menu_idx));
        default:
            return m('div.menu-inner', {id: 'biblio-menu'}, bookMenu(menu_idx));
    }
}

let biblioEditorSearchByTitleComponent = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        return m('div.menu-row', [
            m('span', 'Search by author and title: '),
            m(menuCacheMenu, {
                menu_idx: menu_idx,
                menuName: 'biblio-editor-search-menu',
                cacheFieldName: 'biblioAbbrevTitle',
                filterDict: biblioEditorFilterDict,
                filterFunction: (tuple, containerID) => {
                    let test = get(biblioEditorFilterDict, containerID, '').toLowerCase();
                    return (String(tuple[1].abbreviation) + String(tuple[1].title))
                        .toLowerCase()
                        .indexOf(test) >= 0;
                },
                divBuilderCallback: (tuple, containerID) => {
                    let button = document.createElement('div');
                    button.innerText = tuple[1].abbreviation === null || tuple[1].abbreviation === '' ?
                        tuple[1].title : tuple[1].abbreviation;
                    button.classList.add('menu-button-value');
                    button.onclick = () => {
                        biblioEditorFilterDict[containerID] = '';
                        fetchBiblioEditorRecordAndRedraw(menu_idx, tuple[0]);
                    }
                    return button;
                }
            }),
            m(menuCacheButton, {
                menu_idx: menu_idx,
                menuName: 'biblio-editor-search-menu'
            })
        ])
    }
};
