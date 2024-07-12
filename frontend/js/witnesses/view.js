let witnessFilterDict = {};

let witness_menu = {
    view: vnode => {
        let menu_idx = vnode.attrs.menu_idx,

            genreMenu = newThesaurusMenu(genreThesaurus, menu_idx, 'genre'),
            objTypeMenu = newThesaurusMenu(objectTypeThesaurus, menu_idx, 'object_type'),
            scriptMenu = newThesaurusMenu(scriptThesaurus, menu_idx, 'script'),
            locationMenu = newThesaurusMenu(locationThesaurus, menu_idx, 'location'),
            periodStartMenu = newThesaurusMenu(periodThesaurus, menu_idx, 'period_date_start'),
            periodEndMenu = newThesaurusMenu(periodThesaurus, menu_idx, 'period_date_end'),
            chronoStartMenu = newThesaurusMenu(chronoThesaurus, menu_idx, 'chrono_date_start'),
            chronoEndMenu = newThesaurusMenu(chronoThesaurus, menu_idx, 'chrono_date_end'),
            genreSelectButton = newThesaurusButton(genreThesaurus, menu_idx, 'genre'),
            objTypeSelectButton = newThesaurusButton(objectTypeThesaurus, menu_idx, 'object_type'),
            scriptSelectButton = newThesaurusButton(scriptThesaurus, menu_idx, 'script'),
            locationSelectButton = newThesaurusButton(locationThesaurus, menu_idx, 'location'),
            periodStartSelectButton = newThesaurusButton(periodThesaurus, menu_idx, 'period_date_start'),
            periodEndSelectButton = newThesaurusButton(periodThesaurus, menu_idx, 'period_date_end'),
            chronoStartSelectButton = newThesaurusButton(chronoThesaurus, menu_idx, 'chrono_date_start'),
            chronoEndSelectButton = newThesaurusButton(chronoThesaurus, menu_idx, 'chrono_date_end');

        let supertextArr = [];
        for (const key in supertextInfo)
            if (supertextInfo.hasOwnProperty(key))
                supertextArr.push([key, supertextInfo[key]]);
        supertextArr.sort((a, b) => cmpStr(
            a[1].text_name,
            b[1].text_name
        ));

        let objectArr = [];
        for (const key in objectInfo)
            if (objectInfo.hasOwnProperty(key))
                objectArr.push([key, objectInfo[key]]);
        objectArr.sort((a, b) => cmpStr(
            a[1].name,
            b[1].name
        ));

        return m(
            'div.menu',
            [
                m(killButton, { menu_idx: menu_idx }),

                m('div.menu-col.witness-color', [
                    m('span', 'Show by id: '),
                    m('input[type=text]', {
                        placeholder: 'witness ID',
                        style: { width: '50px' },
                        id: `${menu_idx}-witness-id`
                    }),
                    m.trust('<span>&nbsp;&nbsp;</span>'),
                    m('input[type=button]', {
                        value: 'Submit',
                        onclick: e => {
                            // Will redraw in the called function.
                            e.redraw = false;
                            loadWitnessInfo(
                                menu_idx,
                                byID(`${menu_idx}-witness-id`).value
                            )
                        }
                    })]
                ),

                m('div.menu-col.witness-color', {
                    style: {
                        display: 'flex',
                        'justify-content': 'center'
                    }
                },
                    [m('input[type=button]',
                        {
                            value: '<< Previous',
                            onclick: () => {
                                showPreviousAbstract(
                                    menu_idx,
                                    witnessIDs,
                                    loadWitnessInfo
                                )
                            }
                        }),
                    m('input[type=button]',
                        {
                            value: 'Next >>',
                            onclick: () => {
                                showNextAbstract(
                                    menu_idx,
                                    witnessIDs,
                                    loadWitnessInfo
                                )
                            }
                        })]
                ),

                // Search by witness name
                m('div.menu-row.witness-color', [
                    m('span', 'Search by witness name: '),
                    m(menuCacheMenu, {
                        menu_idx: menu_idx,
                        menuName: 'witness-name-search-menu',
                        cacheFieldName: 'witness',
                        filterDict: witnessFilterDict,
                        filterFunction: (tuple, containerID) => {
                            let test = get(witnessFilterDict, containerID, '').toLowerCase();
                            return String(tuple[1].name).toLowerCase().indexOf(test) >= 0;
                        },
                        divBuilderCallback: (tuple, containerID) => {
                            let button = document.createElement('div');
                            button.innerText = `${tuple[0]}: ${tuple[1].name}`;
                            button.classList.add('menu-button-value');
                            button.onclick = () => {
                                clfFilterDict[containerID] = '';
                                loadWitnessInfo(menu_idx, tuple[0])
                            }
                            return button;
                        }
                    }),
                    m(menuCacheButton, {
                        menu_idx: menu_idx,
                        menuName: 'witness-name-search-menu'
                    })
                ]),

                // Witness ID
                m('div.menu-row.witness-color', [
                    m('span', { style: { 'font-weight': 'bold' } }, 'Witness ID: '),
                    m('span', txt(menuArr[menu_idx].id))
                ]),

                m('div.menu-col.witness-color',
                    m('span', 'Name: '),
                    m('input[type=text]', {
                        value: n(menuArr[menu_idx]
                            .description
                            .name),
                        placeholder: '*',
                        class: 'obligatory',
                        oninput: e => {
                            e.redraw = false;
                            menuArr[menu_idx]
                                .description
                                .name = e.target.value === '' ?
                                    null : e.target.value
                        }
                    })
                ),

                m('div.menu-col.witness-color', [
                    m('span', 'Supertext: ' +
                        (midx => {
                            const stextID = menuArr[midx]
                                .description
                                .supertext_id;
                            if (stextID === null)
                                return 'not set';
                            if (supertextInfo.hasOwnProperty(stextID))
                                return supertextInfo[stextID].text_name;
                            else
                                return 'wrong ID';
                        })(menu_idx)),
                    m('select',
                        {
                            style: { width: '200px' },
                            onchange: e => {
                                menuArr[menu_idx]
                                .description
                                .supertext_id = parseInt(e.target.value)
                            },
                            value: menuArr[menu_idx]
                                .description
                                .supertext_id === null ?
                                '---' : menuArr[menu_idx]
                                    .description
                                    .supertext_id
                        },
                        [m('option', { disabled: 'true', value: '---' }, '---')]
                            .concat(supertextArr.map(
                                tuple => m('option',
                                    { value: tuple[0] },
                                    tuple[1].text_name)
                            )))
                ]
                ),

                m('div.menu-col.witness-color', [
                    m('span', 'Object: ' +
                        (midx => {
                            const objId = menuArr[midx]
                                .object_and_tla_data
                                .object_id;
                            if (objId === null)
                                return 'not set';
                            if (objectInfo.hasOwnProperty(objId))
                                return objectInfo[objId].name;
                            else
                                return 'wrong ID';
                        })(menu_idx)),
                    m('select',
                        {
                            style: { width: '200px' },
                            onchange: e => {
                                menuArr[menu_idx]
                                    .object_and_tla_data
                                    .object_id = parseInt(e.target.value)
                            },
                            value: menuArr[menu_idx]
                                .object_and_tla_data
                                .object_id === null ?
                                '---' : menuArr[menu_idx]
                                    .object_and_tla_data
                                    .object_id
                        },
                        [m('option', { disabled: 'true', value: '---' }, '---')]
                            .concat(objectArr.map(
                                tuple => m('option',
                                    { value: tuple[0] },
                                    tuple[1].name)
                            )))
                ]
                ),

                m('div.menu-col.witness-color', ''),

                // Thesaurus-based info
                m('div.menu-col.witness-color', [
                    m('span', `Genre: ${getSubtreeTitleById(
                        genreThesaurus,
                        menuArr[menu_idx].description.genre)
                        }`),
                    m('br'), m(genreMenu), m(genreSelectButton)]),
                m('div.menu-col.witness-color', [
                    m('span', `Object type: ${getSubtreeTitleById(
                        objectTypeThesaurus,
                        menuArr[menu_idx].description.object_type)
                        }`),
                    m('br'), m(objTypeMenu), m(objTypeSelectButton)]),
                m('div.menu-col.witness-color', [
                    m('span', `Script: ${getSubtreeTitleById(
                        scriptThesaurus,
                        menuArr[menu_idx].description.script)
                        }`),
                    m('br'), m(scriptMenu), m(scriptSelectButton)]),
                m('div.menu-col.witness-color', [
                    m('span', `Location: ${getSubtreeTitleById(
                        locationThesaurus,
                        menuArr[menu_idx].description.location)
                        }`),
                    m('br'), m(locationMenu), m(locationSelectButton)]),

                m('div.menu-col.witness-color', [
                    m('span', `Period (start): ${getSubtreeTitleById(
                        periodThesaurus,
                        menuArr[menu_idx].description.period_date_start)
                        }`),
                    m('br'), m(periodStartMenu), m(periodStartSelectButton)]),
                m('div.menu-col.witness-color', [
                    m('span', `Period (end): ${getSubtreeTitleById(
                        periodThesaurus,
                        menuArr[menu_idx].description.period_date_end)
                        }`),
                    m('br'), m(periodEndMenu), m(periodEndSelectButton)]),

                m('div.menu-col.witness-color', [
                    m('span', `Date (start): ${getSubtreeTitleById(
                        chronoThesaurus,
                        menuArr[menu_idx].description.chrono_date_start)
                        }`),
                    m('br'), m(chronoStartMenu), m(chronoStartSelectButton)]),
                m('div.menu-col.witness-color', [
                    m('span', `Date (end): ${getSubtreeTitleById(
                        chronoThesaurus,
                        menuArr[menu_idx].description.chrono_date_end)
                        }`),
                    m('br'), m(chronoEndMenu), m(chronoEndSelectButton)]),

                // URL
                m('div.menu-row.witness-color', [
                    m('span', 'URL: '),
                    m('input[type=text]', {
                        style: { width: '360px' },
                        value: menuArr[menu_idx].description.url,
                        oninput: e => {
                            e.redraw = false;
                            menuArr[menu_idx]
                                .description
                                .url = e.target.value;
                        }
                    })
                ]),

                // Pictures
                m('div.menu-row.witness-color', [
                    m('h4', 'Witness pictures: '),
                    menuArr[menu_idx]
                        .pictures
                        .map(witnessPicDivBuilder(menu_idx))
                ]),
                m(addWitnessPicComponent, { menu_idx: menu_idx }),

                // Biblio references
                m('div.menu-row.witness-color', [
                    m('h4', 'Bibliographical references: '),
                    menuArr[menu_idx]
                        .biblio_refs
                        .map(witnessBiblioDivBuilder(menu_idx))
                ]),

                m(addWitnessBiblioComponent, { menu_idx: menu_idx }),

                // Comments
                m('div.menu-row.witness-color', [
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

                // Submit
                m('div.menu-row.witness-color', {
                    style: {
                        display: 'flex',
                        'justify-content': 'space-between'
                    }
                }, [
                    m('input[type=button]', {
                        value: 'Submit',
                        onclick: () => { submitWitness(menu_idx) }
                    }),
                    m('input[type=button]', {
                        value: 'Delete',
                        onclick: () => { deleteWitness(menu_idx) }
                    }),
                ])
            ]
        )
    }
};

function newThesaurusMenu(thesaurus, menu_idx, field_name) {
    // If there is no thesaurus, show a text-input field.
    if (thesaurus === null || thesaurus === undefined)
        return {
            view: () => {
                return m(
                    'input[type=text]',
                    {
                        oninput: e => {
                            e.redraw = false;
                            menuArr[menu_idx].description[field_name] = e.target.value;
                        }
                    })
            }
        }
    const id = `${menu_idx}-${field_name}-menu`;
    return {
        view: () => {
            let closeButton = m(
                'input[type=button]',
                {
                    value: '✕',
                    style: { 'margin-top': '2px' },
                    onclick: () => { hideElementById(id) }
                }
            );
            return m(
                'div.menu-wrapper',
                { id: id },
                [m('div.float_menu_header', closeButton),
                m('div.inner-menu')]
            );
        }
    }
}

function newThesaurusButton(thesaurus, menu_idx, field_name) {
    if (thesaurus === null || thesaurus === undefined)
        return {
            view: () => { return m('div', { style: { display: 'none' } }) }
        };

    const id = `${menu_idx}-${field_name}-menu`;
    return {
        view: () => {
            return m(
                'input[type=button]',
                {
                    value: 'Select',
                    style: { 'margin-top': '7px' },
                    onclick: e => {
                        e.redraw = false;
                        showMenu(id, e);
                        populateMenuFromKey(
                            id,
                            thesaurus,
                            'root',
                            menu_idx,
                            field_name
                        );
                    }
                })
        }
    };
}

function showMenu(id, event) {
    const x = event.clientX,
        y = event.clientY;
    let menuDiv = document.getElementById(id);
    menuDiv.style.display = 'grid';
    menuDiv.style.position = 'fixed';
    menuDiv.style.left = x + 'px';
    menuDiv.style.top = y + 'px';
}

/**
 * This function adds children of the thesaurus
 * subtree to the menu as buttons with functions
 * depending on their status: leaf nodes assign values;
 * internal nodes repopulate the menu with their own
 * children.
 */
function populateMenuFromKey(
    divID,
    thesaurus,
    key,
    menu_idx,
    fieldName
) {
    // Clear the menu
    let menuDiv = document.getElementById(divID),
        divWithButtons = menuDiv.getElementsByTagName('div')[1];

    while (divWithButtons.hasChildNodes()) {
        let button = divWithButtons.firstChild;
        divWithButtons.removeChild(button);
    }

    let subtree = getSubtreeByKey(thesaurus, key);
    if (subtree.hasOwnProperty('children')) {
        // Add a 'Back' button at the top if we are not
        // at the top already.
        if (key !== 'root') {
            let backButton = createBackButton(
                divID,
                thesaurus,
                key,
                menu_idx,
                fieldName)
            divWithButtons.appendChild(backButton);

            // Add a button for the whole subtree if it is
            // not nonsensical.
            if (subtree.title !== '< Ancient Egyptian scripts >' &&
                subtree.title !== '< Scripts by types >') {
                let button = document.createElement('div');
                button.innerText = subtree.title;
                button.classList.add('menu-button-value');
                button.onclick = () => {
                    menuArr[menu_idx].description[fieldName] = subtree.id;
                    hideElementById(divID);
                    m.redraw();
                };
                divWithButtons.appendChild(button);
            }
        }

        // Add buttons opening lower levels.
        for (const child of subtree.children) {
            let button = document.createElement('div');
            button.innerText = child.title;
            button.classList.add('menu-button-submenu');
            button.onclick = () => {
                populateMenuFromKey(
                    divID,
                    thesaurus,
                    child.id,
                    menu_idx,
                    fieldName
                )
            };
            divWithButtons.appendChild(button);
        }
    } else {
        // Add a 'Back' button.
        let backButton = createBackButton(
            divID,
            thesaurus,
            key,
            menu_idx,
            fieldName)
        divWithButtons.appendChild(backButton);

        // Add a value-assigning button.
        let button = document.createElement('div');
        button.innerText = subtree.title;
        button.classList.add('menu-button-value');
        button.onclick = () => {
            menuArr[menu_idx].description[fieldName] = subtree.id;
            hideElementById(divID);
            m.redraw();
        };
        divWithButtons.appendChild(button);
    }
}

function createBackButton(
    divID,
    thesaurus,
    key,
    menu_idx,
    fieldName
) {
    let backButton = document.createElement('div');
    backButton.innerText = '<< Back';
    backButton.classList.add('menu-button-submenu');
    const previousKey = getKeyParent(thesaurus, key);
    backButton.onclick = () => {
        populateMenuFromKey(
            divID,
            thesaurus,
            previousKey,
            menu_idx,
            fieldName
        )
    }
    return backButton;
}

function getSubtreeByKey(thesaurus, key) {
    // A glorified pointer.
    let resultObj = { result: null };
    getSubtreeByKeyRec(thesaurus, key, resultObj);
    return resultObj.result;
}

function getSubtreeByKeyRec(subtree, key, resultObj) {
    if (subtree.id == key) {
        resultObj.result = subtree;
        return;
    } else if (resultObj.result !== null) {
        // The subtree has already been found.
        // Prune the search tree.
        return;
    }
    // console.log(subtree);
    if (subtree.hasOwnProperty('children')) {
        for (const child of subtree.children) {
            getSubtreeByKeyRec(child, key, resultObj);
        }
    }
}

function getKeyParent(thesaurus, key) {
    let resultObj = { result: null };
    getKeyParentRec(thesaurus, key, null, resultObj);
    return resultObj.result;
}

function getKeyParentRec(thesaurus, key, parentKey, resultObj) {
    if (thesaurus.id === key) {
        resultObj.result = parentKey;
        return;
    }
    if (thesaurus.hasOwnProperty('children'))
        for (const child of thesaurus.children)
            getKeyParentRec(child, key, thesaurus.id, resultObj);
}

function destroyElementById(id) {
    let el = document.getElementById(id);
    el.remove();
}

function hideElementById(id) {
    let el = document.getElementById(id);
    el.style.display = 'none';
}

function getSubtreeTitleById(thesaurus, id) {
    if (id === null)
        return 'not set';
    else if (thesaurus === null)  // id is the value
        return id;

    let subtree = getSubtreeByKey(thesaurus, id);
    return subtree.title;
}

//
// Picture handling
//
function witnessPicDivBuilder(menu_idx) {
    return (picInfo, idx) => m(
        'div',
        { style: { margin: '5px', 'margin-bottom': '10px' } },
        [
            m('span', 'Title: '),
            m(
                'input[type=text]',
                {
                    value: picInfo.description.title,
                    class: projectType,
                    oninput: (e) => {
                        e.redraw = false;
                        menuArr[menu_idx]
                            .pictures[idx]
                            .description
                            .title = e.target.value === '' ?
                                null : e.target.value;
                    }
                }
            ),
            m('br'),
            m(
                'div',
                {
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
                m(
                    'img',
                    {
                        style: { 'max-width': '400px' },
                        src: picInfo.description.base64
                    }
                )
            ),
            m('span', 'Comments: '),
            m('br'),
            m(
                'textarea',
                {
                    value: picInfo.description.comments,
                    class: projectType,
                    style: { 'margin-bottom': '5px' },
                    rows: 4,
                    oninput: (e) => {
                        e.redraw = false;
                        menuArr[menu_idx]
                            .pictures[idx]
                            .description
                            .comments = e.target.value === '' ?
                                null : e.target.value;
                    }
                }
            ),
            m('br'),
            m(
                'input[type=button]',
                {
                    value: 'Show picture',
                    onclick: () => { showWitnessPic(menu_idx, idx) }
                }
            ),
            m(
                'input[type=button]',
                {
                    value: 'Remove picture', onclick: () => {
                        menuArr[menu_idx].pictures = drop(
                            menuArr[menu_idx].pictures,
                            idx
                        )
                    }
                }
            )
        ]);
}

let witnessPicShowComponent = {
    menuIDX: null,
    view: () => {
        const menu_idx = witnessPicShowComponent.menuIDX;
        return m('div.witness-pic-overlay',
            {
                style: {
                    display: menu_idx !== null &&
                        menuArr[menu_idx].show_overlay ?
                        'block' : 'none'
                }
            },
            [m('input[type=button]', {
                value: 'Hide overlay', onclick: () => {
                    menuArr[menu_idx].show_overlay = false;
                }
            }),
            m('br'),
            m('br'),
            m('canvas#witness-picture', {
                style: { border: '1px dotted red' }
            })])
    }
};

let addWitnessPicComponent = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        return m(
            'div.menu-row.witness-color',
            [
                m('img', {
                    id: `${menu_idx}-witness-pic-add-preview`,
                    style: {
                        display: 'none',
                        margin: 'auto',
                        'margin-bottom': '10px',
                        'margin-top': '10px'
                    }
                }),
                m('div', { style: { 'margin-bottom': '5px' } }, [
                    m('input[type=button]', {
                        value: 'Open file...',
                        onclick: () => { byID('witness-file-input').click() }
                    }),
                    m('input[type=file]', {
                        id: 'witness-file-input',
                        type: 'file',
                        accept: 'image/png, image/jpeg',
                        style: { display: 'none' },
                        onchange: e => { handleWitnessPickSelect(e, menu_idx) }
                    }),
                    m('span', ' Picture title: '),
                    m('input[type=text]', {
                        id: `${menu_idx}-witness-pic-add-title`,
                        disabled: true
                    })
                ]),
                m('span', 'Comments: '),
                m('textarea', {
                    id: `${menu_idx}-witness-pic-add-comments`,
                    class: projectType,
                    style: { 'margin-bottom': '5px' },
                    rows: 4,
                    disabled: true
                }),
                m('input[type=button]', {
                    id: `${menu_idx}-witness-pic-add-button`,
                    value: 'Add picture',
                    disabled: true,
                    onclick: () => { addWitnessPicture(menu_idx) }
                })
            ]
        )
    }
};

function showWitnessPic(menu_idx, idx) {
    witnessPicShowComponent.menuIDX = menu_idx;
    menuArr[menu_idx].show_overlay = true;
    const base64 = menuArr[menu_idx]
        .pictures[idx]
        .description
        .base64;
    let image = new Image();
    image.onload = () => {
        let canvas = document.getElementById('witness-picture'),
            ctx = canvas.getContext('2d');
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);
        // For Safari.
        document.body.scrollTop = 0;
        // For Chrome, Firefox, IE and Opera.
        document.documentElement.scrollTop = 0;
    }
    image.src = base64;
}

