// Stores filters for different menus
// indexed by their ids.
let lemmaFilterDict = {};

//
// Lemma-menu component
//
let lemma_menu = {
    view: vnode => {
        let menu_idx = vnode.attrs.menu_idx;
        return m('div.menu', [
            // Remove this menu
            m(killButton, { menu_idx: menu_idx }),

            // Show lemma by ID
            m(showLemmaByIdComponent, { menu_idx: menu_idx }),

            // Search by transliteration
            m(searchLemmaByTransliterationComponent, { menu_idx: menu_idx }),

            // Lemma ID
            m('div.menu-row.menu-row-lemma', [
                m('span', { style: { 'font-weight': 'bold' } }, 'Lemma ID: '),
                m('span', txt(menuArr[menu_idx].id))
            ]),

            // Select a word from the dictionary.
            // Toggle the details component when
            // it is not on by default.
            m('div.menu-row.menu-row-lemma', {
                style: { display: noDict() ? 'none' : 'block' }
            },
                [
                    m(dictionaryButton, { menu_idx: menu_idx }),
                    m(dictionaryChoiceComponent, { menu_idx: menu_idx }),
                    m('input[type=button]', {
                        style: { 'margin-top': '3px' },
                        value: 'The lemma is not in the associated dictionary',
                        disabled: menuArr[menu_idx].id !== null,
                        onclick: () => {
                            menuArr[menu_idx]
                                .menu_switches
                                .show_lemma_details = true;
                            // Hide the dictionary menu
                            menuArr[menu_idx]
                                .menu_switches
                                .dictionary = false;
                        }
                    })
                ]),

            // The primary variant.
            m(lemmaVariantDetails, {
                menu_idx: menu_idx,
                primary: true
            }),

            // Other variants.
            m('div.menu-row.lemma-color',
                {
                    style: {
                        'margin-top': '0',
                        display: 'grid',
                        'grid-template-columns': '1fr 1fr'
                    }
                },
                [
                    m('div.menu-row', m('h4', { style: { 'margin-bottom': '5px' } }, 'Dictionary variants:')),
                    m(lemmaVariantsComponent, { menu_idx: menu_idx }),
                    m('div.menu-row', m('h4', { style: { 'margin-bottom': '5px' } }, 'Add a dictionary variant:')),
                    m(lemmaVariantDetails, { menu_idx: menu_idx, primary: false }),
                    m('div', { style: { 'grid-column': '1/2' } }, m('br'),
                        m('input[type=button]', {
                            value: 'Add a variant',
                            // Cannot add a variant without a transliteration and
                            // a source.
                            disabled: menuArr[menu_idx].variant_tmp.description.transliteration === null || menuArr[menu_idx].variant_tmp.description.source_id === null,
                            onclick: () => { addLemmaVariant(menu_idx) }
                        }))
                ]),

            // Lexical field
            m('div.menu-col.menu-col-lemma', [
                m('span', 'Lexical field (WOLD):'),
                m(
                    'select',
                    {
                        value: menuArr[menu_idx].description.lexical_field === null ? '---' : menuArr[menu_idx].description.lexical_field,
                        onchange: e => {
                            e.redraw = false;
                            menuArr[menu_idx].description.lexical_field = e.target.value;
                        }
                    },
                    [
                        m('option', { value: '---', disabled: true }, '---'),
                        m('option', { value: 'The physical world' }, 'The physical world'),
                        m('option', { value: 'Kinship' }, 'Kinship'),
                        m('option', { value: 'Animals' }, 'Animals'),
                        m('option', { value: 'The body' }, 'The body'),
                        m('option', { value: 'Food and drink' }, 'Food and drink'),
                        m('option', { value: 'Clothing and grooming' }, 'Clothing and grooming'),
                        m('option', { value: 'The house' }, 'The house'),
                        m('option', { value: 'Agriculture and vegetation' }, 'Agriculture and vegetation'),
                        m('option', { value: 'Basic actions and technology' }, 'Basic actions and technology'),
                        m('option', { value: 'Motion' }, 'Motion'),
                        m('option', { value: 'Possession' }, 'Possession'),
                        m('option', { value: 'Spatial relations' }, 'Spatial relations'),
                        m('option', { value: 'Quantity' }, 'Quantity'),
                        m('option', { value: 'Time' }, 'Time'),
                        m('option', { value: 'Sense perception' }, 'Sense perception'),
                        m('option', { value: 'Emotions and values' }, 'Emotions and values'),
                        m('option', { value: 'Cognition' }, 'Cognition'),
                        m('option', { value: 'Speech and language' }, 'Speech and language'),
                        m('option', { value: 'Social and political relations' }, 'Social and political relations'),
                        m('option', { value: 'Warfare and hunting' }, 'Warfare and hunting'),
                        m('option', { value: 'Law' }, 'Law'),
                        m('option', { value: 'Religion and belief' }, 'Religion and belief'),
                        m('option', { value: 'Modern world' }, 'Modern world'),
                        m('option', { value: 'Miscellaneous function words' }, 'Miscellaneous function words'),
                        m('option', { value: 'Other' }, 'Other')
                    ]
                )
            ]),

            // Secondary lexical field
            // getLemmaInputField(menu_idx, 'lexical_field_secondary', 'Secondary lexical field'),
            m('div.menu-col.lemma-color', [
                m.trust(`<span>Secondary lexical field (<a href="https://concepticon.clld.org/parameters" target="_blank">Concepticon</a>): ${v(menuArr[menu_idx].description.lexical_field_secondary)}</span>`),
                // m('span', `Secondary lexical field (Concepticon): ${v(menuArr[menu_idx].description.lexical_field_secondary)}`),
                m('br'),
                m(menuCacheMenu, {
                    menu_idx: menu_idx,
                    menuName: 'lemma-concepts',
                    cacheFieldName: 'concepts',
                    filterDict: lemmaFilterDict,
                    filterFunction: (concept, containerId) => {
                        let test = get(
                            lemmaFilterDict,
                            containerId,
                            ''
                        ).toLowerCase();
                        return concept.toLowerCase().indexOf(test) >= 0;
                    },
                    divBuilderCallback: (concept, containerId) => {
                        let button = document.createElement('div');
                        button.innerText = concept;
                        button.classList.add('menu-button-value');
                        button.onclick = () => {
                            clfFilterDict[containerId] = '';
                            menuArr[menu_idx].description.lexical_field_secondary = concept;
                            m.redraw();
                        }
                        return button;
                    }
                }),
                m(menuCacheButton, {
                    menu_idx: menu_idx,
                    menuName: 'lemma-concepts'
                })
            ]),

            // Root
            m(
                'div.menu-row.lemma-color', [
                m('span', 'Root: '),
                m('input[type=text]', {
                    style: { width: '180px' },
                    value: menuArr[menu_idx].description.root,
                    oninput: e => { e.redraw = false; menuArr[menu_idx].description.root = e.target.value; }
                }),
                m('input[type=button]', {
                    style: { display: projectType === 'hieroglyphic' ? 'inline-block' : 'none', 'margin-left': '5px' },
                    value: 'Convert to Unicode',
                    onclick: () => { menuArr[menu_idx].description.root = convertToUnicode(menuArr[menu_idx].description.root) }
                }
                )
            ]),

            // plug
            // m('div.menu-col.menu-col-lemma'),

            // Demotic
            getLemmaInputField(menu_idx, 'demotic', 'Demotic', true),

            // Demotic meaning
            getLemmaInputField(menu_idx, 'demotic_meaning', 'Demotic meaning', true),

            // Show sources for Demotic
            m('div.menu-row.menu-row-lemma',
                { style: { display: projectType === 'hieroglyphic' ? 'block' : 'none' } },
                m('input[type=button]', {
                    value: 'Select source', onclick: () => {
                        menuArr[menu_idx].menu_switches.demotic_source = true;
                        fetchBiblioAndRedraw();
                    }
                })),

            // Select a Demotic source
            m(
                'div.menu-row.menu-row-lemma',
                { style: { display: menuArr[menu_idx].menu_switches.demotic_source ? 'block' : 'none' } },
                [
                    m('span', 'Selected publication: ' + menuArr[menu_idx].menu_data.demotic_source_title),
                    m('br'),
                    m('span', 'Pages: '),
                    m('input[type=text]', {
                        value: menuArr[menu_idx].description.demotic_lexicon_entry_pages,
                        oninput: e => { e.redraw = false; menuArr[menu_idx].description.demotic_lexicon_entry_pages = e.target.value === '' ? null : e.target.value }
                    }),
                    m(lemmaDemoticSourceChoiceComponent, { menu_idx: menu_idx })
                ]
            ),

            // Coptic
            getLemmaInputField(menu_idx, 'coptic', 'Coptic', true),

            // Coptic meaning
            getLemmaInputField(menu_idx, 'coptic_meaning', 'Coptic meaning', true),

            // Show sources for Coptic
            m('div.menu-row.menu-row-lemma',
                { style: { display: projectType === 'hieroglyphic' ? 'block' : 'none' } },
                m('input[type=button]', { value: 'Select source', onclick: () => { menuArr[menu_idx].menu_switches.coptic_source = true } })),

            // Select a Coptic source
            m(
                'div.menu-row.menu-row-lemma',
                { style: { display: menuArr[menu_idx].menu_switches.coptic_source ? 'block' : 'none' } },
                [
                    m('span', 'Selected publication: ' + menuArr[menu_idx].menu_data.coptic_source_title),
                    m('br'),
                    m('span', 'Pages: '),
                    m('input[type=text]', {
                        value: menuArr[menu_idx].description.coptic_lexicon_entry_pages,
                        oninput: e => { e.redraw = false; menuArr[menu_idx].description.coptic_lexicon_entry_pages = e.target.value === '' ? null : e.target.value }
                    }),
                    m(lemmaCopticSourceChoiceComponent, { menu_idx: menu_idx })
                ]
            ),

            // Borrowing info
            m(lemmaBorrowingInfoComponent, { menu_idx: menu_idx }),

            // Cognates
            m(lemmaCognatesComponent, { menu_idx: menu_idx }),

            // Biblio references
            m(lemmaBiblioReferences, { menu_idx: menu_idx }),

            // Comments
            m('div.menu-row.lemma-color', [
                m('span', 'Comments: '),
                m('br'),
                m('textarea', {
                    class: projectType,
                    rows: 7,
                    value: menuArr[menu_idx].description.comments,
                    oninput: (e) => {
                        e.redraw = false;
                        menuArr[menu_idx].description.comments = e.target.value === '' ? null : e.target.value;
                    }
                })
            ]),

            // Button row
            m(
                'div.menu-row.lemma-color',
                { style: { display: 'flex', 'justify-content': 'space-between' } },
                [
                    // Submit
                    m('input[type=button]', {
                        value: 'Submit',
                        style: { width: '80px' },
                        onclick: () => { submitLemma(menu_idx) }
                    }),

                    // Delete
                    m('input[type=button]', {
                        value: 'Delete',
                        disabled: menuArr[menu_idx].id === null,
                        style: { width: '80px' },
                        onclick: () => { deleteLemma(menu_idx) }
                    }),
                ]
            )
        ])
    }
};

