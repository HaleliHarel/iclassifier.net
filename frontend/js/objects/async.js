let objectInfo = null;

async function fetchObjects() {
    const response = await fetch(`${dbAPIURL}/objects/all`);
    if (!response.ok)
        alert('Failed to download object info from the server.');
    else {
        const data = await response.json();
        objectInfo = JSON.parse(JSON.stringify(data));
    }

    // Add object info to the menu cache
    menu_data_cache['object'] = [];
    for (const key in objectInfo) {
        if (!objectInfo.hasOwnProperty(key))
            continue;
        menu_data_cache['object'].push([key, {name: objectInfo[key].name}]);
    }
}

async function loadObjectInfo(menu_idx, id) {
    let response = await fetch(`${dbAPIURL}/objects/byid?id=${id}`);
    if (!response.ok) {
        alert('Failed to download object info from the server.');
        return;
    }
    const objectInfo = await response.json();
    if (JSON.stringify(objectInfo) === JSON.stringify({})) {
        alert(`No object with id ${id} found on the server.`);
        return;
    }
    menuArr[menu_idx] = copy(objectInfoTemplate);
    menuArr[menu_idx].id = id;
    for (const fieldName in objectInfoTemplate.description) {
        if (!objectInfoTemplate
            .description
            .hasOwnProperty(fieldName))
            continue;
        menuArr[menu_idx]
            .description[fieldName] = objectInfo[fieldName] !== '' ? objectInfo[fieldName] : null;
    }
    m.redraw();
}

let objectIDs = [];
let fetchObjectIDs = () => { fetchIDs('objects', 'object', objectIDs); }