function handleWitnessPickSelect(e, menu_idx) {
    let files = e.target.files;
    if (files.length < 1) {
        return;
    }
    let reader = new FileReader();
    reader.onload = e => { onFileLoaded(e, menu_idx) };
    for (const file of files)
        reader.readAsDataURL(file);
}

function onFileLoaded(e, menu_idx) {
    byID(`${menu_idx}-witness-pic-add-preview`).style.display = 'block';
    byID(`${menu_idx}-witness-pic-add-preview`).src = e.target.result;

    byID(`${menu_idx}-witness-pic-add-title`).disabled = false;
    byID(`${menu_idx}-witness-pic-add-comments`).disabled = false;
    byID(`${menu_idx}-witness-pic-add-button`).disabled = false;
}

function addWitnessPicture(menu_idx) {
    let newPic = copy(witnessPictureInfoTemplate);
    const picTitle = byID(`${menu_idx}-witness-pic-add-title`)
        .value === '' ?
        null : byID(`${menu_idx}-witness-pic-add-title`).value;
    const picComments = byID(`${menu_idx}-witness-pic-add-comments`)
        .value === '' ?
        null : byID(`${menu_idx}-witness-pic-add-comments`).value;

    newPic.description.base64 = byID(`${menu_idx}-witness-pic-add-preview`).src;
    newPic.description.title = picTitle;
    newPic.description.comments = picComments;
    menuArr[menu_idx].pictures.push(newPic);
}

