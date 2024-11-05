let supertextFilterDict = {};

const superTextInfoTemplate = {
    id: null,
    description: {
        text_name: null,
        comments: null
    },
    biblio_filter: '',
    biblio_on: false,
    biblio_tmp: null,
    biblio_refs: [],
    biblio_timeout: null
};

const superTextBiblioInfoTemplate = {
    id: null,
    text_id: null,
    publication_id: null,
    title: null,
    abbreviation: null,
    page_n: null,
    comments: null
}

let supertext_menu = {
    view: vnode => {
        let menu_idx = vnode.attrs.menu_idx,
            supertextMenuContents = [
                m('option', {value: '---', disabled: true}, '---')
            ];

        // Populate supertexts select
        let supertextInfoArr = [];
        for (const key in supertextInfo) {
            if (!supertextInfo.hasOwnProperty(key))
                continue;
            supertextInfoArr.push(supertextInfo[key]);
            supertextInfoArr[supertextInfoArr.length-1].id = key;
        }
        supertextInfoArr.sort((a,b) => {
            if (a.text_name < b.text_name)
                return -1;
            else if (a.text_name > b.text_name)
                return 1;
            else
                return 0;
        });
        supertextMenuContents = supertextMenuContents.concat(
            supertextInfoArr.map(record => m(
                'option',
                {value: record.id},
                record.text_name
            )));

        // Fetch the text name from supertextInfo for the case
        // when another supertext has been selected.
        if (menuArr[menu_idx].id !== null) {
            menuArr[menu_idx].description.text_name = supertextInfo[
                menuArr[menu_idx].id
            ].text_name;
            menuArr[menu_idx].description.comments = supertextInfo[
                menuArr[menu_idx].id
            ].comments;
        }

        return m('div.menu', [
            m(killButton, {menu_idx: menu_idx}),

            // Select existing supertext
            m('div.menu-col.supertext-color',
            [
                m('h4', 'Select an existing text:'),
                m(
                    'select',
                    {
                        value: menuArr[menu_idx].id === null ? '---' : menuArr[menu_idx].id,
                        onchange: e => {
                            // Will do this after downloading biblio refs.
                            e.redraw = false;
                            menuArr[menu_idx] = copy(superTextInfoTemplate);
                            menuArr[menu_idx].id = parseInt(e.target.value);
                            fetchSupertextBiblioRefs(menuArr[menu_idx].id, menu_idx);
                        },
                        style: {width: '150px'}
                    },
                    supertextMenuContents
                    )
            ]),

            // Search by supertext name
            m('div.menu-col.supertext-color', [
                m('span', {style: {'font-weight': 'bold'}}, 'Search by name: '),
                m('br'),
                m('br'),
                m(menuCacheMenu, {
                    menu_idx: menu_idx,
                    menuName: 'supertext-search-menu',
                    cacheFieldName: 'supertext',
                    filterDict: supertextFilterDict,
                    filterFunction: (tuple, containerID) => {
                        let test = get(supertextFilterDict, containerID, '').toLowerCase();
                        return String(tuple[1].text_name).toLowerCase().indexOf(test) >= 0;
                    },
                    divBuilderCallback: (tuple, containerID) => {
                        let button = document.createElement('div');
                        button.innerText = `${tuple[0]}: ${tuple[1].text_name}`;
                        button.classList.add('menu-button-value');
                        button.onclick = () => {
                            clfFilterDict[containerID] = '';
                            menuArr[menu_idx] = copy(superTextInfoTemplate);
                            menuArr[menu_idx].id = parseInt(tuple[0]);
                            fetchSupertextBiblioRefs(menuArr[menu_idx].id, menu_idx);
                        }
                        return button;
                    }
                }),
                m(menuCacheButton, {
                    menu_idx: menu_idx,
                    menuName: 'supertext-search-menu'
                })
            ]),

            m('div.menu-row.menu-row-supertext',
            [
                m('span', 'Text name:'),
                m('br'),
                m('input[type=text]',
                {
                    class: 'obligatory',
                    placeholder: '*',
                    style: {width: '200px'},
                    value: menuArr[menu_idx].description.text_name,
                    oninput: e => {
                        e.redraw = false;
                        menuArr[menu_idx].description.text_name = e.target.value;
                    }
                })
            ]),

            m(supertextBiblioReferences, {menu_idx: menu_idx}),

            m('div.menu-row.menu-row-supertext',
            [
                m('span', 'Comments:'),
                m('br'),
                m('textarea', {
                    style: {width: '420px', height: '150px'},
                    value: menuArr[menu_idx].description.comments,
                    oninput: e => {
                        e.redraw = false;
                        menuArr[menu_idx].description.comments = e.target.value;
                    }
                })
            ]),

            m('div.menu-row.menu-row-supertext',
            {style: {display: 'flex', 'justify-content': 'space-between'}},
            [
                m(
                    'input[type=button]',
                    {value: 'Submit',
                    onclick: e => {
                        e.redraw = false;
                        submitSupertext(menu_idx); }}
                ),
                m(
                    'input[type=button]',
                    {value: 'Delete',
                    disabled: menuArr[menu_idx].id === null,
                    onclick: e => {
                        e.redraw = false;
                        deleteSupertext(menu_idx); }}
                ),
            ])
        ])
    }
}

