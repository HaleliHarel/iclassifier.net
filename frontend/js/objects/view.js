let objectFilterDict = {};

let object_menu = {
    view: vnode => {
        let menu_idx = vnode.attrs.menu_idx,
            locationMenu = newThesaurusMenu(locationThesaurus, menu_idx, 'location'),
            periodStartMenu = newThesaurusMenu(periodThesaurus, menu_idx, 'period_date_start'),
            periodEndMenu = newThesaurusMenu(periodThesaurus, menu_idx, 'period_date_end'),
            chronoStartMenu = newThesaurusMenu(chronoThesaurus, menu_idx, 'chrono_date_start'),
            chronoEndMenu = newThesaurusMenu(chronoThesaurus, menu_idx, 'chrono_date_end'),
            locationSelectButton = newThesaurusButton(locationThesaurus, menu_idx, 'location'),
            periodStartSelectButton = newThesaurusButton(periodThesaurus, menu_idx, 'period_date_start'),
            periodEndSelectButton = newThesaurusButton(periodThesaurus, menu_idx, 'period_date_end'),
            chronoStartSelectButton = newThesaurusButton(chronoThesaurus, menu_idx, 'chrono_date_start'),
            chronoEndSelectButton = newThesaurusButton(chronoThesaurus, menu_idx, 'chrono_date_end');

        return m(
            'div.menu',
            [
                m(killButton, { menu_idx: menu_idx }),

                m('div.menu-col.object-color', [
                    m('span', 'Show by id: '),
                    m('input[type=text]', {
                        placeholder: 'object ID',
                        style: { width: '50px' },
                        id: `${menu_idx}-object-id`
                    }),
                    m.trust('<span>&nbsp;&nbsp;</span>'),
                    m('input[type=button]', {
                        value: 'Submit',
                        onclick: e => {
                            // Will redraw in the called function.
                            e.redraw = false;
                            loadObjectInfo(
                                menu_idx,
                                byID(`${menu_idx}-object-id`).value
                            );
                        }
                    })]
                ),

                m('div.menu-col.object-color', {
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
                                    objectIDs,
                                    loadObjectInfo
                                )
                            }
                        }),
                        m('input[type=button]',
                            {
                                value: 'Next >>',
                                onclick: () => {
                                    showNextAbstract(
                                        menu_idx,
                                        objectIDs,
                                        loadObjectInfo
                                    )
                                }
                            })]
                ),

                // Search by name
                m('div.menu-row.object-color', [
                    m('span', 'Search by object name: '),
                    m(menuCacheMenu, {
                        menu_idx: menu_idx,
                        menuName: 'object-name-search-menu',
                        cacheFieldName: 'object',
                        filterDict: objectFilterDict,
                        filterFunction: (tuple, containerID) => {
                            let test = get(objectFilterDict, containerID, '').toLowerCase();
                            return String(tuple[1].name).toLowerCase().indexOf(test) >= 0;
                        },
                        divBuilderCallback: (tuple, containerID) => {
                            let button = document.createElement('div');
                            button.innerText = `${tuple[0]}: ${tuple[1].name}`;
                            button.classList.add('menu-button-value');
                            button.onclick = () => {
                                clfFilterDict[containerID] = '';
                                loadObjectInfo(menu_idx, tuple[0])
                            }
                            return button;
                        }
                    }),
                    m(menuCacheButton, {
                        menu_idx: menu_idx,
                        menuName: 'object-name-search-menu'
                    })
                ]),

                m('div.menu-row.object-color', [
                    m('span', { style: { 'font-weight': 'bold' } }, 'Object ID: '),
                    m('span', txt(menuArr[menu_idx].id))
                ]),

                m('div.menu-col.object-color',
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

                m('div.menu-col.object-color', [
                    m('span', `Location: ${getSubtreeTitleById(
                        locationThesaurus,
                        menuArr[menu_idx].description.location)
                    }`),
                    m('br'), m(locationMenu), m(locationSelectButton)]),

                m('div.menu-col.object-color', [
                    m('span', `Period (start): ${getSubtreeTitleById(
                        periodThesaurus,
                        menuArr[menu_idx].description.period_date_start)
                    }`),
                    m('br'), m(periodStartMenu), m(periodStartSelectButton)]),
                m('div.menu-col.object-color', [
                    m('span', `Period (end): ${getSubtreeTitleById(
                        periodThesaurus,
                        menuArr[menu_idx].description.period_date_end)
                    }`),
                    m('br'), m(periodEndMenu), m(periodEndSelectButton)]),

                m('div.menu-col.object-color', [
                    m('span', `Date (start): ${getSubtreeTitleById(
                        chronoThesaurus,
                        menuArr[menu_idx].description.chrono_date_start)
                    }`),
                    m('br'), m(chronoStartMenu), m(chronoStartSelectButton)]),
                m('div.menu-col.object-color', [
                    m('span', `Date (end): ${getSubtreeTitleById(
                        chronoThesaurus,
                        menuArr[menu_idx].description.chrono_date_end)
                    }`),
                    m('br'), m(chronoEndMenu), m(chronoEndSelectButton)]),

                m('div.menu-row.object-color', [
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

                m('div.menu-row.object-color', {
                    style: {
                        display: 'flex',
                        'justify-content': 'space-between'
                    }
                }, [
                    m('input[type=button]', {
                        value: 'Submit',
                        onclick: () => { submitObject(menu_idx) }
                    }),
                    m('input[type=button]', {
                        value: 'Delete',
                        onclick: () => { deleteObject(menu_idx) }
                    }),
                ])
            ]
        )
    }
};