let showLemmaByIdComponent = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        return m('div.menu-row.menu-row-lemma',
            [
                m('span', 'Show lemma: '),
                m('input[type=text]', {
                    placeholder: 'lemma ID',
                    style: { width: '100px' },
                    value: menuArr[menu_idx].id_query,
                    oninput: (e) => {
                        e.redraw = false;
                        menuArr[menu_idx].id_query = e.target.value === '' ? null : e.target.value;
                    }
                }),
                m('input[type=button]', {
                    style: { 'margin-left': '5px' },
                    value: 'Submit', onclick: () => {
                        if (menuArr[menu_idx].id_query !== null) {
                            if (menuArr[menu_idx].id_query.match(/^[1-9]\d*$/) === null) {
                                alert('Lemma IDs are positive integers.');
                            } else
                                fetchLemmaInfoAndRedraw(
                                    menu_idx,
                                    menuArr[menu_idx].id_query,
                                    no_data_callback = () => { },
                                    invoked_by_user = true);
                        }
                    }
                }),
                m.trust('<span>&nbsp;&nbsp;</span>'),
                m('input[type=button]', {
                    value: '<< Previous',
                    onclick: () => { showPreviousLemma(menu_idx) }
                }),
                m('input[type=button]', {
                    value: 'Next >>',
                    onclick: () => { showNextLemma(menu_idx) }
                })
            ])
    }
}

