async function populateBiblioCache() {
    const response = await fetch(`${dbAPIURL}/bibliography/all`);
    if (!response.ok) {
        const error = await response.text();
        alert('Failed to download biblio info from the server: ' + error);
        return;
    }
    const data = await response.json();
    menu_data_cache.lemmaBasic.length = 0;
    for (const key in data) {
        if (!data.hasOwnProperty(key))
            continue;
        menu_data_cache.biblioAbbrevTitle.push([
            parseInt(key),
            {
                abbreviation: data[key].abbreviation,
                title: data[key].title
            }
        ])
    }
}

async function fetchBiblioEditorRecordAndRedraw(menu_idx, recordId) {
    const response = await fetch(`${dbAPIURL}/bibliography/recordbyid/${recordId}`);
    if (!response.ok) {
        const error = await response.text();
        alert('Failed to download biblio record from the server: ' + error);
        return;
    }
    const data = await response.json();
    console.log(data);
    menuArr[menu_idx] = {};
    menuArr[menu_idx].id = recordId;
    menuArr[menu_idx].abbreviation = data.abbreviation;
    const description = JSON.parse(data.bibtex);
    menuArr[menu_idx].entry_type = description.entry_type;
    if (menuArr[menu_idx].entry_type === 'book' && description.hasOwnProperty('editor'))
        menuArr[menu_idx].entry_type = 'book (edited)';
    // Initialise the description with a proper template.
    // Use the authored-book template by default.
    menuArr[menu_idx].description = getFields(
        get(
            templateLookupTable,
            description.entry_type,
            bibtexBookTemplateAuthor));
    Object.entries(description).forEach(tuple => {
        menuArr[menu_idx].description[tuple[0]] = tuple[1]
    });
    m.redraw();
}

function normaliseBibEntryType(internalType) {
    switch (internalType) {
        case 'book':
            return 'book';
        case 'book (edited)':
            return 'book';
        case 'article':
            return 'article';
        case 'chapter':
            return 'incollection';
        case 'thesis':
            return 'phdthesis';
        default:
            throw `Unknown type: ${internalType}`;
    }
}

async function biblioEditorSubmit(menu_idx) {
    if (!validateBibData(menu_idx))
        return;
    let bibtex_data = copy(menuArr[menu_idx].description);
    console.log(bibtex_data);
    bibtex_data.entry_type = normaliseBibEntryType(menuArr[menu_idx].entry_type);
    let biblioRequestURL;
    if (menuArr[menu_idx].id === null) {
        biblioRequestURL = `${dbAPIURL}/bibliography/add`;
    }
    else {
        biblioRequestURL = `${dbAPIURL}/bibliography/updatebyid/${menuArr[menu_idx].id}`;
    }
    const body = JSON.stringify({
        abbreviation: menuArr[menu_idx].abbreviation,
        bibtex_json: JSON.stringify(bibtex_data),
        project_type: projectType
    });
    console.log(body);
    const response = await fetch(biblioRequestURL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain'
        },
        mode: 'cors',
        body: body,
        credentials: testing ? 'omit' : 'include'
    });
    if (!response.ok) {
        const error = await response.text();
        alert(`Failed to update the data on the server: ${error}`);
        return;
    }
    alert('Update successful.');
}