function dictToData(dict) {
    let result = {
        column_names: [],
        payload: {}
    };
    for (const key in dict) {
        if (dict.hasOwnProperty(key)) {
            result.column_names.push(key);
            result.payload[key] = dict[key];
        }
    }
    return result;
}

async function submitObject(menu_idx) {
    if (menuArr[menu_idx].id === null) {
        // Create a new object
        const response = await fetch(`${dbAPIURL}/objects/add`, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            credentials: 'include',
            headers: {
                'Content-Type': 'text/plain'
            },
            redirect: 'follow',
            referrerPolicy: 'no-referrer',
            body: JSON.stringify(dictToData(menuArr[menu_idx].description))
        });
        if (!response.ok) {
            const message = await response.text();
            alert(`Failed to upload data to the server: ${message}`);
        } else {
            const result = await response.text();
            if (result.match(/^\d+$/))
                alert(`A new object was created on the server with the ID ${result}`);
            else
                alert(result);
        }
        await fetchObjects();
        m.redraw();
    } else {
        // Update existing object
        let dataToUpload = dictToData(menuArr[menu_idx].description);
        // A convention of the old API that we use here for simplicity: 'id' is the last column name.
        dataToUpload.column_names.push('id');
        dataToUpload.payload.id = menuArr[menu_idx].id;
        const response = await fetch(`${dbAPIURL}/objects/updaterecord`, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            credentials: 'include',
            headers: {
                'Content-Type': 'text/plain'
            },
            redirect: 'follow',
            referrerPolicy: 'no-referrer',
            body: JSON.stringify(dataToUpload)
        });
        if (!response.ok) {
            const message = await response.text();
            alert(`Failed to upload data to the server: ${message}`);
        } else {
            alert(`Update successful.`);
        }
        await fetchObjects();
        m.redraw();
    }
}

async function deleteObject(menu_idx) {
    if (!confirm('This action may be irreversible. Are you sure?'))
        return;

    const response = await fetch(`${dbAPIURL}/objects/deletebyid`, {
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
        alert(`Failed to delete the object: ${message}`);
    }
    else {
        const result = await response.text();
        alert(result);
        // Close the menu.
        killMenu(menu_idx);
        await fetchObjects();
        m.redraw();
    }
}