let searchLemmaByTransliterationComponent = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        return m('div.menu-row.lemma-color', [
            m('span', 'Search by transliteration/translation: '),
            m(menuCacheMenu, {
                menu_idx: menu_idx,
                menuName: 'lemma-search-menu',
                cacheFieldName: 'lemmaBasic',
                filterDict: lemmaFilterDict,
                filterFunction: (tuple, containerId) => {
                    let test = get(
                        lemmaFilterDict,
                        containerId,
                        ''
                    ).toLowerCase();
                    return (
                        String(tuple[1].transliteration) + String(tuple[1].translation)
                    ).toLowerCase().indexOf(test) >= 0;
                },
                divBuilderCallback: (tuple, containerId) => {
                    let button = document.createElement('div');
                    button.innerText = `${tuple[0]}: ${tuple[1].transliteration} (${tuple[1].translation})`;
                    button.classList.add('menu-button-value');
                    // A special font for ancient kanji
                    if (projectTag === 'guodianimported') {
                        button.classList.add('guodian');
                    }
                    button.onclick = () => {
                        clfFilterDict[containerId] = '';
                        fetchLemmaInfoAndRedraw(menu_idx, tuple[0]);
                    }
                    return button;
                }
            }),
            m(menuCacheButton, {
                menu_idx: menu_idx,
                menuName: 'lemma-search-menu'
            })
        ])
    }
}

function getLemmaInputField(menu_idx, field, label, only_hieroglyphic = false) {
    if (!only_hieroglyphic)
        return m('div.menu-col.menu-col-lemma', [
            m('span', `${label}:`),
            m('input[type=text]', {
                value: menuArr[menu_idx].description[field],
                oninput: e => {
                    e.redraw = false;
                    menuArr[menu_idx].description[field] = e.target.value;
                }
            })
        ])
    else
        return m('div.menu-col.menu-col-lemma',
            {
                style: { display: projectType === 'hieroglyphic' ? 'block' : 'none' }
            },
            [
                m('span', `${label}:`),
                m('input[type=text]', {
                    value: menuArr[menu_idx].description[field],
                    oninput: e => {
                        e.redraw = false;
                        menuArr[menu_idx].description[field] = e.target.value;
                    }
                })
            ])
}

function showPreviousLemma(menu_idx) {
    showPreviousAbstract(menu_idx, lemmaIDs, fetchLemmaInfoAndRedraw);
}

function showNextLemma(menu_idx) {
    showNextAbstract(menu_idx, lemmaIDs, fetchLemmaInfoAndRedraw);
}

let dictionaryButton = {
    view: vnode => {
        let menu_idx = vnode.attrs.menu_idx;
        return m('input[type=button]',
            {
                value: `Choose a word from the associated dictionary`,
                disabled: menuArr[menu_idx].id !== null,
                onclick: () => {
                    menuArr[menu_idx].menu_switches['dictionary'] = true;
                    // Hide the details menu.
                    menuArr[menu_idx].menu_switches
                        .show_lemma_details = false;
                }
            });
    }
};

let dictionaryChoiceComponent = {
    view: vnode => {
        let menu_idx = vnode.attrs.menu_idx;
        return m('div.menu-row.menu-row-lemma',
            { style: { display: menuArr[menu_idx].menu_switches.dictionary ? 'block' : 'none' } }, [
            m('br'),
            m('label', {
                'for': `allow-short-search-${menu_idx}`,
                style: { width: '250px', display: 'inline-block' }
            },
                'Allow searches based on one symbol (can be very slow on slow networks)'),
            m('input[type=checkbox]', {
                id: `allow-short-search-${menu_idx}`,
                checked: menuArr[menu_idx].menu_data.allow_short_searches,
                style: { transform: 'scale(1.5)' },
                onclick: e => {
                    const wasChecked = !e.target.checked;
                    menuArr[menu_idx].menu_data.allow_short_searches = !wasChecked;
                }
            }),
            m('br'), m('br'),
            m('span', { style: { 'font-weight': 'bold' } }, 'Query the dictionary'),
            m('br'),
            m('span', {
                style: {
                    display: 'inline-block', width: '170px',
                    'margin-top': '5px'
                }
            }, 'By transliteration: '),
            m(dictQueryComponent, { menu_idx: menu_idx, queryType: 'transliteration' }),
            m('input[type=button]', {
                value: 'Convert to Unicode',
                onclick: e => {
                    e.redraw = false;
                    const inputFieldID = `${menu_idx}-dict-query-text-input`,
                        currentInputValue = byID(inputFieldID).value,
                        newValue = convertToUnicode(currentInputValue);
                    byID(inputFieldID).value = newValue;
                    menuArr[menu_idx]
                        .menu_data
                        .dict_query_transliteration = newValue === '' ? null : newValue;
                    fetchDictionaryWordsAndRedraw(menu_idx, 'transliteration');
                },
                style: {
                    display: projectType === 'hieroglyphic' ? 'block' : 'none'
                }
            }),
            m('span', { style: { display: 'inline-block', width: '170px' } }, 'By translation: '),
            m(dictQueryComponent, { menu_idx: menu_idx, queryType: 'translation' }),
            // Unlike in the general case, filtering is done on the server.
            menuArr[menu_idx].menu_data.dictionary_cache === null ?
                m('div.select-list', 'Enter a query') :
                m('div.select-list', menuArr[menu_idx]
                    .menu_data
                    .dictionary_cache
                    .map(lemmaDictionarySpanBuilder(menu_idx))),
            m('input[type=button]', {
                class: projectType,
                value: 'Hide menu',
                style: { 'margin-top': '5px' },
                onclick: () => {
                    menuArr[menu_idx]
                    .menu_switches
                    .dictionary = false
                }
            })
        ]);
    }
};

