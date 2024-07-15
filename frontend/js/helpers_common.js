let typingTimeout = null;

// const jseshURL = 'https://www.iclassifier.pw/api/jseshrender/?height=32&mdc=';
const jseshURL = 'https://iclassifier.click/jsesh?height=32&mdc=';

function byID(id) {
    return document.getElementById(id);
}

function copy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function txt(value) {
    if (value === null)
        return '---';
    else
        return value;
}

function startswith(str, prefix) {
    if (prefix.length > str.length)
        return false;

    const p_length = prefix.length;
    for (let i = 0; i < p_length; i++) {
        if (str.charAt(i) !== prefix.charAt(i))
            return false;
    }
    return true;
}

function getCookieByName(cookieName) {
    const cookieString = decodeURIComponent(document.cookie),
        cookiePairs = cookieString.split(';');
    for (const cp of cookiePairs) {
        const fields = cp.trim().split('=');
        if (fields[0] === cookieName)
            return fields[1];
    }
    return '';
}

/**
 * For printing the contents of the first menu item in the console.
 * It doesn't shorten long lines: be careful of picture data.
 */
function pprint() {
    console.log(JSON.stringify(menuArr[0], '', 2));
}

/**
 * Returns a copy of the array with the element at position idx removed.
 * @param array
 * @param idx
 */
function drop(array, idx) {
    return array
        .slice(0, idx)
        .concat(array.slice(idx + 1));
}

/**
 * Checks whether a set represented as a semicolon-separated string
 * has a particular value.
 */
function hasSubValue(valueString, testString) {
    if (valueString === null)
        return false;
    let values = new Set(valueString.split(';'));
    return values.has(testString);
}

/**
 * Adds a value to or removes it from a set represented as a semicolon-separated string.
 */
function toggleSubValue(valueString, inputString, add) {
    valueString = valueString === null ? '' : valueString;
    let values = new Set(valueString.split(';'));
    if (add) {
        values.add(inputString);
    } else {
        values.delete(inputString);
    }
    return Array.from(values).join(';');
}

function killMenu(menu_idx) {
    menuArr = drop(menuArr, menu_idx);
    menuTypeArray = drop(menuTypeArray, menu_idx);
    projectTypeArray = drop(projectTypeArray, menu_idx);
}

let killButton = {
    view: vnode => {
        let menu_idx = vnode.attrs.menu_idx;
        return m('div.menu-row', {
            style: {
                'background-color': 'white',
                display: 'flex',
                'justify-content': 'flex-end'
            }
        },
            m('input[type=button].kill-menu', {
                value: 'X',
                onclick: () => { killMenu(menu_idx); }
            })
        );
    }
};

function showPreviousAbstract(menu_idx, id_array, callback) {
    if (id_array.length === 0)
        return;
    const current_id = parseInt(menuArr[menu_idx].id);
    let next_idx;
    if (current_id === null)
        next_idx = id_array.length - 1;
    else {
        const id_idx = id_array.indexOf(current_id);
        if (id_idx <= 0)
            next_idx = id_array.length - 1;
        else
            next_idx = id_idx - 1;
    }
    menuArr[menu_idx].id = id_array[next_idx];
    callback(menu_idx, id_array[next_idx]);
}

function showNextAbstract(menu_idx, id_array, callback) {
    if (id_array.length === 0)
        return;
    const current_id = parseInt(menuArr[menu_idx].id);
    let next_idx;
    if (current_id === null)
        next_idx = 0;
    else {
        const id_idx = id_array.indexOf(current_id);
        if (id_idx < 0 || id_idx === id_array.length - 1)
            next_idx = 0;
        else
            next_idx = id_idx + 1;
    }
    menuArr[menu_idx].id = id_array[next_idx];
    callback(menu_idx, id_array[next_idx]);
}

//
// A shared component builder for entity lists
//
function getListButton(entityName, callback) {
    return {
        view: (vnode) => {
            let menu_idx = vnode.attrs.menu_idx;
            return m('input[type=button]',
                {
                    value: `Choose ${entityName}`,
                    onclick: () => {
                        menuArr[menu_idx].menu_switches[entityName] = true;
                        // Fetch new data and redraw if they are different.
                        // If new data are added continuously on the server
                        // the component may never stop redrawing, but this is
                        // an unlikely scenario. Can prohibit more than, say,
                        // 3 consecutive redraws in that case.
                        callback(menu_idx);
                    }
                });
        }
    }
}

