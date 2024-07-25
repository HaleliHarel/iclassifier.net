let clfCounts = {},
    lemmasForClfs = {};

let POSSet = new Set();

let selectStyleQuery = { width: '150px' },
    selectLabelStyle = {
        'display': 'inline-block',
        'width': '100px'
    };

let clfQueries = {
    clfType: 'any',
    clfLevel: 'any',
    semRelation: 'any',
    tokenType: 'any',
    pos: 'any',
    witnessId: 'any',
    script: 'any',
    genre: 'any',
    period: 'any',
    dateFrom: 'any',
    dateTo: 'any',
    table: null,
    oncreate: () => {
        clfQueries.table = getTable(byID('table-wrapper'));
        if (projectType === 'hieroglyphic')
            getGlyphs();
    },
    onupdate: () => {
        console.log('Update initiated');
        populateClfDict();
        if (clfQueries.table !== null)
            clfQueries.table.destroy();
        clfQueries.table = getTable(byID('table-wrapper'));
        if (projectType === 'hieroglyphic')
            getGlyphs();
    },
    view: () => {
        return m(
            'div',
            {
                style: {
                    display: showClfQueries ? 'block' : 'none',
                    'padding-top': '0'
                }
            },
            [
                m('h3', 'Subset by'),
                m('h4', { style: selectLabelStyle }, 'Level'),
                arr2Select(clfLevelArr, selectStyleQuery, e => {
                    clfQueries.clfLevel = e.target.value;
                }),
                m('br'),
                m('h4', { style: selectLabelStyle }, 'Type'),
                arr2Select(clfTypeArr, selectStyleQuery, e => {
                    clfQueries.clfType = e.target.value;
                }),
                m('br'),
                m('h4', { style: selectLabelStyle }, 'Part of speech'),
                arr2checkboxes(POSArr, POSSet),
                m('br'),
                m('h4', { style: selectLabelStyle }, 'Script'),
                getSelectFromThesaurus('scripts', selectStyle, e => {
                    clfQueries.script = e.target.value;
                }),
                m('br'),
                m('h4', { style: selectLabelStyle }, 'Genre'),
                getSelectFromThesaurus('genres', selectStyle, e => {
                    clfQueries.genre = e.target.value;
                }),

                m('br'),
                m('br'),
                m(witnessSelectComponent, { styleDict: { width: '640px' } }),
                m('br'),
                m('input[type=button]', {
                    value: 'Apply witness selection',
                    onclick: () => { 
                        // getClfReport(byID('classifier-report-select').value) 
                        if (selectedWitnesses.size !== 0) {
                            clfQueries.witnessId = Array.from(selectedWitnesses).join(' ');
                        } else {
                            clfQueries.witnessId = 'any';
                        }
                    }
                }),

                // m('br'),
                // m('h4', `${getTypes(clfCounts)} classifier types and ${getTokens(clfCounts)} classifier tokens`),
                // m('br'),
                // m('div', {style: {
                //     width: '640px',
                //     height: '480px',
                //     padding: '4px',
                //     'background-color': 'white',
                //     border: '1px solid black',
                //     overflow: 'auto'
                // }}, extractSpans(clfCounts)),
                m('br'),
                m('h4', 'Classifier table'),
                m('br'),
                m('div#table-wrapper')
            ]
        )
    }
}

function getTypes(counter) {
    let result = 0;
    for (const k in counter)
        if (counter.hasOwnProperty(k))
            result++;
    return result;
}

function getTokens(counter) {
    let result = 0;
    for (const k in counter)
        if (counter.hasOwnProperty(k))
            result += counter[k];
    return result;
}

function getClfReportLink(clf) {
    return `<a href="https://www.iclassifier.pw/reports/#!${project}/classifiers/${clf}" target="_blank">${clf}</a>`
}

function getRows(counter) {
    let result = [];
    for (const key in counter)
        if (counter.hasOwnProperty(key))
            result.push(
                projectType === 'hieroglyphic' ?
                    {
                        // TODO: make this work again
                        // translit: getClfReportLink(key),
                        translit: key,
                        mdc: key,
                        lemmaCount: lemmasForClfs.hasOwnProperty(key) ? lemmasForClfs[key].size : 0,
                        tokenCount: counter[key]
                    } :
                    {
                        // TODO: make this work again
                        // translit: getClfReportLink(key),
                        translit: key,
                        lemmaCount: lemmasForClfs.hasOwnProperty(key) ? lemmasForClfs[key].size : 0,
                        tokenCount: counter[key]
                    });
    result.sort((a, b) => {
        // Sort by the number of lemmas
        if (a.lemmaCount > b.lemmaCount)
            return -1;
        else if (a.lemmaCount < b.lemmaCount)
            return 1;
        else
            return 0;
    });
    return result;
}

function extractSpans(counter) {
    let result = getRows(counter);
    return result.map(el => m(
        'span.clf-span',
        {
            style: {
                padding: '2px',
                margin: '2px',
                border: '1px dotted black',
                'border-radius': '2px',
                'background-color': '#ffeecc',
                display: 'inline-block'
            },
            onclick: () => {
                getClfReport(el[0]);
                toggleClfReport(el[0]);
            }
        },
        `${el.translit}: ${el.tokenCount}`));
}

function getTable(container) {
    return new Handsontable(container, {
        licenseKey: 'non-commercial-and-evaluation',
        data: getRows(clfCounts),
        colHeaders: projectType === 'hieroglyphic' ?
            ['Transliteration', 'Glyph', 'No. lemmas', 'No. tokens'] :
            ['Transliteration', 'No. lemmas', 'No. tokens'],
        editor: false,
        rowHeaders: false,
        filters: true,
        dropdownMenu: [
            'filter_by_condition',
            'filter_by_value',
            'filter_action_bar'
        ],
        columns: projectType === 'hieroglyphic' ?
            [{ data: 'translit', renderer: 'html' }, { data: 'mdc', renderer: mdcRenderer }, { data: 'lemmaCount', type: 'numeric' }, { data: 'tokenCount', type: 'numeric' }] :
            [{ data: 'translit', renderer: 'html' }, { data: 'lemmaCount', type: 'numeric' }, { data: 'tokenCount', type: 'numeric' }],
        columnSorting: true
    });
}

let base64Cache = {};

function getGlyphs() {
    if (projectType !== 'hieroglyphic')
        return;
    for (const key in clfCounts)
        if (clfCounts.hasOwnProperty(key) && !base64Cache.hasOwnProperty(key))
            getBase64(key);
}

async function getBase64(key) {
    const response = await fetch(`https://iclassifier.click/jsesh/?height=20&centered=true&mdc=${key}`);
    if (!response.ok)
        return;
    const data = await response.text();
    base64Cache[key] = data;
    try {
        byID(key).src = 'data:image/png;base64,' + data;
    } catch { }
}

function mdcRenderer(instance, td, row, col, prop, value, cellProperties) {
    while (td.firstChild) {
        td.removeChild(td.firstChild);
    }

    let imgNode = document.createElement('img');
    imgNode.id = value;
    imgNode.alt = value;
    if (base64Cache.hasOwnProperty(value))
        imgNode.src = 'data:image/png;base64,' + base64Cache[value];
    td.append(imgNode);
}