let dictQueryComponent = {
    view: vnode => {
        let menu_idx = vnode.attrs.menu_idx,
            queryType = vnode.attrs.queryType;
        if (queryType === 'transliteration') {
            return m('input[type=text]', {
                id: `${menu_idx}-dict-query-text-input`,
                value: menuArr[menu_idx].menu_data.dict_query_transliteration,
                oninput: e => {
                    e.redraw = false;
                    menuArr[menu_idx]
                        .menu_data
                        .dict_query_transliteration = e.target.value === '' ?
                            null : e.target.value;
                    // Prevent the query from firing before the user ends typing.
                    clearTimeout(menuArr[menu_idx]
                        .menu_data
                        .dictionaryQueryTimeout);
                    menuArr[menu_idx]
                        .menu_data
                        .dictionaryQueryTimeout = setTimeout(() => {
                            fetchDictionaryWordsAndRedraw(menu_idx, queryType)
                        }, 1000);
                }
            })
        } else {
            return m('input[type=text]', {
                value: menuArr[menu_idx].menu_data.dict_query_translation,
                oninput: e => {
                    e.redraw = false;
                    menuArr[menu_idx]
                        .menu_data
                        .dict_query_translation = e.target.value === '' ?
                            null : e.target.value;
                    // Prevent the query from firing before the user ends typing.
                    clearTimeout(menuArr[menu_idx]
                        .menu_data
                        .dictionaryQueryTimeout);
                    menuArr[menu_idx]
                        .menu_data.dictionaryQueryTimeout = setTimeout(() => {
                            fetchDictionaryWordsAndRedraw(menu_idx, queryType)
                        }, 1000);
                }
            })
        }

    }
};

function lemmaDictionarySpanBuilder(menu_idx) {
    return value => m(
        'span.list-element',
        {
            class: projectType,
            onclick: () => {
                // Try to fetch the annotation for the dictionary lemma.
                // If there is none, fill in the dictionary values.
                const lemma_id = parseInt(value[0]);
                menuArr[menu_idx].id = lemma_id;
                fetchLemmaInfoAndRedraw(menu_idx, lemma_id, () => {
                    menuArr[menu_idx]
                        .description
                        .transliteration = value[1]['entry'];
                    menuArr[menu_idx]
                        .variants[0]
                        .description
                        .transliteration = value[1]['entry'];
                    menuArr[menu_idx]
                        .description
                        .meaning = value[1]['short_meaning'];
                    menuArr[menu_idx]
                        .variants[0]
                        .description
                        .meaning = value[1]['short_meaning'];
                    menuArr[menu_idx].menu_switches.show_lemma_details = true;
                    m.redraw();
                });
                menuArr[menu_idx]
                    .menu_switches
                    .show_lemma_details = true;
            }
        },
        `${value[1]['entry']} (${value[1]['short_meaning']})`
    )
}

//
// Biblio references
//
let lemmaBiblioReferences = {
    view: vnode => {
        let menu_idx = vnode.attrs.menu_idx;
        return m('div.biblio-references.lemma-color', [
            [m('div.menu-row.menu-row-lemma', m('h4', { style: { 'margin-top': '0', 'margin-bottom': '0' } },
                'Bibliographical references:'))]
                .concat(
                    menuArr[menu_idx].biblio_refs
                        .map(lemmaBiblioInfoDivBuilder(menu_idx))
                        .concat([
                            m('div.biblio-details.menu-row.menu-row-lemma', {
                                style: { display: menuArr[menu_idx].menu_switches.biblio ? 'grid' : 'none' }
                            },
                                [
                                    m(lemmaBiblioDetailsComponent, { menu_idx: menu_idx }),
                                    m(lemmaBiblioChoiceComponent, { menu_idx: menu_idx })
                                ]),
                            m('input[type=button]', {
                                style: {
                                    'grid-column': '1/2',
                                    'margin-top': '3px'
                                },
                                disabled: menuArr[menu_idx].menu_switches.biblio,
                                value: 'Add a bibliographical reference',
                                onclick: () => { addLemmaBiblioRef(menu_idx) }
                            })
                        ]))
        ]);
    }
};

let lemmaBiblioDetailsComponent = {
    view: vnode => {
        let menu_idx = vnode.attrs.menu_idx,
            tmp = menuArr[menu_idx].biblio_tmp;

        if (tmp === null)
            return m('span');

        let title;
        if (tmp.title === null)
            title = '';
        else
            title = tmp.title;

        const label_span_width = '50px';
        return m('div.menu-row.biblio-details', [
            m('div', { style: { 'grid-column': '1/3' } },
                m('span', { class: projectType }, `Publication: ${title}`)),
            m('div', { style: { 'grid-column': '1/3' } }, [
                m('span', { style: { width: label_span_width, display: 'inline-block' } }, 'Pages: '),
                m('input[type=text]', {
                    class: projectType,
                    style: { width: '300px' },
                    oninput: (e) => {
                        e.redraw = false;
                        menuArr[menu_idx].biblio_tmp.description.pages = e.target.value === '' ? null : e.target.value;
                    }
                })
            ]),
            m('div', { style: { 'grid-column': '1/3' } },
                [
                    m('span', { style: { width: label_span_width, display: 'inline-block' } }, 'URL: '),
                    m('input[type=text]', {
                        style: { width: '300px' },
                        oninput: (e) => {
                            e.redraw = false;
                            menuArr[menu_idx].biblio_tmp.description.url = e.target.value === '' ? null : e.target.value;
                        }
                    })
                ]),
            m('div', { style: { 'grid-column': '1/2' } }, m('input[type=button]', {
                value: 'Add reference',
                onclick: () => { validateAndAddLemmaReference(menu_idx) }
            }))
        ]);
    }
};