function createListChoiceComponent(name, filterFunction, spanBuilderFactory) {
    return {
        view: (vnode) => {
            let menu_idx = vnode.attrs.menu_idx;
            let new_name;
            if (name === 'demotic_source' || name === 'coptic_source')
                new_name = 'biblio';
            else
                new_name = name;
            return m('div.menu-row', [
                m('span', 'Filter the list: '),
                m('input[type=text]', {
                    class: projectType,
                    value: menuArr[menu_idx].menu_data[`${name}_filter`],
                    oninput: e => {
                        e.redraw = false;
                        menuArr[menu_idx].menu_data[
                            `${name}_filter`
                        ] = e.target.value;
                        if (menuArr[menu_idx]
                            .menu_timeouts[`${name}_filter`] === undefined
                        ) {
                            menuArr[menu_idx]
                                .menu_timeouts[`${name}_filter`] = null;
                        }
                        clearTimeout(
                            menuArr[menu_idx].menu_timeouts[`${name}_filter`]
                        );
                        menuArr[menu_idx]
                            .menu_timeouts[`${name}_filter`] = setTimeout(
                                () => { m.redraw(); }, 1000
                            );
                    }
                }),
                m('input[type=button]', {
                    value: 'Hide menu',
                    style: { 'margin-left': '10px' },
                    onclick: () => { menuArr[menu_idx].menu_switches[name] = false }
                }),
                menu_data_cache[new_name].length === 0 ? m('div.select-list', 'Fetching data...') :
                    m('div.select-list', menu_data_cache[new_name]
                        .filter((value) => filterFunction(value, menu_idx))
                        .map(spanBuilderFactory(menu_idx)))
            ]);
        }
    };
}

let biblioChoiceComponent = createListChoiceComponent(
    'biblio',
    biblioFilter,
    biblioSpanBuilderFactory);

//
// Fetching data for list-selection menus
//
function fetchDataAndRedrawGenerator(URLSuffix, dataKey, dataName) {
    return () => {
        fetch(`${dbAPIURL}/${URLSuffix}`)
            .then(response => {
                if (!response.ok)
                    alert(`Failed to fetch ${dataName} from the server.`);
                else
                    return response.json()
            })
            .then(data => {
                // Check that keys have been added or deleted.
                if (newIDsAdded(data, menu_data_cache[dataKey])) {
                    // Repopulate the cache and redraw.
                    // Sort the keys first.
                    let IDTmp = [];
                    for (const key in data) {
                        if (!data.hasOwnProperty(key))
                            continue;
                        IDTmp.push(key);
                    }
                    IDTmp.sort(cmpInts);
                    menu_data_cache[dataKey] = [];
                    for (const ID of IDTmp)
                        menu_data_cache[dataKey].push([
                            ID, data[ID]
                        ]);
                    m.redraw();
                }
            });
    }
}

let fetchLemmasAndRedraw = fetchDataAndRedrawGenerator(
    'lemmas/all',
    'lemma',
    'lemmas');
let fetchSupertextsAndRedraw = fetchDataAndRedrawGenerator(
    'texts/all',
    'supertext',
    'supertexts');
let fetchWitnessesAndRedraw = fetchDataAndRedrawGenerator(
    'witnesses/all',
    'witness',
    'witnesses');
let fetchBiblioAndRedraw = fetchDataAndRedrawGenerator(
    'bibliography/all',
    'biblio',
    'bibliographical references');

/**
 * Cache entries are sorted by the integer value
 * of their first element.
 */
function binarySearchOnCache(field_name, key) {
    // Because of weird data mismatches we need to
    // at least temporarily use linear search here.
    let array = menu_data_cache[field_name];
    if (array.length === 0) {
        // alert(`${field_name} cache is empty.`);
        return null;
    }
    for (const cache_element of array) {
        if (parseInt(cache_element[0]) === key) {
            return cache_element[1];
        }
    }
    return null;

    // let hi = array.length - 1,
    //     lo = 0,
    //     idx, test;

    // while (true) {
    //     if (hi < lo) {
    //         return null;
    //     }
    //     idx = Math.floor((lo + hi) / 2)
    //     test = parseInt(array[idx][0]);
    //     if (test === key)
    //         return array[idx][1];
    //     else if (key > test) {
    //         lo = idx + 1;
    //     } else {
    //         hi = idx - 1;
    //     }
    // }
}