//
// Biblio ref handling
//
function getTitleFromPubInfo(pubInfo, pubId) {
    if (pubInfo === null)
        return 'Bad publication id: ' + pubId;
    else if (pubInfo.abbreviation !== '' &&
        pubInfo.abbreviation !== null &&
        pubInfo.abbreviation !== undefined)
        return pubInfo.abbreviation;
    else
        return pubInfo.title;
}

function witnessBiblioDivBuilder(menu_idx) {
    return (refInfo, idx) => {
        const pubId = refInfo.description.publication_id,
            pubInfo = binarySearchOnCache('biblio', pubId),
            title = getTitleFromPubInfo(pubInfo, pubId);

        return m(
            'div',
            {
                style: {
                    margin: '5px',
                    'margin-bottom': '10px',
                    border: '1px dotted grey',
                    padding: '3px'
                }
            },
            [
                m('div', { style: { 'margin-bottom': '5px' } }, [
                    m('span', 'Publication: '),
                    m('span', title)
                ]),
                m('div', { style: { 'margin-bottom': '5px' } }, [
                    m('span', 'Pages: '),
                    m('span', refInfo.description.page_n)
                ]),
                m('div', { style: { 'margin-bottom': '5px' } }, [
                    m('span', 'Comments: '),
                    m('span', refInfo.description.comments)
                ]),
                m('input[type=button]', {
                    value: 'Delete reference',
                    onclick: () => {
                        menuArr[menu_idx].biblio_refs = drop(
                            menuArr[menu_idx].biblio_refs, idx
                        )
                    }
                })
            ]);
    }
}