let lemmaBiblioChoiceComponent = createListChoiceComponent(
    'biblio',
    biblioFilter,
    lemmaBiblioSpanBuilderFactory
);

function lemmaBiblioSpanBuilderFactory(menu_idx) {
    // A temporary data structure is needed + an additional menu
    return (value) => m(
        'span.list-element',
        {
            onclick: () => {
                menuArr[menu_idx].biblio_tmp.description.dictionary_id = parseInt(value[0]);
                if (value[1]['abbreviation'] !== '')
                    menuArr[menu_idx].biblio_tmp.title = value[1]['abbreviation'];
                else
                    menuArr[menu_idx].biblio_tmp.title = value[1]['title'];
            }
        },
        value[1]['abbreviation'] !== '' ? value[1]['abbreviation'] : value[1]['title']
    );
}

function lemmaBiblioInfoDivBuilder(menu_idx) {
    return (biblio_info, index) => {
        let url_string;
        if (biblio_info.description.url !== '' && biblio_info.description.url !== null)
            url_string = `<br/><span>URL: </span><span>${biblio_info.description.url}</span>`;
        else
            url_string = '<span></span>';
        return m('div.menu-row.menu-row-lemma',
            {
                style: {
                    'border-top': '1px dotted white',
                    'border-bottom': '1px dotted white'
                }
            },
            [
                m('span', biblio_info.title),
                m('br'),
                m('span', 'Pages: ' + (biblio_info.description.pages === null ? '' : biblio_info.description.pages)),
                m.trust(url_string),
                m('div', {
                    style: {
                        display: 'flex', 'justify-content': 'flex-end',
                        'margin-top': '3px'
                    }
                },
                    m('input[type=button]', {
                        value: 'Delete reference',
                        onclick: () => {
                            menuArr[menu_idx].biblio_refs = drop(
                                menuArr[menu_idx].biblio_refs,
                                index)
                        }
                    }))
            ]);
    }
}

let lemmaDemoticSourceChoiceComponent = createListChoiceComponent(
    'demotic_source',
    biblioFilterFactory('demotic_source_filter'),
    lemmaDemoticSourceSpanBuilderFactory
);

function lemmaDemoticSourceSpanBuilderFactory(menu_idx) {
    return (value) => m(
        'span.list-element',
        {
            onclick: () => {
                menuArr[menu_idx].description.demotic_lexicon_entry = parseInt(value[0]);
                if (value[1]['abbreviation'] !== '')
                    menuArr[menu_idx].menu_data.demotic_source_title = value[1]['abbreviation'];
                else
                    menuArr[menu_idx].menu_data.demotic_source_title = value[1]['title'];
            }
        },
        value[1]['abbreviation'] !== '' ? value[1]['abbreviation'] : value[1]['title']
    );
}

let lemmaCopticSourceChoiceComponent = createListChoiceComponent(
    'coptic_source',
    biblioFilterFactory('coptic_source_filter'),
    lemmaCopticSourceSpanBuilderFactory
);

function lemmaCopticSourceSpanBuilderFactory(menu_idx) {
    return (value) => m(
        'span.list-element',
        {
            onclick: () => {
                menuArr[menu_idx].description.coptic_lexicon_entry = parseInt(value[0]);
                if (value[1]['abbreviation'] !== '')
                    menuArr[menu_idx].menu_data.coptic_source_title = value[1]['abbreviation'];
                else
                    menuArr[menu_idx].menu_data.coptic_source_title = value[1]['title'];
            }
        },
        value[1]['abbreviation'] !== '' ? value[1]['abbreviation'] : value[1]['title']
    );
}



function validateAndAddLemmaReference(menu_idx) {
    const biblio_info = copy(menuArr[menu_idx].biblio_tmp);
    if (biblio_info.description.dictionary_id === null)
        return;
    if (biblio_info.description.pages === '' || biblio_info.description.pages === null)
        if (!confirm('The "Pages" field is not filled. Continue?'))
            return;
    menuArr[menu_idx].biblio_refs.push(biblio_info);
    m.redraw();
}

function noDict() {
    return projectTypesWithDictionaries
        .indexOf(projectType) < 0
}

function needLemmaDetails(menu_idx) {
    return menuArr[menu_idx]
        .menu_switches
        .show_lemma_details ||
        projectTypesWithDictionaries
            .indexOf(projectType) < 0
}

//
// Variants
//
let lemmaVariantsComponent = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        return m('[', menuArr[menu_idx]
            .variants
            .slice(1)
            .map((vt, idx) => m('div.menu-row', {
                style: {
                    'grid-row': 'auto',
                    'background-color': '#f2ffde',
                    padding: '3px',
                    'margin-bottom': '3px',
                    display: 'grid',
                    'grid-template-columns': '1fr 1fr',
                    border: '1px dotted grey'
                }
            },
                [
                    m('div.menu-col',
                        [m('span.b', projectType === 'chinese' ? 'Transcription:' : 'Transliteration: '),
                        m('span', v(gd(vt).transliteration))]),
                    m('div.menu-col',
                        [m('span.b', 'Meaning: '),
                        m('span', v(gd(vt).meaning))]),
                    m('div.menu-col',
                        [m('span.b', 'Source: '),
                        m('span', getPublicationTitleFromID(gd(vt).source_id))]),
                    m('div.menu-col',
                        [m('span.b', 'Pages: '),
                        m('span', v(gd(vt).source_pages))]),
                    m('div.menu-col', m('input[type=button]', {
                        value: 'Delete variant',
                        onclick: () => {
                            menuArr[menu_idx]
                                .variants = drop(
                                    menuArr[menu_idx].variants,
                                    idx + 1);
                        }
                    }))
                ]
            )
            ));
    }
};