// TODO: update when the new biblio server is up
function biblioFilter(value, menu_idx) {
    return String(value[1]['abbreviation'])
        .toLowerCase()
        .indexOf(menuArr[menu_idx].menu_data[`biblio_filter`].toLowerCase()) >= 0 ||
        String(value[1]['title'])
            .toLowerCase()
            .indexOf(menuArr[menu_idx].menu_data[`biblio_filter`].toLowerCase()) >= 0;
}

function biblioFilterFactory(field) {
    return (value, menu_idx) => {
        return String(value[1]['abbreviation'])
            .toLowerCase()
            .indexOf(menuArr[menu_idx].menu_data[field].toLowerCase()) >= 0 ||
            String(value[1]['title'])
                .toLowerCase()
                .indexOf(menuArr[menu_idx].menu_data[field].toLowerCase()) >= 0;
    }
}


function biblioSpanBuilderFactory(menu_idx) {
    return (value) => m(
        'span.list-element',
        {
            onclick: () => {
                menuArr[menu_idx].biblio_tmp.source_id = value[0];
                if (value[1]['abbreviation'] !== '')
                    menuArr[menu_idx].biblio_tmp.source_abbrev = value[1]['abbreviation'];
                else
                    menuArr[menu_idx].biblio_tmp.source_abbrev = null;
                menuArr[menu_idx].biblio_tmp.source_name = value[1]['title'];
            }
        },
        value[1]['abbreviation'] !== null && value[1]['abbreviation'] !== '' ?
            value[1]['abbreviation'] :
            value[1]['title']
    );
}

// A JS version of Python's "get" method for dicts.
function get(dict, key, plug) {
    if (dict.hasOwnProperty(key))
        return dict[key];
    else
        return plug;
}

// Lemma-transliteration converter
function convertToUnicode(input) {
    var charMap = {
        '!': 'H',
        '#': 'Ḫ',
        '$': 'H̱',
        '%': 'S',
        '*': 'Ṯ',
        '+': 'Ḏ',
        '=': "⸗",
        '@': 'Ḥ',
        'A': "ꜣ",
        '&': 'T',
        'C': "Ś",
        'D': 'ḏ',
        'H': 'ḥ',
        'I': "I͗",
        'O': 'Q',
        'Q': "Ḳ",
        'S': 'š',
        'T': 'ṯ',
        'V': 'h̭',
        'X': 'ẖ',
        '^': 'Š',
        '_': 'D',
        'a': "ꜥ",
        'c': "ś",
        'i': "i͗",
        'o': 'q',
        'q': "ḳ",
        'v': 'ṱ',
        'x': 'ḫ'
    };
    return input.split('')
        .map(function (c) { return get(charMap, c, c); })
        .join('');
}

/**
 * Returns the abbreviated name of a publication when available
 * or the full title otherwise.
 */
function getPublicationTitle(pubData) {
    if (pubData.abbreviation !== '' && pubData.abbreviation !== null)
        return pubData.abbreviation;
    else
        return pubData.title;
}

function getPublicationTitleFromID(pubId) {
    if (pubId === null)
        return 'not set';
    pubInfo = binarySearchOnCache('biblio', pubId);
    return getTitleFromPubInfo(pubInfo, pubId);
}

/**
 * A higher-order function to generate oninput handlers.
 * Parameterised by the ref to the object to be mutated and
 * the name of the field.
 */
function setFieldNoRedrawHandler(obj, field) {
    return e => {
        e.redraw = false;
        obj[field] = e.target.value === '' ? null : e.target.value;
    }
}

function fetchIDs(table_name, data_name, id_list) {
    fetch(`${dbAPIURL}/${table_name}/ids`)
        .then(response => {
            if (!response.ok)
                alert(`Failed to download ${data_name} info from the server.`);
            else
                return response.json();
        })
        .then(data => {
            id_list.length = 0;
            for (const id of data)
                id_list.push(id);
            id_list.sort(cmpInts);
        });
}

async function getJSONFromURL(url) {
    const response = await fetch(url);
    if (!response.ok) {
        alert('Failed to download data from URL: ' + url);
        return null;
    }
    const data = await response.json();
    return copy(data);
}