let addWitnessBiblioComponent = {
    timeOut: null,
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx,
            refInfo = menuArr[menu_idx].biblio_tmp,
            pubId = refInfo.publication_id;
        let pubInfo = null,
            title = '';
        if (pubId !== null) {
            pubInfo = binarySearchOnCache('biblio', pubId);
            title = pubInfo === null ? '' : getTitleFromPubInfo(pubInfo, pubId);
        }
        return m('div.menu-row.witness-color', [
            m('span', 'Add a new reference:'),
            m('div', {
                style: {
                    'background-color': 'rgb(230, 230, 235)',
                    'padding': '3px',
                    'margin-top': '5px',
                    'margin-bottom': '7px',
                    width: '400px'
                }
            },
                [
                    m('span', 'Publication: ' + title), m('br'),
                    m('span', 'Pages: '),
                    m('input[type=text]', {
                        value: menuArr[menu_idx].biblio_tmp.page_n === null ?
                            '' : menuArr[menu_idx].biblio_tmp.page_n,
                        oninput: e => {
                            e.redraw = false;
                            menuArr[menu_idx].biblio_tmp.page_n = n(e.target.value);
                        }
                    }), m('br'),
                    m('span', 'Comments:'),
                    m('br'),
                    m('textarea', {
                        value: menuArr[menu_idx].biblio_tmp.comments,
                        class: projectType,
                        style: { 'margin-bottom': '5px' },
                        rows: 4,
                        oninput: e => {
                            e.redraw = false;
                            menuArr[menu_idx].biblio_tmp.comments = n(e.target.value);
                        }
                    }
                    ),
                    m('div', {
                        style: {
                            width: '400px',
                            display: 'flex',
                            'justify-contents': 'flex-end'
                        }
                    },
                        m('input[type=button]', {
                            style: { display: 'inline-block' },
                            disabled: menuArr[menu_idx]
                                .biblio_tmp
                                .publication_id === null,
                            value: 'Add reference',
                            onclick: () => {
                                const newRef = {
                                    id: null,
                                    description: {
                                        witness_id: menuArr[menu_idx].id,
                                        publication_id: menuArr[menu_idx]
                                            .biblio_tmp
                                            .publication_id,
                                        page_n: menuArr[menu_idx]
                                            .biblio_tmp
                                            .page_n,
                                        comments: menuArr[menu_idx]
                                            .biblio_tmp
                                            .comments
                                    }
                                };
                                menuArr[menu_idx].biblio_refs.push(
                                    newRef
                                );
                            }
                        }))
                ]),
            m('span', 'Filter the list: '),
            m('input[type=text]', {
                id: `${menu_idx}-witness-biblio-filter`,
                class: projectType,
                oninput: (e) => {
                    e.redraw = false;
                    menuArr[menu_idx].biblio_filter = e.target.value;
                    clearTimeout(addWitnessBiblioComponent.timeOut);
                    addWitnessBiblioComponent.timeOut = setTimeout(
                        m.redraw,
                        1000
                    );
                }
            }),
            m('div.select-list', menu_data_cache
                .biblio
                .filter(value => witnessBiblioFilter(value, menu_idx))
                .map(value => witnessBiblioSelectSpanBuilder(value, menu_idx))
            )
        ]);
    }
};

