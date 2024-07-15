let tokenFilterDict = {};

// A debug function to display and record each update.
// let last_state_str_arr = null;
// function showUpdate() {
//     if (last_state_str_arr === null)
//         return;
//     const state_string = JSON.stringify(menuArr[0], undefined, 2),
//         state_string_arr = state_string.split('\n');
//     for (let i = 0; i < state_string_arr.length; i++)
//         if (last_state_str_arr[i] !== state_string_arr[i]) {
//             console.log(last_state_str_arr[i], ' -> ', state_string_arr[i]);
//             last_state_str_arr[i] = state_string_arr[i];
//         }
// }

let menu = {
    view: (vnode) => {
        let menu_idx = vnode.attrs.menu_idx;
        return m(
            'div.menu',
            [
                m(killButton, { menu_idx: menu_idx }),
                m(tokenShowByIdComponent, { menu_idx: menu_idx }),
                m(tokenSearchByMDCComponent, { menu_idx: menu_idx }),
                m(tokenPrevNextSameLemmaComponent, { menu_idx: menu_idx }),

                // Token ID
                m('div.menu-row.menu-row-token', [
                    m('span', { style: { 'font-weight': 'bold' } }, 'Token ID: '),
                    m('span', txt(menuArr[menu_idx].id))
                ]),

                // Admin comments: when present
                m('div.menu-row.token-color', {
                    style: {
                        display: menuArr[menu_idx].admin_comments.length !== null &&
                            menuArr[menu_idx].admin_comments.length > 0 ? 'block' : 'none'
                    }
                }, [
                    m('h4', { style: { 'margin-bottom': '0', color: 'red' } }, 'Admin comments:'),
                    ...menuArr[menu_idx].admin_comments.map(commentDict => m('div', {
                        style: { border: '1px dotted darkgrey', 'margin-bottom': '5px', padding: '5px' }
                    }, [
                        m('span.b', 'User: '),
                        m('span', commentDict.username),
                        m('span.b', { style: { 'margin-left': '10px' } }, 'Comment: '),
                        m('span', commentDict.comment)
                    ]))
                ]),

                // Jsesh visualisation
                m('div.menu-row.menu-row-token',
                    {
                        style: {
                            display: menuArr[menu_idx].img_src === '' ? 'none' : 'block',
                        }
                    }, m('img', {
                        id: `jsesh-${menu_idx}`,
                        src: menuArr[menu_idx].img_src
                    })),

                // Lemma
                m('div.menu-col.menu-col-token', [
                    m('span', 'Lemma: '),
                    m('span', { style: { color: 'red' } }, '*'),
                    m('span', { class: projectType }, menuArr[menu_idx].lemma_info),
                    m('br'),
                    m(lemmaButton, { menu_idx: menu_idx })
                ]),

                // Token type
                m(tokenTypeComponent, { menu_idx: menu_idx }),

                // Lemma-choice menu; invisible by default
                m('div.menu-row.menu-row-token', { style: { display: menuArr[menu_idx].menu_switches.lemma === true ? 'grid' : 'none' } },
                    m(lemmaChoiceComponent, { menu_idx: menu_idx })),

                // Supertext
                m('div.menu-col.menu-col-token', [
                    m('span', 'Supertext: '),
                    m('span', menuArr[menu_idx].supertext_name),
                    m('br'), m(supertextButton, { menu_idx: menu_idx })
                ]),

                // Supertext coordinates
                m('div.menu-col.menu-col-token', [
                    m('span', 'Coordinates in the supertext: '),
                    getDescrInputField(menu_idx, 'coordinates_in_txt')
                ]),

                // Supertext-choice menu; invisible by default
                m('div.menu-row.menu-row-token', { style: { display: menuArr[menu_idx].menu_switches.supertext === true ? 'grid' : 'none' } },
                    m(supertextChoiceComponent, { menu_idx: menu_idx })),

                // Witness
                m('div.menu-col.menu-col-token', [
                    m('span', 'Witness: '),
                    m('span', menuArr[menu_idx].witness_name),
                    m('br'), m(witnessButton, { menu_idx: menu_idx })
                ]),

                // Witness coordinates
                m('div.menu-col.menu-col-token', [
                    m('span', 'Coordinates in the witness: '),
                    getDescrInputField(menu_idx, 'coordinates_in_witness')
                ]),

                // Witness-choice menu; invisible by default
                m('div.menu-row.menu-row-token', { style: { display: menuArr[menu_idx].menu_switches.witness === true ? 'grid' : 'none' } },
                    m(witnessChoiceComponent, { menu_idx: menu_idx })),

                // Token pictures
                m(tokenPictureComponent, { menu_idx: menu_idx }),

                // MDC
                m('div.menu-col.menu-col-token', [
                    m('span', getMDCFieldName(menu_idx)),
                    getDescrInputField(menu_idx, 'mdc', () => { showTokenHiero(menu_idx) })
                ]),

                // MDC with markup
                m(tokenMDCWMarkupComponent, { menu_idx: menu_idx }),

                // Phonetic reconstruction
                m('div.menu-col.menu-col-token', [m('span', 'Phonetic reconstruction: '),
                getDescrInputField(menu_idx, 'phonetic_reconstruction')]),

                m(tokenTransliterationComponent, { menu_idx: menu_idx }),

                // Sign function. Egyptian version, maps to 'other'
                m('div.menu-row.token-color', {
                    style: { display: projectType === 'hieroglyphic' ? 'block' : 'none' }
                }, [
                    m('span', 'Sign functions'), m('br'),
                    m('span', 'In case it is necessary for your research project, please mark the types of signs included in this token.'), m('br'),
                    m('input[type=checkbox]', {
                        name: `${menu_idx}-sign-function`,
                        id: `${menu_idx}-sign-function-pictogram`,
                        checked: hasSubValue(menuArr[menu_idx].description.other, 'pictogram'),
                        onclick: e => {
                            menuArr[menu_idx].description.other = toggleSubValue(
                                menuArr[menu_idx].description.other,
                                'pictogram',
                                e.target.checked
                            )
                        }
                    }),
                    m('label', { for: `${menu_idx}-sign-function-pictogram` }, 'Pictogram (= ideogram)'),
                    m('input[type=checkbox]', {
                        name: `${menu_idx}-sign-function`,
                        id: `${menu_idx}-sign-function-logogram`,
                        checked: hasSubValue(menuArr[menu_idx].description.other, 'logogram'),
                        onclick: e => {
                            menuArr[menu_idx].description.other = toggleSubValue(
                                menuArr[menu_idx].description.other,
                                'logogram',
                                e.target.checked
                            )
                        }
                    }),
                    m('label', { for: `${menu_idx}-sign-function-logogram` }, 'Logogram'),
                    m('input[type=checkbox]', {
                        name: `${menu_idx}-sign-function`,
                        id: `${menu_idx}-sign-function-radicogram`,
                        checked: hasSubValue(menuArr[menu_idx].description.other, 'radicogram'),
                        onclick: e => {
                            menuArr[menu_idx].description.other = toggleSubValue(
                                menuArr[menu_idx].description.other,
                                'radicogram',
                                e.target.checked
                            )
                        }
                    }),
                    m('label', { for: `${menu_idx}-sign-function-radicogram` }, 'Radicogram'),
                    m('input[type=checkbox]', {
                        name: `${menu_idx}-sign-function`,
                        id: `${menu_idx}-sign-function-phonetic-complement`,
                        checked: hasSubValue(menuArr[menu_idx].description.other, 'phonetic-complement'),
                        onclick: e => {
                            menuArr[menu_idx].description.other = toggleSubValue(
                                menuArr[menu_idx].description.other,
                                'phonetic-complement',
                                e.target.checked
                            )
                        }
                    }),
                    m('label', { for: `${menu_idx}-sign-function-phonetic-complement` }, 'Phonogram'),
                    m('input[type=checkbox]', {
                        name: `${menu_idx}-sign-function`,
                        id: `${menu_idx}-sign-function-group-writing`,
                        checked: hasSubValue(menuArr[menu_idx].description.other, 'group-writing'),
                        onclick: e => {
                            menuArr[menu_idx].description.other = toggleSubValue(
                                menuArr[menu_idx].description.other,
                                'group-writing',
                                e.target.checked
                            )
                        }
                    }),
                    m('label', { for: `${menu_idx}-sign-function-group-writing` }, 'Group writing'),
                    m('input[type=checkbox]', {
                        name: `${menu_idx}-sign-function`,
                        id: `${menu_idx}-sign-function-classifier`,
                        checked: hasSubValue(menuArr[menu_idx].description.other, 'classifier'),
                        onclick: e => {
                            menuArr[menu_idx].description.other = toggleSubValue(
                                menuArr[menu_idx].description.other,
                                'classifier',
                                e.target.checked
                            )
                        }
                    }),
                    m('label', { for: `${menu_idx}-sign-function-classifier` }, 'Classifier')
                ]),

                // Liu Shu. Chinese specific, maps to 'other'
                m('div.menu-row.token-color', {
                    style: { display: projectType === 'chinese' ? 'block' : 'none' }
                }, [
                    m('span', 'Liu Shu'), m('br'),

                    m('input[type=checkbox]', {
                        name: `${menu_idx}-liu-shu`,
                        id: `${menu_idx}-liu-shu-pictograph`,
                        checked: hasSubValue(menuArr[menu_idx].description.other, 'pictograph'),
                        onclick: e => {
                            menuArr[menu_idx].description.other = toggleSubValue(
                                menuArr[menu_idx].description.other,
                                'pictograph',
                                e.target.checked
                            )
                        }
                    }),
                    m('label', { for: `${menu_idx}-liu-shu-pictograph` }, '象形 pictograph'),
                    m('br'),
                    m('input[type=checkbox]', {
                        name: `${menu_idx}-liu-shu`,
                        id: `${menu_idx}-liu-shu-iconograph`,
                        checked: hasSubValue(menuArr[menu_idx].description.other, 'iconograph'),
                        onclick: e => {
                            menuArr[menu_idx].description.other = toggleSubValue(
                                menuArr[menu_idx].description.other,
                                'iconograph',
                                e.target.checked
                            )
                        }
                    }),
                    m('label', { for: `${menu_idx}-liu-shu-iconograph` }, '指事 iconograph'),
                    m('br'),
                    m('input[type=checkbox]', {
                        name: `${menu_idx}-liu-shu`,
                        id: `${menu_idx}-liu-shu-ss-compound`,
                        checked: hasSubValue(menuArr[menu_idx].description.other, 'ss-compound'),
                        onclick: e => {
                            menuArr[menu_idx].description.other = toggleSubValue(
                                menuArr[menu_idx].description.other,
                                'ss-compound',
                                e.target.checked
                            )
                        }
                    }),
                    m('label', { for: `${menu_idx}-liu-shu-ss-compound` }, '会意 semantic-semantic (SS) compound'),
                    m('br'),
                    m('input[type=checkbox]', {
                        name: `${menu_idx}-liu-shu`,
                        id: `${menu_idx}-liu-shu-sp-compound`,
                        checked: hasSubValue(menuArr[menu_idx].description.other, 'sp-compound'),
                        onclick: e => {
                            menuArr[menu_idx].description.other = toggleSubValue(
                                menuArr[menu_idx].description.other,
                                'sp-compound',
                                e.target.checked
                            )
                        }
                    }),
                    m('label', { for: `${menu_idx}-liu-shu-sp-compound` }, '形声 semantic-phonetic (SP) compound'),
                    m('br'),
                    m('input[type=checkbox]', {
                        name: `${menu_idx}-liu-shu`,
                        id: `${menu_idx}-liu-shu-meaning-uncertain`,
                        checked: hasSubValue(menuArr[menu_idx].description.other, 'meaning-uncertain'),
                        onclick: e => {
                            menuArr[menu_idx].description.other = toggleSubValue(
                                menuArr[menu_idx].description.other,
                                'meaning-uncertain',
                                e.target.checked
                            )
                        }
                    }),
                    m('label', { for: `${menu_idx}-liu-shu-meaning-uncertain` }, '转注 meaning uncertain'),
                    m('br'),
                    m('input[type=checkbox]', {
                        name: `${menu_idx}-liu-shu`,
                        id: `${menu_idx}-liu-shu-loan-phonogram`,
                        checked: hasSubValue(menuArr[menu_idx].description.other, 'loan-phonogram'),
                        onclick: e => {
                            menuArr[menu_idx].description.other = toggleSubValue(
                                menuArr[menu_idx].description.other,
                                'loan-phonogram',
                                e.target.checked
                            )
                        }
                    }),
                    m('label', { for: `${menu_idx}-liu-shu-loan-phonogram` }, '假借 loan phonogram')
                ]),

                // Sign function. Chinese version, maps to 'other'
                // m('div.menu-row.token-color', {
                //         style: { display: projectType === 'chinese' ? 'block' : 'none' }
                //     },
                //     [
                //         m('span', 'Liu Shu: '),
                //         m('select', {
                //                 value: menuArr[menu_idx].description.other === null ? 'not set' : menuArr[menu_idx].description.other,
                //                 onclick: (e) => { menuArr[menu_idx].description.other = e.target.value }
                //             },
                //             [
                //                 m('option', { value: 'pictograph' }, '象形 pictograph'),
                //                 m('option', { value: 'iconograph' }, '指事 iconograph'),
                //                 m('option', { value: 'SS compound' }, '会意 semantic-semantic (SS) compound'),
                //                 m('option', { value: 'SP compound' }, '形声 semantic-phonetic (SP) compound'),
                //                 m('option', { value: 'uncertain' }, '转注 (meaning uncertain)'),
                //                 m('option', { value: 'loan phonogram' }, '假借 loan phonogram'),
                //                 m('option', { value: 'not set' }, 'Not set')
                //             ])
                //
                //     ]
                // ),

                m(tokenClassificationStatusComponent, { menu_idx: menu_idx }),

                // Sign comments
                m('div.menu-col.menu-col-token', [
                    m('span', 'Sign comments: '),
                    getDescrInputField(menu_idx, 'sign_comments')
                ]),

                // Token meaning
                m('div.menu-col.menu-col-token', [
                    m('span', 'Token meaning: '),
                    getDescrInputField(menu_idx, 'context_meaning')
                ]),

                // Context
                m('div.menu-col.menu-col-token', [
                    m('span', 'Context: '),
                    m('br'), m('textarea', {
                        rows: 5,
                        value: menuArr[menu_idx].description.syntactic_relation,
                        oninput: (e) => {
                            e.redraw = false;
                            menuArr[menu_idx].description.syntactic_relation = e.target.value === '' ? null : e.target.value
                        },
                        class: projectTag === 'guodianimported' ? 'guodian' : ''
                    })
                ]),

                // POS
                m('div.menu-col.menu-col-token', [
                    m('span', 'Part of speech: '),
                    m('select', {
                        value: menuArr[menu_idx].description.pos === null ? 'not set' : menuArr[menu_idx].description.pos,
                        onclick: (e) => { menuArr[menu_idx].description.pos = e.target.value }
                    },
                        [
                            m('option', { value: 'ADJ' }, 'Adjective'),
                            m('option', { value: 'ADV' }, 'Adverb'),
                            m('option', { value: 'CONJ' }, 'Conjunction'),
                            m('option', { value: 'DET' }, 'Determiner'),
                            m('option', { value: 'DEV' }, 'Deverbal'),
                            m('option', { value: 'DN' }, 'Divine name'),
                            m('option', { value: 'N' }, 'Noun'),
                            m('option', { value: 'NUM' }, 'Numeral'),
                            m('option', { value: 'FN' }, 'Other function word'),
                            m('option', { value: 'PART' }, 'Particle'),
                            m('option', { value: 'POSTP' }, 'Postposition'),
                            m('option', { value: 'PREP' }, 'Preposition'),
                            m('option', { value: 'PRON' }, 'Pronoun'),
                            m('option', { value: 'PN' }, 'Proper name'),
                            m('option', { value: 'TN' }, 'Toponym'),
                            m('option', { value: 'VB' }, 'Verb'),
                            m('option', { value: 'not set' }, 'Not set')
                        ])
                ]),

                // Register/texteme
                m('div.menu-col.menu-col-token', [
                    m('span', 'Register/texteme: '),
                    getDescrInputField(menu_idx, 'register')
                ]),

                // Classifier analyses
                m(clfParses, { menu_idx: menu_idx }),

                // Biblio references
                m(biblioReferences, { menu_idx: menu_idx }),

                // Comments
                m('div.menu-row.menu-row-token', [
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
                    'div.menu-row.menu-row-token',
                    { style: { display: 'flex', 'justify-content': 'space-between' } },
                    [
                        m('input[type=button]', {
                            value: menuArr[menu_idx].id === null ? 'Submit' : 'Save',
                            style: { width: '80px' },
                            onclick: () => { submitToken(menu_idx) }
                        }),

                        m('input[type=button]', {
                            value: 'Delete',
                            disabled: menuArr[menu_idx].id === null,
                            style: { width: '80px' },
                            onclick: () => { deleteToken(menu_idx) }
                        }),
                    ]
                )
            ])
    }
};