//
// Bibliographical references
//

let currentReferencesSupertext = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        let currentReferences = menuArr[menu_idx]
            .biblio_refs
            .map((biblioInfo, idx) =>
                m('div.biblio-ref', [
                    m(
                        'span',
                        {style: {'font-weight': 'bold'}},
                        'Publication: '),
                    m('span', getPublicationTitle(biblioInfo)),
                    m('br'),
                    m('span', {style: {'font-weight': 'bold'}}, 'Pages: '),
                    m('span', biblioInfo.page_n),
                    m('br'),
                    m('span', {style: {'font-weight': 'bold'}}, 'Comment: '),
                    m('span', biblioInfo.comments),
                    m('br'),
                    m(
                        'div',
                        {style: {
                            display: 'flex',
                            'justify-content': 'flex-end'
                        }},
                        m('input[type=button]', {
                            value: 'Remove reference',
                            onclick: () => {
                                menuArr[menu_idx].biblio_refs = drop(
                                    menuArr[menu_idx].biblio_refs,
                                    idx
                                );
                            }
                        }))
                ]));
        return m(
            'div',
            {style: {
                display : currentReferences.length === 0 ? 'none' : 'grid',
                'grid-column': '1/3'
            }},
            currentReferences
        )
    }
}

let supertextBiblioReferences = {
    view: vnode => {
        let menu_idx = vnode.attrs.menu_idx;
        return m('div.biblio-references.supertext-color', [
            m(
                'h4',
                {
                    style: {'margin-top': '0', 'margin-bottom': '5px'},
                    display: menuArr[menu_idx].biblio_on ? 'grid' : 'none'
                },
                'Bibliographical references:'
            ),
            m('br'),
            m(currentReferencesSupertext, {menu_idx: menu_idx}),
            m(biblioDetailsComponentSupertext, {menu_idx: menu_idx}),
            m(biblioChoiceComponentSupertext, {menu_idx: menu_idx}),
            m('br'),
            m('input[type=button]',
                {
                    style: {'grid-column': '1/2', 'margin-top': '3px'},
                    disabled: menuArr[menu_idx].biblio_on,
                    value: 'Add a bibliographical reference',
                    onclick: () => {addBiblioRefSupertext(menu_idx)}}
            )]
        );}
};

function addBiblioRefSupertext(menu_idx) {
    menuArr[menu_idx].biblio_tmp = copy(superTextBiblioInfoTemplate);
    menuArr[menu_idx].biblio_on = true;
    fetchBiblioAndRedraw(menu_idx);
}

let biblioDetailsComponentSupertext = {
    view: vnode => {
        let menu_idx = vnode.attrs.menu_idx,
            tmp = menuArr[menu_idx].biblio_tmp,
            pubTitle;

        if (!menuArr[menu_idx].biblio_on)
            return m('div');

        pubTitle = getPublicationTitle(tmp);
        if (pubTitle === null)
            pubTitle = '';
        return m('div.menu-row.biblio-details',[
            m('div', {style: {'grid-column': '1/2'}},
                m('span', {class: projectType}, `Publication: ${pubTitle}`)),
            m('div', {style: {'grid-column': '2/3'}}, [
                m('span', 'Pages: '),
                m('input[type=text]', {
                    class: projectType,
                    style: {width: '100px'},
                    oninput: setFieldNoRedrawHandler(tmp, 'page_n')
                })
            ]),
            m('div', {style: {'grid-column': '1/3'}}, [
                m('span', 'Comments: '),
                m('textarea', {
                    class: projectType,
                    rows: 5,
                    oninput: setFieldNoRedrawHandler(tmp, 'comments')
                })
            ]),
            m('div', {style: {'grid-column': '1/2'}}, m('input[type=button]', {
                value: 'Add reference',
                onclick: () => {validateAndAddReferenceSupertext(tmp, menu_idx)}}))
        ]);
    }
};

