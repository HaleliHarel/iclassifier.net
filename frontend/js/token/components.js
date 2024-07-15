let tokenShowByIdComponent = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        return m('div.menu-row.menu-row-token',
            [
                m('span', 'Show token: '),
                m('input[type=text]', {
                    placeholder: 'token ID',
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
                                alert('Token IDs are positive integers.');
                            } else
                                fetchTokenInfoAndRedraw(menu_idx, menuArr[menu_idx].id_query);
                        }
                    }
                }),
                m.trust('<span>&nbsp;&nbsp;</span>'),
                m('input[type=button]', {
                    value: '<< Previous',
                    onclick: () => { showPrevious(menu_idx) }
                }),
                m('input[type=button]', {
                    value: 'Next >>',
                    onclick: () => { showNext(menu_idx) }
                })
            ])
    }
};

// Stores lemma IDs for restricting search by token
// for different menus.
let lemmaIDFilterCache = {};

let tokenSearchByMDCComponent = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        return m('div.menu-row.token-color', [
            m('span', 'Search by transcription: '),
            m(menuCacheMenu, {
                menu_idx: menu_idx,
                menuName: 'token-search-menu',
                cacheFieldName: 'tokensWithMDC',
                filterDict: tokenFilterDict,
                filterFunction: (tuple, containerID) => {
                    let test = get(tokenFilterDict, containerID, '').toLowerCase(),
                        lemmaIDString = byID(`${menu_idx}-lemma-id-filter`).value.trim();
                    if (test === '' && lemmaIDString === '')
                        return true;
                    else {
                        let regex = new RegExp(test);
                        const target = String(tuple[1].MDC).toLowerCase(),
                            targetLemmaID = String(tuple[1].lemma_id);
                        if (lemmaIDString === '')
                            return target.match(regex) !== null;
                        else
                            return target.match(regex) !== null && lemmaIDString === targetLemmaID;
                    }
                },
                divBuilderCallback: (tuple, containerID) => {
                    let button = document.createElement('div');
                    button.innerHTML = `${tuple[0]}: ${tuple[1].MDC}${getWitnessNameAndCoords(tuple[1].witness_id, tuple[1].coordinates_in_witness)}`;
                    button.classList.add('menu-button-value');
                    // A special font for ancient kanji
                    if (projectTag === 'guodianimported') {
                        button.classList.add('guodian');
                    }
                    button.onclick = () => {
                        clfFilterDict[containerID] = '';
                        fetchTokenInfoAndRedraw(menu_idx, tuple[0]);
                    }
                    return button;
                }
            }),
            m(menuCacheButton, {
                menu_idx: menu_idx,
                menuName: 'token-search-menu'
            }),
            m('br'), m('br'),
            m('Span', 'Restrict by lemma number: '),
            m('input[type=text]', {
                value: lemmaIDFilterCache[menu_idx] === undefined ? '' : lemmaIDFilterCache[menu_idx],
                oninput: e => {
                    e.redraw = false;
                    lemmaIDFilterCache[menu_idx] = e.target.value;
                },
                id: `${menu_idx}-lemma-id-filter`,
                style: { width: '80px' }
            }),
            m('br'),
            m('span', 'Click on the "Filter the list" field to refresh the list after selecting a new lemma.')
        ])
    }
};

let tokenPrevNextSameLemmaComponent = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        return m('div.menu-row.token-color', [
            m('input[type=button]', {
                value: '<< Previous token (same lemma)',
                onclick: () => {
                    tokenShowNextPreviousSameLemma(
                        menu_idx, tokenShowPreviousSameLemmaCallback)
                }
            }),
            m('input[type=button]', {
                value: 'Next token (same lemma) >>',
                onclick: () => {
                    tokenShowNextPreviousSameLemma(
                        menu_idx, tokenShowNextSameLemmaCallback)
                }
            })
        ]);
    }
}

