// Thesauri may be structured differently based on the
// project.
let scriptThesaurus = null,
    genreThesaurus = null,
    objectTypeThesaurus = null,
    periodThesaurus = null,
    chronoThesaurus = null,
    locationThesaurus = null;

let witnessIDs = [];
let fetchWitnessIDs = () => { fetchIDs('witnesses', 'witness', witnessIDs); }

async function downloadThesauri() {
    scriptThesaurus = null;
    genreThesaurus = null;
    objectTypeThesaurus = null;
    periodThesaurus = null;
    chronoThesaurus = null;
    locationThesaurus = null;

    switch (projectType) {
        case 'hieroglyphic':
            downloadThesauriEgyptian();
            break;
        case 'cuneiform':
            downloadThesauriCuneiform();
            break;
        case 'chinese':
            downloadThesauriChinese();
            break;
        default:
            break;
    }
}

async function downloadThesauriEgyptian() {
    // if (testing) {
    //     scriptThesaurus = await getJSONFromURL('http://127.0.0.1:30000/egyptian/scripts.json');
    //     genreThesaurus = await getJSONFromURL('http://127.0.0.1:30000/egyptian/genres.json');
    //     objectTypeThesaurus = await getJSONFromURL('http://127.0.0.1:30000/egyptian/object-types.json');
    //     periodThesaurus = await getJSONFromURL('http://127.0.0.1:30000/egyptian/dating-periods.json');
    //     chronoThesaurus = await getJSONFromURL('http://127.0.0.1:30000/egyptian/dating-chrono.json');
    //     locationThesaurus = await getJSONFromURL('http://127.0.0.1:30000/egyptian/location.json');
    // }
    // else {

    // scriptThesaurus = await getJSONFromURL('https://www.iclassifier.pw/static/iclthesauri/egyptian/scripts.json');
    // genreThesaurus = await getJSONFromURL('https://www.iclassifier.pw/static/iclthesauri/egyptian/genres.json');
    // objectTypeThesaurus = await getJSONFromURL('https://www.iclassifier.pw/static/iclthesauri/egyptian/object-types.json');
    // periodThesaurus = await getJSONFromURL('https://www.iclassifier.pw/static/iclthesauri/egyptian/dating-periods.json');
    // chronoThesaurus = await getJSONFromURL('https://www.iclassifier.pw/static/iclthesauri/egyptian/dating-chrono.json');
    // locationThesaurus = await getJSONFromURL('https://www.iclassifier.pw/static/iclthesauri/egyptian/location.json');

    scriptThesaurus = await getJSONFromURL('https://iclassifier.pw/static/thesauri/egyptian/scripts.json');
    genreThesaurus = await getJSONFromURL('https://iclassifier.pw/static/thesauri/egyptian/genres.json');
    objectTypeThesaurus = await getJSONFromURL('https://iclassifier.pw/static/thesauri/egyptian/object-types.json');
    periodThesaurus = await getJSONFromURL('https://iclassifier.pw/static/thesauri/egyptian/dating-periods.json');
    chronoThesaurus = await getJSONFromURL('https://iclassifier.pw/static/thesauri/egyptian/dating-chrono.json');
    locationThesaurus = await getJSONFromURL('https://iclassifier.pw/static/thesauri/egyptian/location.json');
    scriptThesaurus = await getJSONFromURL('https://iclassifier.pw/static/thesauri/egyptian/scripts.json');
    genreThesaurus = await getJSONFromURL('https://iclassifier.pw/static/thesauri/egyptian/genres.json');
    objectTypeThesaurus = await getJSONFromURL('https://iclassifier.pw/static/thesauri/egyptian/object-types.json');
    periodThesaurus = await getJSONFromURL('https://iclassifier.pw/static/thesauri/egyptian/dating-periods.json');
    chronoThesaurus = await getJSONFromURL('https://iclassifier.pw/static/thesauri/egyptian/dating-chrono.json');
    locationThesaurus = await getJSONFromURL('https://iclassifier.pw/static/thesauri/egyptian/location.json');
    // }
}

async function downloadThesauriCuneiform() { }