function witnessBiblioFilter(value, menu_idx) {
    const test = menuArr[menu_idx].biblio_filter
        .toLowerCase();
    return String(value[1]['abbreviation'])
        .toLowerCase()
        .indexOf(test) >= 0 ||
        String(value[1]['title'])
            .toLowerCase()
            .indexOf(test) >= 0;
}

function witnessBiblioSelectSpanBuilder(value, menu_idx) {
    const pubId = parseInt(value[0]);
    return m(
        'span.list-element',
        {
            onclick: () => {
                menuArr[menu_idx]
                    .biblio_tmp
                    .publication_id = pubId;
            }
        },
        getTitleFromPubInfo(value[1], pubId)
    );
}

//
// Submit/delete
//
async function submitWitness(menu_idx) {
    const response = await fetch(`${dbAPIURL}/witnesses/holisticadd`, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        // credentials: 'include',
        headers: {
            'Content-Type': 'text/plain'
        },
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify(menuArr[menu_idx])
    });
    if (!response.ok) {
        const message = await response.text();
        alert(`Failed to upload data to the server: ${message}`);
    }
    else {
        const result = await response.text();
        if (result.match(/^\d+$/)) {
            alert(`A new witness was created on the server with the ID ${result}`);
            loadWitnessInfo(menu_idx, parseInt(result));
        }
        else
            alert(result);
    }
}

async function deleteWitness(menu_idx) {
    if (!confirm('This action may be irreversible. Are you sure?'))
        return;

    const response = await fetch(`${dbAPIURL}/witnesses/holisticdelete`, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        // credentials: 'include',
        headers: {
            'Content-Type': 'text/plain'
        },
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify({ id: menuArr[menu_idx].id })
    });

    if (!response.ok) {
        const message = await response.text();
        alert(`Failed to delete the witness: ${message}`);
    }
    else {
        const result = await response.text();
        alert(result);
        // Close the menu.
        killMenu(menu_idx);
        fetchWitnessIDs();
        m.redraw();
    }
}