/** Short for getDescription */
function gd(obj) {
    return obj.description;
}

let lemmaVariantDetails = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx,
            primary = vnode.attrs.primary == 1;

        // console.log('primary: ', primary);

        let biblioMenuName,
            description;
        if (primary) {
            description = menuArr[menu_idx].variants[0].description;
            biblioMenuName = 'primary-var-biblio';
        } else {
            description = menuArr[menu_idx].variant_tmp.description;
            biblioMenuName = 'tmp-var-biblio';
        }

        // console.log(description);

        let transliteration = description.transliteration,
            meaning = description.meaning,
            pages = description.source_pages,
            pubTitle = getPublicationTitleFromID(
                description.source_id
            );

        return m('[', [
            // Transliteration
            primary ?
                m('div.menu-row.lemma-variant-primary', m(
                    'p',
                    { style: { margin: '0', 'font-weight': 'bold' } },
                    'Edit primary dictionary info:'
                )) :
                null,
            m(
                primary ? 'div.menu-col.lemma-variant-primary' : 'div.menu-col.lemma-variant',
                [
                    m('span', projectType === 'chinese' ? 'Transcription:' : 'Transliteration: '),
                    m('input[type=text]', {
                        value: transliteration,
                        class: 'obligatory',
                        placeholder: '*',
                        oninput: e => {
                            e.redraw = false;
                            const val = n(e.target.value);
                            if (primary) {
                                menuArr[menu_idx]
                                    .description
                                    .transliteration = val;
                                menuArr[menu_idx]
                                    .variants[0]
                                    .description
                                    .transliteration = val;
                            } else {
                                menuArr[menu_idx]
                                    .variant_tmp
                                    .description
                                    .transliteration = val;
                            }
                        }
                    }), m('br'),
                    m('input[type=button]', {
                        value: 'Convert to Unicode',
                        style: { visibility: projectType === 'hieroglyphic' ? 'visible' : 'hidden' },
                        onclick: () => {
                            if (primary) {
                                transliteration = menuArr[menu_idx]
                                    .variants[0]
                                    .description
                                    .transliteration;
                            } else {
                                transliteration = menuArr[menu_idx]
                                    .variant_tmp
                                    .description
                                    .transliteration;
                            }
                            if (transliteration === null ||
                                transliteration === '')
                                return;
                            const result = convertToUnicode(transliteration);
                            if (primary) {
                                menuArr[menu_idx]
                                    .description
                                    .transliteration = result;
                                menuArr[menu_idx]
                                    .variants[0]
                                    .description
                                    .transliteration = result;
                            } else {
                                menuArr[menu_idx]
                                    .variant_tmp
                                    .description
                                    .transliteration = result;
                            }
                        }
                    })
                ]
            ),

            // Source
            m(
                primary ? 'div.menu-col.lemma-variant-primary' : 'div.menu-col.lemma-variant',
                [
                    m('span', 'Source: ' + pubTitle),
                    m(menuCacheMenu, {
                        menu_idx: menu_idx,
                        menuName: biblioMenuName,
                        cacheFieldName: 'biblio',
                        filterDict: lemmaFilterDict,
                        filterFunction: (tuple, containerID) => {
                            let test = get(
                                lemmaFilterDict,
                                containerID,
                                ''
                            )
                                .toLowerCase();
                            return String(tuple[1].title)
                                .toLowerCase()
                                .indexOf(test) >= 0 ||
                                String(tuple[1].abbreviation)
                                    .toLowerCase()
                                    .indexOf(test) >= 0;
                        },
                        divBuilderCallback: (tuple, containerID) => {
                            let button = document.createElement('div');
                            button.innerText = getPublicationTitleFromID(parseInt(tuple[0]));
                            button.classList.add('menu-button-value');
                            button.onclick = () => {
                                if (primary) {
                                    menuArr[menu_idx]
                                        .variants[0]
                                        .description
                                        .source_id = parseInt(tuple[0]);
                                } else {
                                    menuArr[menu_idx]
                                        .variant_tmp
                                        .description
                                        .source_id = parseInt(tuple[0]);
                                }
                                clfFilterDict[containerID] = '';
                                m.redraw();
                            }
                            return button;
                        }
                    }), m('br'), m('br'),
                    m(menuCacheButton, {
                        menu_idx: menu_idx,
                        menuName: biblioMenuName
                    })
                ]),

            // Meaning
            m(
                primary ? 'div.menu-col.lemma-variant-primary' : 'div.menu-col.lemma-variant',
                [
                    m('span', 'Meaning:'), m('br'),
                    m('textarea', {
                        style: { width: '200px' },
                        value: meaning,
                        class: 'obligatory',
                        placeholder: '*',
                        oninput: e => {
                            e.redraw = false;
                            if (primary) {
                                menuArr[menu_idx]
                                    .description
                                    .meaning = n(e.target.value);
                                menuArr[menu_idx]
                                    .variants[0]
                                    .description
                                    .meaning = n(e.target.value);
                            } else {
                                menuArr[menu_idx]
                                    .variant_tmp
                                    .description
                                    .meaning = n(e.target.value);
                            }
                        }
                    })
                ]
            ),

            // Pages
            m(
                primary ? 'div.menu-col.lemma-variant-primary' : 'div.menu-col.lemma-variant',
                [
                    m('span', 'Pages: '),
                    m('input[type=text]', {
                        value: pages,
                        oninput: e => {
                            e.redraw = false;
                            if (primary) {
                                menuArr[menu_idx]
                                    .variants[0]
                                    .description
                                    .source_pages = n(e.target.value);
                            } else {
                                menuArr[menu_idx]
                                    .variant_tmp
                                    .description
                                    .source_pages = n(e.target.value);
                            }
                        }
                    })
                ]
            ),
        ]);
    }
};