let tokenTypeComponent = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        return m('div.menu-col.menu-col-token', [
            m('span', 'Token type:'),
            m('form', [
                m('input[type=radio]', {
                    id: `token-type-simple-${menu_idx}`,
                    name: 'token-type-${menu_idx}',
                    checked: menuArr[menu_idx].type === 'simple',
                    onclick: () => {
                        menuArr[menu_idx].type = 'simple';
                        menuArr[menu_idx].compound_elements = [];
                        menuArr[menu_idx].description.compound_id = null;
                    }
                }),
                m('label', { for: 'token-type-simple' }, 'Simple token'),
                m('br'),
                m('input[type=radio]', {
                    id: `token-type-part-${menu_idx}`,
                    name: 'token-type-${menu_idx}',
                    checked: menuArr[menu_idx].type === 'part',
                    onclick: () => {
                        menuArr[menu_idx].type = 'part';
                        menuArr[menu_idx].compound_elements = [];
                    }
                }),
                m('label', { for: 'token-type-part' }, 'Part of a compound'),
                m('br'),
                m('input[type=radio]', {
                    id: `token-type-compound-${menu_idx}`,
                    name: 'token-type-${menu_idx}',
                    checked: menuArr[menu_idx].type === 'compound',
                    onclick: () => {
                        menuArr[menu_idx].type = 'compound';
                        menuArr[menu_idx].description.compound_id = null;
                    }
                }),
                m('label', { for: 'token-type-compound' }, 'Compound token')
            ]),
            m(compoundIDSelect, { menu_idx: menu_idx }),
            m(compoundElementIDSelect, { menu_idx: menu_idx })
        ])
    }
};

function showPrevious(menu_idx) {
    showPreviousAbstract(menu_idx, tokenIDs, fetchTokenInfoAndRedraw);
}

function showNext(menu_idx) {
    showNextAbstract(menu_idx, tokenIDs, fetchTokenInfoAndRedraw);
}

/**
 * Prepares the data for actually showing the
 * previous or next token.
 */
function tokenShowNextPreviousSameLemma(menu_idx, callback) {
    const tokenID = menuArr[menu_idx].id,
        lemmaID = menuArr[menu_idx].description.lemma_id;
    if (tokenID === null || tokenID === undefined ||
        lemmaID === null || lemmaID === undefined)
        return;
    const tokensForLemma = tokensByLemmaID[lemmaID],
        currentTokenIdx = tokensForLemma.indexOf(tokenID);
    if (tokensForLemma.length === 1)
        return;
    callback(menu_idx, tokensForLemma, currentTokenIdx);
}

function tokenShowPreviousSameLemmaCallback(
    menu_idx,
    tokensForLemma,
    currentTokenIdx) {
    if (currentTokenIdx === 0)
        fetchTokenInfoAndRedraw(
            menu_idx,
            tokensForLemma[tokensForLemma.length - 1]
        );
    else
        fetchTokenInfoAndRedraw(
            menu_idx,
            tokensForLemma[currentTokenIdx - 1]
        );
}

function tokenShowNextSameLemmaCallback(
    menu_idx,
    tokensForLemma,
    currentTokenIdx) {
    if (currentTokenIdx === tokensForLemma.length - 1)
        fetchTokenInfoAndRedraw(
            menu_idx,
            tokensForLemma[0]
        );
    else
        fetchTokenInfoAndRedraw(
            menu_idx,
            tokensForLemma[currentTokenIdx + 1]
        );
}

function getDescrInputField(menu_idx, fieldName, callback) {
    let classString = projectType,
        obligatory = false;
    if (fieldName === 'mdc' || fieldName === 'mdc_w_markup' || fieldName === 'transliteration') {
        let classStringPrefix = projectType;
        // Special font for early Chinese characters
        if (projectTag === 'guodianimported') {
            classStringPrefix = 'guodian';
        }
        classString = `${classStringPrefix} obligatory`;
        obligatory = true;
    }
    return m('input[type=text]', {
        placeholder: obligatory ? '*' : '',
        class: classString,
        value: menuArr[menu_idx].description[fieldName],
        oninput: (e) => {
            e.redraw = false;
            menuArr[menu_idx].description[fieldName] = e.target.value === '' ? null : e.target.value;
            // Give the user time to finish typing.
            clearTimeout(typingTimeout);
            if (callback !== undefined)
                typingTimeout = setTimeout(() => {
                    callback();
                }, 3000);
        }
    })
}

//
// Entity lists
//
let lemmaButton = getListButton('lemma', fetchLemmasAndRedraw),
    supertextButton = getListButton('supertext', fetchSupertextsAndRedraw),
    witnessButton = getListButton('witness', fetchWitnessesAndRedraw);

function lemmaFilter(value, menu_idx) {
    return txt(value[1]['transliteration'])
        .toLowerCase()
        .indexOf(
            menuArr[menu_idx].menu_data[`lemma_filter`]
                .toLowerCase()
        ) >= 0 ||
        txt(value[1]['meaning'])
            .toLowerCase()
            .indexOf(
                menuArr[menu_idx].menu_data[`lemma_filter`].toLowerCase()
            ) >= 0;
}

function lemmaSpanBuilderFactory(menu_idx) {
    return (value) => m(
        'span.list-element',
        {
            class: projectType,
            onclick: () => {
                menuArr[menu_idx].description.lemma_id = parseInt(value[0]);
                menuArr[menu_idx].lemma_info = value[1]['transliteration'];
            }
        },
        value[1]['transliteration'] + ' (' + value[1]['meaning'] + ')'
    );
}

