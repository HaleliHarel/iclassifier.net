async function prepareClfList() {
    let allClassifiers = new Set();

    // 1. Download annotated classifiers from the server.
    let response = await fetch(`${dbAPIURL}/clf_comments/all`);
    if (!response.ok) {
        const error = await response.text();
        alert(`Failed to download classifier comments from the server: ${error}`);
        return;
    }
    let data = await response.json();
    for (const key in data)
        if (data.hasOwnProperty(key))
            allClassifiers.add(data[key].clf);

    response = await fetch(`${dbAPIURL}/clf_meanings/all`);
    if (!response.ok) {
        const error = await response.text();
        alert(`Failed to download classifier meanings from the server: ${error}`);
        return;
    }
    data = await response.json();
    let clfMeaningDict = {};
    for (const key in data) {
        if (!data.hasOwnProperty(key)) {
            continue;
        }
        // Concatenate meanings as a string
        if (clfMeaningDict.hasOwnProperty(data[key].clf)) {
            // Inefficient but okay for our case
            clfMeaningDict[data[key].clf] += `, ${data[key].meaning}`;
        } else {
            clfMeaningDict[data[key].clf] = data[key].meaning;
        }
        allClassifiers.add(data[key].clf);
    }

    // 2. Add classifiers from the tokens to the list.
    response = await fetch(`${dbAPIURL}/tokens/all`);
    if (!response.ok) {
        const error = await response.text();
        alert(`Failed to download tokens from the server: ${error}`);
        return;
    }
    data = await response.json();
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            for (const clf of extractClfs(data[key].mdc_w_markup === null ? '' : data[key].mdc_w_markup)) {
                allClassifiers.add(clf);
            }
        }
    }

    let classifierArray = [];
    allClassifiers.forEach(clf => {
        if (clfMeaningDict.hasOwnProperty(clf)) {
            classifierArray.push(`${clf}: ${clfMeaningDict[clf]}`);
        } else {
            classifierArray.push(clf);
        }
    });
    menu_data_cache.classifiers = classifierArray;
    menu_data_cache.classifiers.sort((a, b) => {
        if (a.toLowerCase() < b.toLowerCase())
            return -1;
        else if (a.toLowerCase() > b.toLowerCase())
            return 1;
        else
            return 0;
    });
}

async function showClfAnnotation(clf, menu_idx) {
    menuArr[menu_idx] = copy(clfAnnotationTemplate);
    menuArr[menu_idx].description.clf = clf;
    clf = clf.split(':')[0];

    // Comments
    let response = await fetch(`${dbAPIURL}/clf_comments/byforeignid?foreign_key=clf&foreign_key_id=${clf}`);
    if (!response.ok) {
        const error = await response.text();
        alert(`Failed to download classifier comments: ${error}`);
        return;
    }
    let data = await response.json();
    for (const key in data)
        if (data.hasOwnProperty(key)) {
            menuArr[menu_idx].description.comment = n(data[key].comment);
            break;  // Only one comment per classifier.
        }

    // Meanings
    response = await fetch(`${dbAPIURL}/clf_meanings/byforeignid?foreign_key=clf&foreign_key_id=${clf}`);
    if (!response.ok) {
        const error = await response.text();
        alert(`Failed to download classifier meanings: ${error}`);
        return;
    }
    data = await response.json();
    for (const key in data)
        if (data.hasOwnProperty(key)) {
            let meaningTmp = copy(clfMeaningTemplate);
            meaningTmp.description.clf = clf;
            meaningTmp.description.meaning = n(data[key].meaning);
            meaningTmp.description.source_id = n(data[key].source_id);
            meaningTmp.description.source_pages = n(data[key].source_pages);
            menuArr[menu_idx].meanings.push(meaningTmp);
        }
    showClfHieroForAnnotation(menu_idx);
    m.redraw();
}

async function showClfHieroForAnnotation(menu_idx) {
    if (menuArr[menu_idx].description.clf === '' ||
        menuArr[menu_idx].description.clf === null ||
        projectTypeArray[menu_idx] !== 'hieroglyphic')
        return;

    const clf = menuArr[menu_idx].description.clf.split(':')[0],
        response = await fetch(jseshURL + clf);
    if (response.ok) {
        const base64 = await response.text();
        menuArr[menu_idx].img_src = 'data:image/png;base64,' + base64;
        m.redraw();
    }
}

async function submitClfAnnotation(menu_idx) {
    // Strip meanings from the id before uploading
    const tmp = menuArr[menu_idx].description.clf;
    menuArr[menu_idx].description.clf = menuArr[menu_idx].description.clf.split(':')[0];
    const response = await fetch(`${dbAPIURL}/tokens/addclfannotations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain',
        },
        body: JSON.stringify(menuArr[menu_idx]),
        credentials: 'include'
    });
    if (!response.ok) {
        const error = await response.text();
        alert(`Failed to upload the data: ${error}`);
    } else {
        alert('Update successful');
    }
    // Put the combined clf back for the menus to work
    menuArr[menu_idx].description.clf = tmp;
    m.redraw();
}