async function downloadThesauriChinese() {
    scriptThesaurus = await getJSONFromURL('https://iclassifier.pw/static/thesauri/chinese/scripts.json');
    genreThesaurus = await getJSONFromURL('https://iclassifier.pw/static/thesauri/chinese/genres.json');

    // scriptThesaurus = await getJSONFromURL('https://iclassifier.click/static/thesauri/chinese/scripts.json');
    // genreThesaurus = await getJSONFromURL('https://iclassifier.click/static/thesauri/chinese/genres.json');
}

async function loadWitnessInfo(menu_idx, id) {
    let response = await fetch(`${dbAPIURL}/witnesses/byid?id=${id}`);
    if (!response.ok) {
        alert('Failed to download witness info from the server.');
        return;
    }
    const witnessInfo = await response.json();
    if (JSON.stringify(witnessInfo) === JSON.stringify({})) {
        alert(`No witness with id ${id} found on the server.`);
        return;
    }

    menuArr[menu_idx] = copy(witnessInfoTemplate);

    menuArr[menu_idx].id = id;
    for (const fieldName in witnessInfoTemplate.description) {
        if (!witnessInfoTemplate
            .description
            .hasOwnProperty(fieldName))
            continue;
        menuArr[menu_idx]
            .description[fieldName] = witnessInfo[fieldName] !== '' ?
                witnessInfo[fieldName] : null;
    }

    // Load the object id and additional info from TLA
    response = await fetch(`${dbAPIURL}/witness_tla_info/byforeignid?foreign_key=witness_id&foreign_key_id=${id}`);
    if (!response.ok) {
        alert('Failed to download witness TLA info from the server.');
        return;
    }
    const witnessTLAInfo = await response.json();
    for (const infoBundleId in witnessTLAInfo) {
        if (!witnessTLAInfo.hasOwnProperty(infoBundleId))
            continue;
        let infoBundle = witnessTLAInfo[infoBundleId];
        menuArr[menu_idx].object_and_tla_data.object_id = infoBundle.object_id;
        menuArr[menu_idx].object_and_tla_data.tla_data = infoBundle.tla_data;
        break;
    }

    // Load biblio references
    response = await fetch(`${dbAPIURL}/witness_biblio/byforeignid?foreign_key=witness_id&foreign_key_id=${id}`);
    if (!response.ok) {
        alert('Failed to download witness biblio references from the server.');
        return;
    }
    const witnessBiblioRefs = await response.json();
    for (const bibKey in witnessBiblioRefs) {
        if (!witnessBiblioRefs.hasOwnProperty(bibKey))
            continue;
        let ref = copy(witnessBiblioRefTemplate);
        ref.id = parseInt(bibKey);
        for (const fieldName in ref.description) {
            if (!ref.description.hasOwnProperty(fieldName))
                continue;
            ref.description[fieldName] = witnessBiblioRefs[bibKey][fieldName];
        }
        menuArr[menu_idx].biblio_refs.push(ref);
    }

    // Load pictures
    response = await fetch(`${dbAPIURL}/witness_pictures/byforeignid?foreign_key=witness_id&foreign_key_id=${id}`);
    if (!response.ok) {
        alert('Failed to download witness pictures from the server.');
        return;
    }
    const witnessPics = await response.json();
    for (const picKey in witnessPics) {
        if (!witnessPics.hasOwnProperty(picKey))
            continue;
        let pic = copy(witnessPictureInfoTemplate);
        pic.id = parseInt(picKey);
        for (const fieldName in pic.description) {
            if (!pic.description.hasOwnProperty(fieldName))
                continue;
            pic.description[fieldName] = witnessPics[picKey][fieldName];
        }
        menuArr[menu_idx].pictures.push(pic);
    }

    m.redraw();
}

async function populateWitnessCache() {
    const response = await fetch(`${dbAPIURL}/witnesses/all`);
    if (!response.ok) {
        alert('Failed to download witness info from the server.');
        return;
    }
    const data = await response.json();
    menu_data_cache.witness.length = 0;
    for (const key in data) {
        if (!data.hasOwnProperty(key))
            continue;
        menu_data_cache.witness.push([
            parseInt(key),
            copy(data[key])
        ])
    }
}