function supertextFilter(value, menu_idx) {
    return value[1]['text_name']
        .toLowerCase()
        .indexOf(
            menuArr[menu_idx].menu_data['supertext_filter']
                .toLowerCase()
        ) >= 0
}

function supertextSpanBuilderFactory(menu_idx) {
    return (value) => m(
        'span.list-element',
        {
            onclick: () => {
                menuArr[menu_idx].description.supertext_id = parseInt(value[0]);
                menuArr[menu_idx].supertext_name = value[1]['text_name'];
            }
        },
        value[1]['text_name']
    );
}

function witnessFilter(value, menu_idx) {
    return value[1]['name']
        .toLowerCase()
        .indexOf(
            menuArr[menu_idx].menu_data['witness_filter']
                .toLowerCase()
        ) >= 0
}

function witnessSpanBuilderFactory(menu_idx) {
    return (value) => m(
        'span.list-element',
        {
            class: projectType,
            onclick: () => {
                menuArr[menu_idx].description.witness_id = parseInt(value[0]);
                menuArr[menu_idx].witness_name = value[1].name;
            }
        },
        value[1].name
    );
}

let lemmaChoiceComponent = createListChoiceComponent(
    'lemma',
    lemmaFilter,
    lemmaSpanBuilderFactory),
    supertextChoiceComponent = createListChoiceComponent(
        'supertext',
        supertextFilter,
        supertextSpanBuilderFactory),
    witnessChoiceComponent = createListChoiceComponent(
        'witness',
        witnessFilter,
        witnessSpanBuilderFactory);

//
// Compound handling
//
let compoundIDSelect = {
    view: (vnode) => {
        let menu_idx = vnode.attrs.menu_idx;
        return m('div',
            {
                style: {
                    display: menuArr[menu_idx].type === 'part' ? 'block' : 'none',
                    'margin-top': '10px'
                }
            },
            [
                m('span', 'ID of the compound this token belongs to: '),
                m('input[type=text]', {
                    value: menuArr[menu_idx].description.compound_id,
                    oninput: (e) => {
                        e.redraw = false;
                        menuArr[menu_idx].description.compound_id = e.target.value === '' ? null : e.target.value;
                    }
                })])
    }
};

let compoundElementIDSelect = {
    view: (vnode) => {
        let menu_idx = vnode.attrs.menu_idx;
        return m('div',
            {
                style: {
                    display: menuArr[menu_idx].type === 'compound' ? 'block' : 'none',
                    'margin-top': '10px'
                }
            },
            [
                m('span', 'Tokens in this compound (add ID’s of the compound one by one): '),
                m(compoundIDInput, { menu_idx: menu_idx }),
                m(compoundIDDisplay, { menu_idx: menu_idx })
            ])
    }
};

let compoundIDInput = {
    view: (vnode) => {
        let menu_idx = vnode.attrs.menu_idx;
        const inputID = `new-compound-element-${menu_idx}`;
        return m('div', [
            m('input[type=text]', { id: inputID }),
            m('input[type=button]', {
                value: 'Add token',
                onclick: () => {
                    let newCompoundID = document.getElementById(inputID).value;
                    if (newCompoundID.match(/^[1-9]\d*$/) === null) {
                        alert('Part IDs must be positive integers!');
                        return;
                    }
                    newCompoundID = parseInt(newCompoundID);
                    if (menuArr[menu_idx].compound_elements.indexOf(newCompoundID) >= 0) {
                        alert('Part IDs must be distinct!');
                        return;
                    }
                    menuArr[menu_idx].compound_elements.push(newCompoundID);
                }
            })])
    }
};

let compoundIDDisplay = {
    view: (vnode) => {
        let menu_idx = vnode.attrs.menu_idx,
            partIDs = menuArr[menu_idx].compound_elements.map((partID, idx) => {
                return m(
                    'div',
                    {
                        style: {
                            border: '1px dashed gray',
                            padding: '2px',
                            margin: '2px',
                            display: 'inline-block'
                        }
                    },
                    [
                        m('span', partID),
                        m('input[type=button]', {
                            style: { 'margin-left': '5px' },
                            value: 'Remove',
                            onclick: () => { menuArr[menu_idx].compound_elements = drop(menuArr[menu_idx].compound_elements, idx) }
                        })])
            });
        return m('div', partIDs);
    }
};

