let clfFilterDict = {};

let clf_annotation_menu = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        return m(
            'div.menu', [
            m(killButton, { menu_idx: menu_idx }),

            m('div.menu-col.annotation-color', [
                m('span', 'Select a classifier: '),
                m('select', {
                    value: menuArr[menu_idx].description.clf === null ?
                        '---' :
                        menuArr[menu_idx].description.clf,
                    onchange: e => { showClfAnnotation(e.target.value, menu_idx) }
                }, [
                    m('option', { value: '---', disabled: true }, '---'),
                    ...menu_data_cache.classifiers.map(clf => m('option', {
                        value: clf
                    }, clf))
                ])
            ]),

            m('div.menu-col.annotation-color', [
                m('span', 'Search: '),
                m(menuCacheMenu, {
                    menu_idx: menu_idx,
                    menuName: 'classifier-search-menu',
                    cacheFieldName: 'classifiers',
                    filterDict: clfFilterDict,
                    filterFunction: (clf, containerId) => {
                        let test = get(
                            clfFilterDict,
                            containerId,
                            ''
                        ).toLowerCase();
                        return clf.toLowerCase().indexOf(test) >= 0;
                    },
                    divBuilderCallback: (clf, containerId) => {
                        let button = document.createElement('div');
                        button.innerText = clf;
                        button.classList.add('menu-button-value');
                        button.onclick = () => {
                            clfFilterDict[containerId] = '';
                            showClfAnnotation(clf, menu_idx)
                        }
                        return button;
                    }
                }),
                m(menuCacheButton, {
                    menu_idx: menu_idx,
                    menuName: 'classifier-search-menu'
                })
            ]),

            // Jsesh visualisation
            m('div.menu-row.annotation-color',
                {
                    style: {
                        display: menuArr[menu_idx].img_src === '' ? 'none' : 'block',
                    }
                },
                m('img', {
                    id: `jsesh-clf-${menu_idx}`,
                    src: menuArr[menu_idx].img_src
                })
            ),

            // Meanings
            m(clfMeaningListComponent, { menu_idx: menu_idx }),
            m(clfNewMeaningComponent, { menu_idx: menu_idx }),

            m('div.menu-row.annotation-color', [
                m('h4', { style: { 'margin-bottom': '0' } }, 'Comments:'),
                m('textarea', {
                    style: {
                        width: 'calc(100%-5px)',
                        height: '80px'
                    },
                    value: menuArr[menu_idx].description.comment,
                    oninput: e => {
                        e.redraw = false;
                        menuArr[menu_idx].description.comment = n(e.target.value);
                    }
                })
            ]),

            m('div.menu-row.annotation-color', m('input[type=button]', {
                disabled: menuArr[menu_idx].description.clf === null,
                value: 'Submit annotation',
                onclick: () => { submitClfAnnotation(menu_idx); }
            }))
        ]
        )
    }
};

let clfMeaningListComponent = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        return m(
            'div.menu-row.annotation-color',
            {
                style: { display: menuArr[menu_idx].meanings.length > 0 ? 'block' : 'none' }
            },
            [
                m('h4', { style: { 'margin-bottom': '5px' } }, 'Meanings:'),
                ...menuArr[menu_idx].meanings.map((meaning, idx) => m(
                    'div',
                    {
                        style: {
                            'margin-bottom': '5px',
                            padding: '3px',
                            border: '1px solid darkgrey'
                        }
                    }, [
                    m('span.b', { style: { display: 'inline-block', width: '80px' } }, 'Meaning: '),
                    m('span', v(meaning.description.meaning)),
                    m('br'),
                    m('span.b', { style: { display: 'inline-block', width: '80px' } }, 'Source: '),
                    m('span', getPublicationTitleFromID(meaning.description.source_id)),
                    m('br'),
                    m('span.b', { style: { display: 'inline-block', width: '80px' } }, 'Page or entry no.: '),
                    m('span', v(meaning.description.source_pages)),
                    m('br'),
                    m('div', { style: { display: 'flex', 'justify-content': 'flex-end' } },
                        m('input[type=button]', {
                            value: 'Delete meaning',
                            onclick: () => {
                                menuArr[menu_idx].meanings = drop(
                                    menuArr[menu_idx].meanings, idx)
                            }
                        }))
                ]))
            ])
    }
}

