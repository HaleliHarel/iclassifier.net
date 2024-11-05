let supertextInfo = null;

async function fetchSupertexts() {
    const response = await fetch(`${dbAPIURL}/texts/all`);
    if (!response.ok)
        alert('Failed to download supertext info from the server.');
    else {
        const data = await response.json();
        supertextInfo = JSON.parse(JSON.stringify(data));
    }
}

async function populateSupertextCache() {
    const response = await fetch(`${dbAPIURL}/texts/all`);
    if (!response.ok) {
        alert('Failed to download supertext info from the server.');
        return;
    }
    const data = await response.json();
    menu_data_cache.supertext.length = 0;
    for (const key in data) {
        if (!data.hasOwnProperty(key))
            continue;
        menu_data_cache.supertext.push([
            parseInt(key),
            copy(data[key])
        ])
    }
}