let tokenMDCWMarkupComponent = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        return m('div.menu-col.menu-col-token', [
            m('span', getMDCWMarkupFieldName(menu_idx)),
            getDescrInputField(menu_idx, 'mdc_w_markup'),
            m('input[type=button]', {
                value: 'Copy unmarked',
                onclick: () => { menuArr[menu_idx].description.mdc_w_markup = menuArr[menu_idx].description.mdc }
            }),
            m('input[type=button]', {
                value: 'Refresh classifiers',
                onclick: () => {
                    let refreshClfs = true;
                    if (menuArr[menu_idx].clfParses.length !== 0)
                        refreshClfs = confirm('This will overwrite the existing analyses. Are you sure?');
                    if (refreshClfs)
                        createClfParses(menu_idx);
                }
            }),
        ]
        )
    }
};

let tokenTransliterationComponent = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        return m(
            'div.menu-col.menu-col-token',
            // {style: {visibility: transliterationNeeded()}},
            [
                m('span', projectType === 'chinese' ? 'Pinyin: ' : 'Transliteration: '),
                getDescrInputField(menu_idx, 'transliteration'),
                m('input[type=button]', {
                    value: 'Convert to Unicode',
                    onclick: () => {
                        menuArr[menu_idx].description.transliteration = convertToUnicode(
                            menuArr[menu_idx].description.transliteration
                        );
                    },
                    style: { visibility: projectType === 'hieroglyphic' ? 'visible' : 'hidden' }
                })]
        )
    }
};

let tokenClassificationStatusComponent = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        return m('div.menu-col.menu-col-token', [
            m('span', 'Classification status:'),
            m('form', [
                m('input[type=radio]', {
                    id: `clf-status-cl-${menu_idx}`,
                    name: 'clf-status-${menu_idx}',
                    checked: menuArr[menu_idx].description.classification_status === 'CL',
                    onclick: () => {
                        menuArr[menu_idx].description.classification_status = 'CL'
                    }
                }),
                m('label', { for: `clf-status-cl-${menu_idx}` }, 'Classified'),
                m('br'),
                m('input[type=radio]', {
                    id: `clf-status-nc-${menu_idx}`,
                    name: 'clf-status-${menu_idx}',
                    checked: menuArr[menu_idx].description.classification_status === 'NC',
                    onclick: () => {
                        menuArr[menu_idx].description.classification_status = 'NC'
                    }
                }),
                m('label', { for: `clf-status-nc-${menu_idx}` }, 'Not classified'),
                m('br'),
                m('input[type=radio]', {
                    id: `clf-status-nr-${menu_idx}`,
                    name: 'clf-status-${menu_idx}',
                    checked: menuArr[menu_idx].description.classification_status === 'NR',
                    onclick: () => {
                        menuArr[menu_idx].description.classification_status = 'NR'
                    }
                }),
                m('label', { for: `clf-status-nr-${menu_idx}` }, 'Not preserved'),
            ])
        ]);
    }
}

//
// Token pictures
//
let tokenPictureComponent = {
    view: (vnode) => {
        const menu_idx = vnode.attrs.menu_idx;

        return m('div.menu-row.menu-row-token',
            menuArr[menu_idx].token_pictures
                .map(tokenPicDivBuilderFactory(menu_idx))
                .concat(
                    [m('button',
                        { onclick: () => { addTokenPicture(menu_idx) }, style: { 'border-radius': '5px' } },
                        'Add a token picture')]));
    }
};

function tokenPicDivBuilderFactory(menu_idx) {
    return (tokenPicInfo, idx) => m('div', { style: { margin: '5px', 'margin-bottom': '10px' } }, [
        m('span', 'Title: '),
        m('input[type=text]', {
            value: tokenPicInfo.title,
            class: projectType,
            oninput: (e) => {
                e.redraw = false;
                menuArr[menu_idx].token_pictures[idx].title = e.target.value === '' ? null : e.target.value;
            }
        }),
        m('br'),
        // TODO: make sure the size if appropriate
        m('div', {
            style: {
                width: '450px',
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                'margin': '10px',
                'margin-bottom': '5px',
                'margin-left': '0'
            }
        },
            m('img', { style: { 'max-width': '400px' }, src: tokenPicInfo.base64 })),
        m('span', 'Comments: '),
        m('br'),
        m('textarea', {
            value: tokenPicInfo.comments,
            class: projectType,
            style: { 'margin-bottom': '5px' },
            rows: 4,
            oninput: (e) => {
                e.redraw = false;
                menuArr[menu_idx].token_pictures[idx].comments = e.target.value === '' ? null : e.target.value;
            }
        }),
        m('br'),
        m('input[type=button]', { value: 'Show in context', onclick: () => { showTokenPicInContext(menu_idx, idx) } }),
        m('input[type=button]', {
            value: 'Remove picture', onclick: () => {
                menuArr[menu_idx].token_pictures = menuArr[menu_idx].token_pictures
                    .slice(0, idx)
                    .concat(menuArr[menu_idx].token_pictures.slice(idx + 1));
            }
        })
    ]);
}