let clfNewMeaningComponent = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        return m(
            'div.menu-row.annotation-color',
            {
                style: {
                    display: 'grid',
                    'grid-template-columns': '80px 1fr',
                    'grid-row-gap': '5px'
                }
            },
            [
                m(
                    'div',
                    { style: { 'grid-column': '1/2' } },
                    m('span.b', { style: { display: 'inline-block' } }, 'Meaning: ')
                ),
                m(
                    'div',
                    { style: { 'grid-column': '2/3' } },
                    m('input[type=text]', {
                        style: { width: 'calc(100% - 7px)' },
                        value: menuArr[menu_idx].meaning_tmp.meaning,
                        oninput: e => {
                            e.redraw = false;
                            menuArr[menu_idx].meaning_tmp.meaning = n(e.target.value);
                        }
                    })
                ),
                m(
                    'div',
                    { style: { 'grid-column': '1/2' } },
                    m('span.b', { style: { display: 'inline-block' } }, 'Source: ')
                ),
                m(
                    'div',
                    { style: { 'grid-column': '2/3' } }, [
                    m('span', n(menuArr[menu_idx].meaning_tmp.source_id) === null ?
                        'not set' :
                        getPublicationTitleFromID(menuArr[menu_idx].meaning_tmp.source_id)),
                    m('br'),
                    m(menuCacheMenu, {
                        menu_idx: menu_idx,
                        menuName: 'clf-meaning-biblio',
                        cacheFieldName: 'biblio',
                        filterDict: clfFilterDict,
                        filterFunction: (tuple, containerId) => {
                            let test = get(
                                clfFilterDict,
                                containerId,
                                ''
                            )
                                .toLowerCase();
                            return tuple[1].title.toLowerCase()
                                .indexOf(test) >= 0 ||
                                tuple[1].abbreviation.toLowerCase()
                                    .indexOf(test) >= 0;
                        },
                        divBuilderCallback: (tuple, containerId) => {
                            let button = document.createElement('div');
                            button.innerText = getPublicationTitleFromID(parseInt(tuple[0]));
                            button.classList.add('menu-button-value');
                            button.onclick = () => {
                                menuArr[menu_idx].meaning_tmp.source_id = parseInt(tuple[0]);
                                clfFilterDict[containerId] = '';
                                m.redraw();
                            }
                            return button;
                        }
                    }),
                    m(menuCacheButton, {
                        menu_idx: menu_idx,
                        menuName: 'clf-meaning-biblio'
                    })
                ]
                ),
                m(
                    'div',
                    { style: { 'grid-column': '1/2' } },
                    m('span.b', { style: { display: 'inline-block' } }, 'Page or entry no.: ')
                ),
                m(
                    'div',
                    { style: { 'grid-column': '2/3' } },
                    m('input[type=text]', {
                        style: { width: 'calc(100% - 7px)' },
                        value: menuArr[menu_idx].meaning_tmp.source_pages,
                        oninput: e => {
                            e.redraw = false;
                            menuArr[menu_idx].meaning_tmp.source_pages = n(e.target.value);
                        }
                    })
                ),
                m(
                    'div',
                    { style: { 'grid-column': '1/2' } },
                    m('input[type=button]', {
                        style: { 'margin-top': '10px' },
                        value: 'Add meaning',
                        onclick: () => {
                            menuArr[menu_idx].meanings.push({
                                id: null,
                                description: {
                                    clf: menuArr[menu_idx].description.clf,
                                    meaning: menuArr[menu_idx].meaning_tmp.meaning,
                                    source_id: menuArr[menu_idx].meaning_tmp.source_id,
                                    source_pages: menuArr[menu_idx].meaning_tmp.source_pages
                                }
                            });
                            menuArr[menu_idx].meaning_tmp = {
                                meaning: null,
                                source_id: null,
                                source_pages: null
                            };
                        }
                    })
                )
            ]
        )
    }
}