function addLemmaVariant(menu_idx) {
    menuArr[menu_idx]
        .variant_tmp
        .description
        .lemma_id = menuArr[menu_idx].id;
    menuArr[menu_idx]
        .variants
        .push(copy(menuArr[menu_idx]
            .variant_tmp));
    menuArr[menu_idx].variant_tmp = copy(
        emptyLemmaVariant
    );
}

//
// Borrowing info
//
let lemmaBorrowingInfoComponent = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx,
            // Read-only views.
            d = menuArr[menu_idx],
            descr = d.borrowing_info.description;
        return m('div.menu-row.lemma-color',
            {
                style: {
                    display: 'grid',
                    'grid-template-columns': '1fr 1fr'
                }
            },
            [
                m('div.menu-row', m('h4', {
                    style: { 'margin-bottom': '0px' }
                }, 'Borrowing info:')),
                m('div.menu-row', {
                    style: {
                        display: d.menu_switches.borrowing_info ? 'grid' : 'none',
                        'grid-template-columns': '1fr 1fr'
                    }
                },
                    [
                        m('div.menu-col', [
                            m('span', 'Source root:'),
                            m('input[type=text]', {
                                value: descr.source_root,
                                oninput: e => {
                                    e.redraw = false;
                                    menuArr[menu_idx].borrowing_info.description.source_root = e.target.value;
                                }
                            })
                        ]),
                        m('div.menu-col', [
                            m('span', 'Source meaning:'),
                            m('input[type=text]', {
                                value: descr.source_meaning,
                                oninput: e => {
                                    e.redraw = false;
                                    menuArr[menu_idx].borrowing_info.description.source_meaning = e.target.value;
                                }
                            })
                        ]),
                        m('div.menu-col', [
                            m('span', 'Contact type:'),
                            m('input[type=text]', {
                                value: descr.contact_type,
                                oninput: e => {
                                    e.redraw = false;
                                    menuArr[menu_idx].borrowing_info.description.contact_type = e.target.value;
                                }
                            })
                        ]),
                        m('div.menu-col', [
                            m('span', 'Certainty level:'), m('br'),
                            m('input[type=radio]', {
                                name: `${menu_idx}-certainty-radio`,
                                id: `${menu_idx}-certainty-radio-1`,
                                value: 1,
                                checked: descr.certainty_level === 1,
                                onclick: () => {
                                    menuArr[menu_idx]
                                    .borrowing_info
                                    .description
                                    .certainty_level = 1;
                                }
                            }),
                            m('label', { for: `${menu_idx}-certainty-radio-1` }, '1'),
                            m('input[type=radio]', {
                                name: `${menu_idx}-certainty-radio`,
                                id: `${menu_idx}-certainty-radio-2`,
                                value: 2,
                                checked: descr.certainty_level === 2,
                                onclick: () => {
                                    menuArr[menu_idx]
                                    .borrowing_info
                                    .description
                                    .certainty_level = 2;
                                }
                            }),
                            m('label', { for: `${menu_idx}-certainty-radio-1` }, '2'),
                            m('input[type=radio]', {
                                name: `${menu_idx}-certainty-radio`,
                                id: `${menu_idx}-certainty-radio-3`,
                                value: 3,
                                checked: descr.certainty_level === 3,
                                onclick: () => {
                                    menuArr[menu_idx]
                                    .borrowing_info
                                    .description
                                    .certainty_level = 3;
                                }
                            }),
                            m('label', { for: `${menu_idx}-certainty-radio-1` }, '3'),
                        ]),
                        m('div.menu-row', {
                            style: {
                                display: projectType === 'hieroglyphic' ? 'block' : 'none'
                            }
                        }, [
                            m('span', 'Number of occurrences in Hoch: '),
                            m('input[type=text]', {
                                style: { width: '50px' },
                                value: descr.hoch_n_occurrences,
                                oninput: e => {
                                    e.redraw = false;
                                    menuArr[menu_idx].borrowing_info.description.hoch_n_occurrences = e.target.value;
                                }
                            })
                        ]),
                        m('div.menu-row', [
                            m('span', 'Comments:'),
                            m('textarea', {
                                value: descr.comments,
                                oninput: e => {
                                    e.redraw = false;
                                    menuArr[menu_idx].borrowing_info.description.comments = e.target.value;
                                }
                            })
                        ]),
                        m('div.menu-row', [
                            m('input[type=button]', {
                                value: 'Remove borrowing info',
                                onclick: () => {
                                    d.menu_switches.borrowing_info = false;
                                    d.borrowing_info = copy(emptyBorrowingInfo);
                                }
                            }),
                            m('input[type=button]', {
                                value: 'Hide menu',
                                style: { 'margin-left': '5px' },
                                onclick: () => {
                                    d.menu_switches.borrowing_info = false;
                                }
                            })
                        ])
                    ]),
                m('div.menu-row.lemma-color', m('input[type=button]', {
                    value: 'Add borrowing info',
                    disabled: d.menu_switches.borrowing_info,
                    onclick: () => { d.menu_switches.borrowing_info = true; }
                })),
            ]);
    }
};