//
// Classifier parses
//
let clfParses = {
    view: (vnode) => {
        let menu_idx = vnode.attrs.menu_idx;
        let classifierComponents = [];
        for (let i = 0; i < menuArr[menu_idx].clfParses.length; i++) {
            classifierComponents.push(m(createClassifierComponent(i, menu_idx)));
        }
        let contents = [m('h4', { style: { 'margin-top': '0' } }, 'Classifiers:')];
        return m('div#clf-parses', contents.concat(classifierComponents));
    }
};

function createClassifierComponent(idx, menu_idx) {
    return {
        view: () => {
            // Register a callback to show the hieroglyphs.
            showClfHiero(idx, menu_idx);
            return m('div.classifier-parse', [
                m('div.clf-col', m('img', { src: menuArr[menu_idx].clfParses[idx].img_src })),
                m('div.clf-col', [
                    m('p',
                        { style: { 'margin-top': '0' } },
                        'Classifier: ' + menuArr[menu_idx].clfParses[idx].description.gardiner_number),
                    m('button', {
                        onclick: () => {
                            addClassifierPicture(menu_idx, idx);
                        },
                        style: { 'border-radius': '5px' }
                    },
                        'Add a classifier picture')
                ]),
                m(clfPicsRow, { idx: idx, menu_idx: menu_idx }),
                m('div.clf-col', [
                    m('span', 'Information types: '),
                    m('br'),
                    getLevelRadio(1, menu_idx, idx),
                    m('label', { for: `clf-level-1-${idx}-${menu_idx}` }, 'Semantic (encyclopedic)'),
                    m('br'),
                    getLevelRadio(2, menu_idx, idx),
                    m('label', { for: `clf-level-2-${idx}-${menu_idx}` }, 'Semantic (pragmatic)'),
                    m('br'),
                    getLevelRadio(3, menu_idx, idx),
                    m('label', { for: `clf-level-3-${idx}-${menu_idx}` }, 'Grammatical'),
                    m('br'),
                    getLevelRadio(4, menu_idx, idx),
                    m('label', { for: `clf-level-4-${idx}-${menu_idx}` }, 'Metatextual'),
                    m('br'),
                    m('br'),
                    getLevelRadio(5, menu_idx, idx),
                    m('label', {
                        for: `clf-level-5-${idx}-${menu_idx}`,
                        style: { 'font-weight': 'bold' }
                    }, 'Phonetic 🔊')
                ]),
                m('div.clf-col', [
                    m('span', 'Classifier-host relations: '),
                    getTypeCheckbox('taxonomic', 'Taxonomic', idx, menu_idx),
                    getTypeCheckbox('taxonomic_repeater', 'Taxonomic repeater', idx, menu_idx),
                    getTypeCheckbox('taxonomic_metaphoric', 'Taxonomic metaphoric', idx, menu_idx),
                    getTypeCheckbox('schematic', 'Schematic', idx, menu_idx),
                    getTypeUnclearCheckbox(idx, menu_idx)
                ]),
                m('div.clf-col', [
                    m('span', 'Semantic role relations: '),
                    m('br'),
                    m('select', {
                        value: menuArr[menu_idx].clfParses[idx].description.semantic_relation === null ?
                            '---' : menuArr[menu_idx].clfParses[idx].description.semantic_relation,
                        onchange: (e) => { menuArr[menu_idx].clfParses[idx].description.semantic_relation = e.target.value }
                    },
                        [
                            getSemRelOpt('---', '---', true),
                            getSemRelOpt('experiencer', 'Experiencer'),
                            getSemRelOpt('patient', 'Patient'),
                            getSemRelOpt('instrument', 'Instrument'),
                            getSemRelOpt('source', 'Source'),
                            getSemRelOpt('goal', 'Goal'),
                            getSemRelOpt('location', 'Location'),
                            getSemRelOpt('mover', 'Mover'),
                            getSemRelOpt('zero', 'Zero'),
                            getSemRelOpt('causee', 'Causee'),
                            getSemRelOpt('absenthee', 'Absenthee'),
                            getSemRelOpt('other', 'Other'),
                        ])
                ]),
                m('div.clf-row', [
                    m('span', 'Classifier comments: '),
                    m('br'),
                    m('textarea', {
                        class: projectType,
                        rows: 4,
                        value: menuArr[menu_idx].clfParses[idx].description.comments,
                        oninput: (e) => {
                            e.redraw = false;
                            menuArr[menu_idx].clfParses[idx].description.comments = e.target.value === '' ? null : e.target.value;
                        }
                    })
                ])
            ]);
        }
    }
}