function validateAndAddReferenceSupertext(tmp, menu_idx) {
    if (tmp.publication_id === null) {
        alert('A publication must be selected.');
        return;
    }
    menuArr[menu_idx].biblio_refs.push(JSON.parse(JSON.stringify(tmp)))
}

let biblioChoiceComponentSupertext = {
    view: vnode => {
        let menu_idx = vnode.attrs.menu_idx;

        if (!menuArr[menu_idx].biblio_on)
            return m('div');

        return m('div.menu-row', [
            m('span', 'Filter the list: '),
            m('input[type=text]', {
                class: projectType,
                value: menuArr[menu_idx].biblio_filter,
                oninput: (e) => {
                    menuArr[menu_idx].biblio_filter = e.target.value

                    // Prevent the query from firing before the user ends typing.
                    e.redraw = false;
					clearTimeout(menuArr[menu_idx].biblio_timeout);
					menuArr[menu_idx].biblio_timeout = setTimeout(() => { m.redraw() }, 1000);
                }
            }),
            m('input[type=button]', {
                value: 'Hide menu',
                style: {'margin-left': '10px'},
                onclick: () => {menuArr[menu_idx].biblio_on = false}
            }),
            menu_data_cache['biblio'].length === 0 ?
                m('div.select-list', 'Fetching data...') :
                m(
                    'div.select-list',
                    menu_data_cache['biblio']
                        .filter(value => biblioFilterSupertext(value, menu_idx))
                        .map(value => supertextBiblioSpanBuilder(value, menu_idx))
                    )
        ]);
    }
}

function supertextBiblioSpanBuilder(value, menu_idx) {
    return m(
        'span.list-element',
        {onclick: () => {
            menuArr[menu_idx].biblio_tmp.publication_id = parseInt(value[0]);
            menuArr[menu_idx].biblio_tmp.title = value[1].title;
            menuArr[menu_idx].biblio_tmp.abbreviation = value[1].abbreviation;
        }},
        value[1]['abbreviation'] !== '' ?
            value[1]['abbreviation'] :
            value[1]['title']
    )
}

function biblioFilterSupertext(value, menu_idx) {
    return String(value[1]['abbreviation'])
            .toLowerCase()
            .indexOf(menuArr[menu_idx].biblio_filter.toLowerCase()) >= 0 ||
        String(value[1]['title'])
            .toLowerCase()
            .indexOf(menuArr[menu_idx].biblio_filter.toLowerCase()) >= 0;
}

async function fetchSupertextBiblioRefs(supertextID, menu_idx) {
    const response = await fetch(`${dbAPIURL}/text_biblio/byforeignid?foreign_key=text_id&foreign_key_id=${supertextID}`);
    if (!response.ok) {
        alert('Failed to download supertext biblio references from the server.');
        return;
    } else {
        const data = await response.json();
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                let newBiblioRef = copy(superTextBiblioInfoTemplate);

                newBiblioRef.id = parseInt(key);
                newBiblioRef.text_id = data[key].text_id;
                newBiblioRef.page_n = data[key].page_n;
                newBiblioRef.comments = data[key].comments;

                const response = await fetch(`${dbAPIURL}/bibliography/byid?id=${data[key].publication_id}`);
                if (!response.ok) {
                    alert('Failed to download bibliographical entry from the server.');
                    return
                }
                const bibData = await response.json();
                if (bibData.hasOwnProperty('title'))
                    newBiblioRef.title = bibData.title;
                if (bibData.hasOwnProperty('abbreviation'))
                    newBiblioRef.abbreviation = bibData.abbreviation;

                menuArr[menu_idx].biblio_refs.push(newBiblioRef);
            }
        }
    }
    m.redraw();
}

//
// Send the data to the server. If token id is null, this is a new token,
// otherwise this is an update.
//
async function submitSupertext(menu_idx) {
    const response = await fetch(`${dbAPIURL}/texts/holisticadd`, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'include',
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
        if (result.match(/^\d+$/))
            alert(`A new supertext was created on the server with the ID ${result}`);
        else
            alert(result);
    }
    await fetchSupertexts();
    m.redraw();
}

//
// Delete the token from the server.
//
async function deleteSupertext(menu_idx) {
    if (!confirm('This action may be irreversible. Are you sure?'))
        return;

    const response = await fetch(`${dbAPIURL}/texts/holisticdelete`, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'include',
        headers: {
            'Content-Type': 'text/plain'
        },
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify({id: menuArr[menu_idx].id})
    });

    if (!response.ok) {
        const message = await response.text();
        alert(`Failed to delete the supertext: ${message}`);
    }
    else {
        const result = await response.text();
        alert(result);
        // Close the menu.
        killMenu(menu_idx);
        await fetchSupertexts();
        m.redraw();
    }
}