function showDownloadDiv(dataType) {
    byID('overlay-download').innerText = `Downloading ${dataType}...`;
    byID('overlay-download').style.display = 'flex';
}

function hideDownloadDiv() {
    byID('overlay-download').style.display = 'none';
}

/**
 * Converts empty values to 'not set' for
 * current-value labels.
 */
function v(val) {
    if (val === null || val === undefined || val === '')
        return 'not set';
    else
        return val;
}

/**
 * Converts empty strings to null.
 */
function n(str) {
    if (str === '')
        return null;
    else
        return str;
}

function cmpStr(a, b) {
    if (a < b)
        return -1;
    else if (a > b)
        return 1;
    else
        return 0;
}

function cmpInts(a, b) {
    let aInt = parseInt(a),
        bInt = parseInt(b);
    if (aInt < bInt)
        return -1;
    else if (aInt > bInt)
        return 1;
    else
        return 0;
}

let menuCacheMenu = {
    oncreate: vnode => {
        const menu_idx = vnode.attrs.menu_idx,
            menuName = vnode.attrs.menuName,
            cacheFieldName = vnode.attrs.cacheFieldName,
            filterFunction = vnode.attrs.filterFunction,
            divBuilderCallback = vnode.attrs.divBuilderCallback;

        populateContainerMenu(
            getContainerID(menu_idx, menuName),
            cacheFieldName,
            filterFunction,
            divBuilderCallback
        );
    },

    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx,
            menuName = vnode.attrs.menuName,
            cacheFieldName = vnode.attrs.cacheFieldName,
            filterDict = vnode.attrs.filterDict,
            filterFunction = vnode.attrs.filterFunction,
            divBuilderCallback = vnode.attrs.divBuilderCallback;

        const menuID = getMenuID(menu_idx, menuName),
            containerID = getContainerID(menu_idx, menuName);
        return m(
            'div.menu-wrapper',
            {
                id: menuID,
                style: { display: 'none', width: '350px' }
            },
            [
                m('div.float_menu_header', m('input[type=button]', {
                    value: '✕',
                    onclick: () => {
                        byID(menuID).style.display = 'none'
                    }
                })),
                m('div.inner-menu', m('input[type=text]', {
                    placeholder: 'Filter the list...',
                    oninput: e => {
                        e.redraw = false;
                        filterDict[containerID] = e.target.value;
                        populateContainerMenu(
                            containerID,
                            cacheFieldName,
                            filterFunction,
                            divBuilderCallback);
                    },
                    onclick: e => {
                        e.redraw = false;
                        filterDict[containerID] = e.target.value;
                        populateContainerMenu(
                            containerID,
                            cacheFieldName,
                            filterFunction,
                            divBuilderCallback);
                    },
                    style: { width: '240px' }
                })),
                m('div.inner-menu', {
                    id: containerID
                })
            ]
        )
    }
};

function getContainerID(menu_idx, menuName) {
    return `${menu_idx}-${menuName}-cache-menu-container`;
}

function getMenuID(menu_idx, menuName) {
    return `${menu_idx}-${menuName}-cache-menu`;
}

function populateContainerMenu(
    containerID,
    cacheFieldName,
    filterFunction,
    divBuilderCallback
) {
    let data = menu_data_cache[cacheFieldName];
    if (data === undefined) {
        alert('Wrong cache type: ' + cacheFieldName);
        return;
    } else if (data.length === 0) {
        // alert(`${cacheFieldName} cache is empty.`);
        return;
    }
    byID(containerID).innerHTML = '';
    data = data.filter(tuple => filterFunction(tuple, containerID));
    for (const tuple of data) {
        byID(containerID).appendChild(
            divBuilderCallback(tuple, containerID)
        );
    }
}

/**
 * Shows the menu identified by id.
 */
let menuCacheButton = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx,
            menuName = vnode.attrs.menuName;

        return m('input[type=button]', {
            value: 'Select',
            onclick: e => {
                e.redraw = false;
                const x = e.clientX,
                    y = e.clientY;
                const id = `${menu_idx}-${menuName}-cache-menu`;
                byID(id).style.display = 'grid';
                byID(id).style.position = 'fixed';
                byID(id).style.left = x + 'px';
                byID(id).style.top = y + 'px';
            }
        })
    }
}