function getSemRelOpt(value, label, disabled = false) {
    if (disabled)
        return m('option', { value: value, disabled: true }, label);
    else
        return m('option', { value: value }, label);
}

function getLevelRadio(level, menu_idx, idx) {
    return m('input[type=radio]', {
        id: `clf-level-${level}-${idx}-${menu_idx}`,
        name: `clf-level-${idx}-${menu_idx}`,
        checked: menuArr[menu_idx].clfParses[idx].description.clf_level === level,
        onclick: (e) => {
            e.redraw = false;
            menuArr[menu_idx].clfParses[idx].description.clf_level = level;
        }
    });
}

function getTypeCheckbox(type, label, idx, menu_idx) {
    const checkboxID = 'clf-' + type + '-' + idx;
    let mLabel = m('label', { for: checkboxID }, label),
        clickHandler = (e) => {
            const isChecked = e.target.checked;
            if (isChecked)
                clfTypeAdd(type, idx, menu_idx);
            else
                clfTypeRemove(type, idx, menu_idx);
        };
    if (clfTypeHas('unclear', idx, menu_idx))
        return m('div', [
            m('input[type=checkbox]', {
                id: checkboxID,
                checked: clfTypeHas(type, idx, menu_idx),
                disabled: true,
                onclick: clickHandler
            }),
            mLabel
        ]);
    else {
        return m('div', [
            m('input[type=checkbox]', {
                id: checkboxID,
                checked: clfTypeHas(type, idx, menu_idx),
                onclick: clickHandler
            }),
            mLabel
        ]);
    }
}

function getTypeUnclearCheckbox(idx, menu_idx) {
    const checkboxID = 'clf-unclear-' + idx;
    let mLabel = m('label', { for: checkboxID }, 'Unclear');
    return m('div', [
        m('input[type=checkbox]', {
            id: checkboxID,
            checked: clfTypeHas('unclear', idx, menu_idx),
            onclick: (e) => {
                const isChecked = e.target.checked;
                if (isChecked)
                    menuArr[menu_idx].clfParses[idx].description.clf_type = 'unclear';
                else
                    menuArr[menu_idx].clfParses[idx].description.clf_type = null;
            }
        }),
        mLabel
    ]);
}

function getLevelCheckbox(level, label, idx, menu_idx) {
    const checkboxID = 'clf-level-' + level + '-' + idx;
    let mLabel = m('label', {
        for: checkboxID,
        style: {
            'font-weight': label === 'Phonetic 🔊' ? 'bold' : 'normal'
        },
    }, label),
        clickHandler = (e) => {
            const isChecked = e.target.checked;
            if (isChecked)
                clfLevelAdd(level, idx, menu_idx);
            else
                clfLevelRemove(level, idx, menu_idx);
        };
    return m('div', [
        m('input[type=checkbox]', {
            id: checkboxID,
            checked: clfLevelHas(level, idx, menu_idx),
            onclick: clickHandler
        }),
        mLabel
    ]);
}

function clfTypeHas(type, idx, menu_idx) {
    let clfTypeStr = menuArr[menu_idx].clfParses[idx].description.clf_type;
    if (clfTypeStr === null || clfTypeStr === '')
        return false;
    let clfTypes = clfTypeStr.split(';');
    for (const clfType of clfTypes)
        if (clfType === type) {
            return true;
        }
    return false;
}

function clfTypeAdd(type, idx, menu_idx) {
    let clfTypeStr = menuArr[menu_idx].clfParses[idx].description.clf_type;
    if (clfTypeStr === null || clfTypeStr === '') {
        menuArr[menu_idx].clfParses[idx].description.clf_type = type;
    }
    else {
        let clfTypes = clfTypeStr.split(';');
        clfTypes.push(type);
        clfTypes.sort();
        menuArr[menu_idx].clfParses[idx].description.clf_type = clfTypes.join(';');
    }
}

function clfTypeRemove(type, idx, menu_idx) {
    let clfTypeStr = menuArr[menu_idx].clfParses[idx].description.clf_type;
    if (clfTypeStr !== null) {
        let clfTypes = clfTypeStr.split(';'),
            newTypes = [];
        for (const t of clfTypes)
            if (t !== type)
                newTypes.push(t);
        newTypes.sort();
        if (newTypes.length === 0)
            menuArr[menu_idx].clfParses[idx].description.clf_type = null;
        else
            menuArr[menu_idx].clfParses[idx].description.clf_type = newTypes.join(';');
    }
}