//
// Cognates
//
let lemmaCognatesComponent = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        return m('div.menu-row.lemma-color', [
            m(
                'div.menu-row',
                m(
                    'h4', { style: { 'margin-bottom': '0' } },
                    'Cognates:'
                )
            ),
            m('[', menuArr[menu_idx]
                .cognates
                .map(
                    c => m('div.menu-row', {
                        style: {
                            padding: '2px',
                            margin: '2px',
                            border: '1px dotted grey'
                        }
                    },
                        [
                            m('span.b', 'Language: '),
                            m('span', v(c.description.language)), m('br'),
                            m('span.b', 'Cognate: '),
                            m('span', v(c.description.cognate)), m('br'),
                            m('span.b', 'Meaning: '),
                            m('span', v(c.description.meaning)), m('br'),
                            m('span.b', 'Publication: '),
                            m('span', getPublicationTitleFromID(
                                c.description.publication_id
                            )), m('br'),
                            m('span.b', 'Pages: '),
                            m('span', c.description.page_n), m('br'),
                            m('span.b', 'Discussion: '),
                            m('span', c.description.discussion)
                        ]))),
            m(
                'div.menu-row',
                {
                    style: {
                        display: menuArr[menu_idx]
                            .menu_switches
                            .cognates ? 'grid' : 'none',
                        'grid-template-columns': '1fr 1fr'
                    }
                },
                [
                    m('div.menu-col.lemma-variant', [
                        m('span', 'Language: '),
                        m('input[type=text]', {
                            style: { width: '180px' },
                            value: menuArr[menu_idx]
                                .cognate_tmp
                                .description
                                .language,
                            oninput: e => {
                                e.redraw = false;
                                menuArr[menu_idx]
                                    .cognate_tmp
                                    .description
                                    .language = n(e.target.value);
                            }
                        })
                    ]),
                    m('div.menu-col.lemma-variant', [
                        m('span', 'Cognate: '),
                        m('input[type=text]', {
                            style: { width: '180px' },
                            value: menuArr[menu_idx]
                                .cognate_tmp
                                .description
                                .cognate,
                            oninput: e => {
                                e.redraw = false;
                                menuArr[menu_idx]
                                    .cognate_tmp
                                    .description
                                    .cognate = n(e.target.value);
                            }
                        })
                    ]),
                    m('div.menu-col.lemma-variant', [
                        m('span', 'Meaning: '),
                        m('input[type=text]', {
                            style: { width: '180px' },
                            value: menuArr[menu_idx]
                                .cognate_tmp
                                .description
                                .meaning,
                            oninput: e => {
                                e.redraw = false;
                                menuArr[menu_idx]
                                    .cognate_tmp
                                    .description
                                    .meaning = n(e.target.value);
                            }
                        })
                    ]),
                    m('div.menu-col.lemma-variant'),
                    m('div.menu-col.lemma-variant', [
                        m('span', 'Publication: '),
                        m('span', getPublicationTitleFromID(
                            menuArr[menu_idx]
                                .cognate_tmp
                                .description
                                .publication_id
                        )), m('br'),
                        m(menuCacheMenu, {
                            menu_idx: menu_idx,
                            menuName: 'lemma-cognate-biblio',
                            cacheFieldName: 'biblio',
                            filterDict: lemmaFilterDict,
                            filterFunction: (tuple, containerID) => {
                                let test = get(lemmaFilterDict, containerID, '')
                                    .toLowerCase();
                                return tuple[1].title.toLowerCase()
                                    .indexOf(test) >= 0 ||
                                    tuple[1].abbreviation.toLowerCase()
                                        .indexOf(test) >= 0;
                            },
                            divBuilderCallback: (tuple, containerID) => {
                                let button = document.createElement('div');
                                button.innerText = getPublicationTitleFromID(
                                    parseInt(tuple[0]));
                                button.classList.add('menu-button-value');
                                button.onclick = () => {
                                    menuArr[menu_idx]
                                        .cognate_tmp
                                        .description
                                        .publication_id = parseInt(tuple[0]);
                                    clfFilterDict[containerID] = '';
                                    m.redraw();
                                }
                                return button;
                            }
                        }),
                        m(menuCacheButton, {
                            menu_idx: menu_idx,
                            menuName: 'lemma-cognate-biblio'
                        })
                    ]),
                    m('div.menu-col.lemma-variant', [
                        m('span', 'Pages: '),
                        m('input[type=text]', {
                            style: { width: '180px' },
                            value: menuArr[menu_idx]
                                .cognate_tmp
                                .description
                                .page_n,
                            oninput: e => {
                                e.redraw = false;
                                menuArr[menu_idx]
                                    .cognate_tmp
                                    .description
                                    .page_n = n(e.target.value);
                            }
                        })
                    ]),
                    m('div.menu-row.lemma-variant', [
                        m('span', 'Discussion: '), m('br'),
                        m('textarea', {
                            style: { width: '400px' },
                            value: menuArr[menu_idx]
                                .cognate_tmp
                                .description
                                .discussion,
                            oninput: e => {
                                e.redraw = false;
                                menuArr[menu_idx]
                                    .cognate_tmp
                                    .description
                                    .discussion = n(e.target.value);
                            }
                        })
                    ])
                ]
            ),
            m(
                'div.menu-row', {
                style: {
                    display: menuArr[menu_idx]
                        .menu_switches
                        .cognates ? 'block' : 'none'
                }
            },
                [
                    m('input[type=button]', {
                        style: { width: '100px', display: 'inline-block' },
                        value: 'Add cognate'
                    }),
                    m.trust('<span>&nbsp;&nbsp;</span>'),
                    m('input[type=button]', {
                        style: { width: '100px', display: 'inline-block' },
                        value: 'Hide menu',
                        onclick: () => {
                            menuArr[menu_idx]
                                .menu_switches
                                .cognates = false;
                        }
                    })
                ]
            ),
            m(
                'div.menu-row',
                m('input[type=button]', {
                    value: 'Show cognate menu',
                    disabled: menuArr[menu_idx].menu_switches.cognates,
                    onclick: () => {
                        menuArr[menu_idx]
                        .menu_switches
                        .cognates = true;
                    }
                })
            )
        ])
    }
}