function clfLevelHas(level, idx, menu_idx) {
    let clfLevelStr = String(menuArr[menu_idx].clfParses[idx].description.clf_level);
    if (clfLevelStr === null || clfLevelStr === '')
        return false;
    let clfLevels = clfLevelStr.split(';');
    for (const clfLevel of clfLevels)
        if (clfLevel === level) {
            return true;
        }
    return false;
}

function clfLevelAdd(level, idx, menu_idx) {
    let clfLevelStr = String(menuArr[menu_idx].clfParses[idx].description.clf_level);
    if (clfLevelStr === null || clfLevelStr === '') {
        menuArr[menu_idx].clfParses[idx].description.clf_level = level;
    } else {
        let clfLevels = clfLevelStr.split(';');
        clfLevels.push(level);
        clfLevels.sort();
        menuArr[menu_idx].clfParses[idx].description.clf_level = clfLevels.join(';');
    }
}

function clfLevelRemove(level, idx, menu_idx) {
    let clfLevelStr = String(menuArr[menu_idx].clfParses[idx].description.clf_level);
    if (clfLevelStr !== null) {
        let clfLevels = clfLevelStr.split(';'),
            newLevels = [];
        for (const l of clfLevels)
            if (l !== level)
                newLevels.push(l);
        newLevels.sort();
        if (newLevels.length === 0)
            menuArr[menu_idx].clfParses[idx].description.clf_level = null;
        else
            menuArr[menu_idx].clfParses[idx].description.clf_level = newLevels.join(';');
    }
}

let clfPicsRow = {
    view: (vnode) => {
        const idx = vnode.attrs.idx,
            menu_idx = vnode.attrs.menu_idx;
        if (menuArr[menu_idx]
            .clfParses[idx]
            .pictures
            .length === 0
        ) {
            return m('div.clf-pics-row', { style: { display: 'none' } });
        } else {
            let picDivs = menuArr[menu_idx]
                .clfParses[idx]
                .pictures
                .map(getClfPicDivGenerator(menu_idx, idx));
            return m('div.clf-pics-row', { style: { 'max-width': '100%' } }, picDivs);
        }
    }
};

function getClfPicDivGenerator(menu_idx, idx) {
    return (clfPicInfo, clfPicIdx) => m('div.clf-pic', [
        m('img.clf-pic', { src: clfPicInfo.base64 }),
        m('br'),
        m('input[type=button]', {
            value: 'Remove picture',
            onclick: () => {
                menuArr[menu_idx].clfParses[idx].pictures =
                    menuArr[menu_idx].clfParses[idx].pictures
                        .slice(0, clfPicIdx)
                        .concat(menuArr[menu_idx].clfParses[idx].pictures
                            .slice(clfPicIdx + 1))
            }
        }),
        m('br'),
        m('input[type=button]', {
            value: 'Show in context',
            onclick: () => {
                showPicInContextData.base64 = witnessPicDict[clfPicInfo.witness_picture_id].base64;
                showPicInContextData.coords = clfPicInfo.coords;
                show_in_context_overlay = true;
            }
        }),
        m('br'),
        m('textarea', {
            placeholder: 'Comments',
            style: { width: '150px' },
            value: menuArr[menu_idx].clfParses[idx].pictures[clfPicIdx].comments,
            oninput: (e) => {
                e.redraw = false;
                menuArr[
                    menu_idx
                ].clfParses[
                    idx
                ].pictures[
                    clfPicIdx
                ].comments = e.target.value === '' ? null : e.target.value;
            }
        }
        )
    ]);
}

//
// Bibliographical references
//
let biblioReferences = {
    view: (vnode) => {
        let menu_idx = vnode.attrs.menu_idx;
        return m('div.biblio-references.token-color', [
            [m('h4', { style: { 'margin-top': '0', 'margin-bottom': '5px' } },
                'Bibliographical references:')]
                .concat(
                    menuArr[menu_idx].biblio_refs
                        .map(biblioComponentBuilderFactory(menu_idx))
                        .concat([
                            m('div.biblio-details.menu-row.menu-row-token', {
                                style: { display: menuArr[menu_idx].menu_switches.biblio ? 'grid' : 'none' }
                            },
                                [
                                    m(biblioDetailsComponent, { menu_idx: menu_idx }),
                                    m(biblioChoiceComponent, { menu_idx: menu_idx })
                                ]),
                            m('br'),
                            m('input[type=button]', {
                                style: {
                                    'grid-column': '1/2',
                                    'margin-top': '3px'
                                },
                                disabled: menuArr[menu_idx].menu_switches.biblio,
                                value: 'Add a bibliographical reference',
                                onclick: () => { addBiblioRef(menu_idx) }
                            })
                        ]))
        ]);
    }
};

function biblioComponentBuilderFactory(menu_idx) {
    return (biblioInfo, idx) => m('div.biblio-ref', [
        m('span', { style: { 'font-weight': 'bold' } }, 'Publication: '),
        m('span', biblioInfo.source_name),
        m('br'),
        m('span', { style: { 'font-weight': 'bold' } }, 'Pages: '),
        m('span', biblioInfo.pages),
        m('br'),
        m('span', { style: { 'font-weight': 'bold' } }, 'Comment: '),
        m('span', biblioInfo.comments),
        m('br'),
        m('div', { style: { display: 'flex', 'justify-content': 'flex-end' } },
            m('input[type=button]', {
                value: 'Remove reference',
                onclick: () => {
                    menuArr[menu_idx].biblio_refs = menuArr[menu_idx].biblio_refs.slice(0, idx)
                        .concat(menuArr[menu_idx].biblio_refs.slice(idx + 1));
                }
            }))
    ]);
}

let biblioDetailsComponent = {
    view: (vnode) => {
        let menu_idx = vnode.attrs.menu_idx,
            tmp = menuArr[menu_idx].biblio_tmp,
            pubTitle;
        // If tmp is null, this div won't be visible.
        if (tmp === null)
            return m('div');
        if (tmp.source_abbrev !== null)
            pubTitle = tmp.source_abbrev;
        else if (tmp.source_name !== null)
            pubTitle = tmp.source_name;
        else
            pubTitle = '';

        return m('div.menu-row.biblio-details', [
            m('div', { style: { 'grid-column': '1/2' } },
                m('span', { class: projectType }, `Publication: ${pubTitle}`)),
            m('div', { style: { 'grid-column': '2/3' } }, [
                m('span', 'Pages: '),
                m('input[type=text]', {
                    class: projectType,
                    style: { width: '100px' },
                    oninput: (e) => {
                        e.redraw = false;
                        tmp.pages = e.target.value === '' ? null : e.target.value;
                    }
                })
            ]),
            m('div', { style: { 'grid-column': '1/3' } }, [
                m('span', 'Comments: '),
                m('textarea', {
                    class: projectType,
                    rows: 5,
                    oninput: (e) => {
                        e.redraw = false;
                        tmp.comments = e.target.value === '' ? null : e.target.value;
                    }
                })
            ]),
            m('div', { style: { 'grid-column': '1/2' } }, m('input[type=button]', {
                value: 'Add reference',
                onclick: () => { validateAndAddReference(tmp, menu_idx) }
            }))
        ]);
    }
};

function validateAndAddReference(tmp, menu_idx) {
    if (tmp.source_id === null) {
        alert('A publication must be selected.');
        return;
    }
    menuArr[menu_idx].biblio_refs.push(JSON.parse(JSON.stringify(tmp)))
}

function addBiblioRef(menu_idx) {
    menuArr[menu_idx].biblio_tmp = copy(emptyBiblioRef);
    menuArr[menu_idx].menu_switches.biblio = true;
    fetchBiblioAndRedraw(menu_idx);
}

//
// Customisation of components based on project type
//

function getMDCFieldName(menu_idx) {
    if (projectTypeArray[menu_idx] === 'hieroglyphic')
        return 'MDC: ';
    else
        return 'Token: ';
}

function getMDCWMarkupFieldName(menu_idx) {
    if (projectTypeArray[menu_idx] === 'hieroglyphic')
        return 'MDC with markup: ';
    else
        return 'Token with markup: ';
}

let witnessNameCache = {};

function populateWitnessNameCache() {
    witnessNameCache = {};
    if (JSON.stringify(witnessNameCache) === JSON.stringify({})) {
        for (const tuple of menu_data_cache.witness) {
            witnessNameCache[tuple[0]] = tuple[1].name;
        }
    }
}

/**
 * Returns as much information as possible
 */
function getWitnessNameAndCoords(witnessId, coordinatesInWitness) {
    if (witnessId === null || witnessId === undefined || String(witnessId).trim() === '')
        return '';

    let witnessName;
    if (!witnessNameCache.hasOwnProperty(witnessId)) {
        witnessName = 'Unknown witness';
    } else {
        witnessName = witnessNameCache[witnessId];
    }

    if (coordinatesInWitness === null || coordinatesInWitness === undefined || String(coordinatesInWitness).trim() === '') {
        // Only return the witness name
        return `<span style="color: grey;"> (${witnessName})</span>`;
    } else {
        return `<span style="color: grey;"> (${witnessName}, ${coordinatesInWitness})</span>`;
    }
}