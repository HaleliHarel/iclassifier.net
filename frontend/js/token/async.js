// Functions that invoke m.redraw after
// fetching stuff. When invoked from view
// methods, they can trigger endless loops:
// always need to make sure that m.redraw
// will not be invoked again after the job was done.

//
// Helpers
//
function arraysAreEqual(a1, a2) {
  if (a1.length !== a2.length)
    return false;
  for (let i = 0; i < a1.length; i++)
    if (a1[i] !== a2[i])
      return false;
  return true;
}

function newIDsAdded(fetchedData, currentData) {
    let lemmaIDTmp = [];
    for (const lemmaID in fetchedData) {
        if (!fetchedData.hasOwnProperty(lemmaID))
            continue;
        lemmaIDTmp.push(lemmaID)
    }
    let currentLemmaIDs = [];
    for (const [lemmaID, _] of currentData)
        currentLemmaIDs.push(lemmaID);
    lemmaIDTmp.sort(cmpInts);
    currentLemmaIDs.sort(cmpInts);
    return !arraysAreEqual(lemmaIDTmp, currentLemmaIDs);
}

//
// Fetching token info
//

// A list of available tokenIDs for the 'Next'/'Prev' buttons.
let tokenIDs = [];
// A dictionary of tokenIDs indexed by lemmaIDs for searching by lemma
// and retrieving next/previous tokens with the same lemma.
let tokensByLemmaID = {};
// Gets called from the switchProject function in index.html.
let fetchTokenIDs = () => { fetchIDs('tokens', 'token', tokenIDs); }

function fetchTokenInfoAndRedraw(menu_idx, tokenID) {
    // Fetch the main token data.
    fetch(`${dbAPIURL}/tokens/byid?id=${tokenID}`)
        .then(response => {
            if (!response.ok)
                alert('Failed to download token info from the server.');
            else
                return response.json()
        })
        .then(data => {
            showPicInContextData.coords = null;

            menuArr[menu_idx] = copy(tokenInfoTemplate);
            menuArr[menu_idx].id = tokenID;

            for (const key in data) {
                if (data.hasOwnProperty(key) &&
                    menuArr[menu_idx].description.hasOwnProperty(key) &&
                    data[key] !== '')
                    menuArr[menu_idx].description[key] = data[key];
            }

            // TODO: Redundant due to the check above?
            for (const key in menuArr[menu_idx].description) {
                if (!menuArr[menu_idx].description.hasOwnProperty(key))
                    continue;
                // Normalise values.
                if (menuArr[menu_idx].description[key] === '')
                    menuArr[menu_idx].description[key] = null;
            }

            // Fetch data for subcomponents and redraw.
            fetchCompoundPartsAndRedraw(menu_idx);
            showTokenHiero(menu_idx);
            if (menuArr[menu_idx].description.lemma_id !== null)
                showLemmaInfo(menu_idx);
            if (menuArr[menu_idx].description.supertext_id !== null)
                showSupertextName(menu_idx);
            if (menuArr[menu_idx].description.witness_id !== null)
                showWitnesssName(menu_idx);
            fetchCLFParsesAndRedraw(menu_idx);
            fetchTokenPicsAndRedraw(menu_idx);
            fetchBiblioRefsAndRedraw(menu_idx);
            fetchAdminCommentsAndRedraw(menu_idx);
        });
}

//
// Fetching subparts for compound tokens.
//
function fetchCompoundPartsAndRedraw(menu_idx) {
    if (menuArr[menu_idx].id === null)
        return;

    fetch(`${dbAPIURL}/tokens/byforeignid?foreign_key=compound_id&foreign_key_id=${menuArr[menu_idx].id}`)
        .then(response => {
            if (!response.ok)
                alert('Failed to fetch information about compound parts from the server.');
            else
                return response.json()
        })
        .then(data => {
            for (const key in data)
                if (data.hasOwnProperty(key))
                    menuArr[menu_idx].compound_elements.push(parseInt(key));
            if (menuArr[menu_idx].compound_elements.length > 0) {
                menuArr[menu_idx].type = 'compound';
            } else if (
                menuArr[menu_idx].description.compound_id !== null &&
                menuArr[menu_idx].description.compound_id !== ''
            )
                menuArr[menu_idx].type = 'part';
            else
                menuArr[menu_idx].type = 'simple';
            m.redraw();
        });
}

//
// Fetching hieroglyph images from the Jsesh server for tokens and classifiers.
//
async function showTokenHiero(menu_idx) {
    if (menuArr[menu_idx].description.mdc === '' ||
        menuArr[menu_idx].description.mdc === null ||
        projectTypeArray[menu_idx] !== 'hieroglyphic')
        return;

    const response = await fetch(jseshURL + menuArr[menu_idx].description.mdc);
    if (response.ok) {
        const base64 = await response.text();
        menuArr[menu_idx].img_src = 'data:image/png;base64,' + base64;
        m.redraw();
    }
}

function showClfHiero(idx, menu_idx) {
    // Don't do anything if the source_img has been fetched.
    // Otherwise m.redraw() will enter an endless loop.
    if (menuArr[menu_idx].clfParses[idx].img_src !== '' ||
        projectTypeArray[menu_idx] !== 'hieroglyphic')
        return;
    fetch(jseshURL + menuArr[menu_idx].clfParses[idx].description.gardiner_number)
        .then(response => {
            if (!response.ok)
                alert('Failed to obtain hieroglyphs for a classifier.');
            else
                return response.text()
        })
        .then(base64 => {
            try {
                menuArr[menu_idx].clfParses[idx].img_src = 'data:image/png;base64,' + base64;
                m.redraw();
            } catch (e) {
                console.log(e);
                console.log(menu_idx, idx);
            }
        });
}

//
// Fetching data for selected lemmas, witnesses, and supertexts.
//
function showLemmaInfo(menu_idx) {
    fetch(`${dbAPIURL}/lemmas/byid?id=${menuArr[menu_idx].description.lemma_id}`)
        .then(response => {
            if(!response.ok)
                alert('Failed to download lemma info from the server.');
            else
                return response.json()
        })
        .then(lemmaInfo => {
            menuArr[menu_idx].lemma_info = `${lemmaInfo['transliteration']} (${lemmaInfo['meaning']})`;
            m.redraw();
        });
}

function showSupertextName(menu_idx) {
    fetch(`${dbAPIURL}/texts/byid?id=${menuArr[menu_idx].description.supertext_id}`)
        .then(response => {
            if(!response.ok)
                alert('Failed to download supertext info from the server.');
            else
                return response.json()
        })
        .then(textInfo => {
            menuArr[menu_idx].supertext_name = textInfo['text_name'];
            m.redraw();
        });
}

function showWitnesssName(menu_idx) {
    fetch(`${dbAPIURL}/witnesses/byid?id=${menuArr[menu_idx].description.witness_id}`)
        .then(response => {
            if(!response.ok)
                alert('Failed to download witness info from the server.');
            else
                return response.json()
        })
        .then(witnessInfo => {
            if (JSON.stringify(witnessInfo) === JSON.stringify({})) {
                alert(`Witness ID "${menuArr[menu_idx].description.witness_id}" does not correspond to any records in the witnesses table.`);
                return;
            }
            menuArr[menu_idx].witness_name = witnessInfo['name'];
            m.redraw();
        });
}

//
// Fetching clf parses
//
async function fetchCLFParsesAndRedraw(menu_idx) {
    let tokenID = menuArr[menu_idx].id;
    const response = await fetch(`${dbAPIURL}/clf_parses/byforeignid?foreign_key=token_id&foreign_key_id=${tokenID}`)
    if (!response.ok)
        alert('Failed to download classifier analyses from the server.');
    else {
        const data = await response.json();
        menuArr[menu_idx].clfParses = [];
        // Emit classifiers in order: extract keys and clf_n's then sort.
        let clf_order = [];
        for (const key in data)
            if (data.hasOwnProperty(key))
                clf_order.push([data.clf_n, key]);
        clf_order.sort();
        for (const [_, key] of clf_order) {
            let clf_data = copy(emptyClfParse);
            clf_data.id = key;
            clf_data.description = JSON.parse(JSON.stringify(data[key]));
            // Synchronously fetch clf_pictures for the parse
            const pic_response = await fetch(`${dbAPIURL}/clf_pictures/byforeignid?foreign_key=clf_parse_id&foreign_key_id=${key}`);
            if (!pic_response.ok)
                alert('Failed to download pictures for a classifier.');
            else {
                const clf_pic_data = await pic_response.json();
                for (const clf_pic_key in clf_pic_data) {
                    if (!clf_pic_data.hasOwnProperty(clf_pic_key))
                        continue;
                    let clf_pic = copy(clf_pic_data[clf_pic_key]);
                    for (const pic_field in clf_pic)
                        if (clf_pic.hasOwnProperty(pic_field) &&
                            clf_pic[pic_field] === '')
                            clf_pic[pic_field] = null;
                    // Add null for missing fields.
                    for (const pic_field in emptyClfPicData)
                        if (emptyClfPicData.hasOwnProperty(pic_field) &&
                            !clf_pic.hasOwnProperty(pic_field))
                            clf_pic[pic_field] = null;
                    clf_pic.coords = JSON.parse(clf_pic.coords);
                    clf_data.pictures.push(clf_pic);
                }
                menuArr[menu_idx].clfParses.push(clf_data);
            }

        }
        m.redraw();
    }
}

//
// Fetching witness, token, and classifier pictures from the db.
//

let getWitnessPicsURL = menu_idx => `${dbAPIURL}/witness_pictures/byforeignid?foreign_key=witness_id&foreign_key_id=${menuArr[menu_idx].description.witness_id}`;

function fetchTokenPicsAndRedraw(menu_idx) {
    fetch(`${dbAPIURL}/token_pictures/byforeignid?foreign_key=token_id&foreign_key_id=${menuArr[menu_idx].id}`)
        .then(response => {
            if (!response.ok)
                alert('Failed to download token pictures from the server.');
            else
                return response.json();
        })
        .then(data => {
            for (const key in data) {
                if (!data.hasOwnProperty(key))
                    continue;
                let newTokenPic = JSON.parse(JSON.stringify(emptyTokenPicData)),
                    picInfo = data[key];
                newTokenPic.id = parseInt(key);
                for (const field in picInfo) {
                    if (!picInfo.hasOwnProperty(field) || picInfo[field] === '')
                        continue;
                    newTokenPic[field] = picInfo[field];
                }
                // The server additionally stringifies coords.
                // Need to parse them back.
                newTokenPic.coords = JSON.parse(newTokenPic.coords);
                menuArr[menu_idx].token_pictures.push(newTokenPic);
            }
            m.redraw();
        })
}

function populateWitnessPictures(menu_idx, data) {
    witnessPicDict = {};
    for (const key in data) {
        if (!data.hasOwnProperty(key))
            continue;
        let witnessPicData = data[key];
        let newWitnessPicInfo = JSON.parse(JSON.stringify(emptyWitnessPicData));
        newWitnessPicInfo.id = parseInt(key);
        for (const field in witnessPicData) {
            if (!witnessPicData.hasOwnProperty(field))
                continue;
            if (witnessPicData[field] !== '')
                newWitnessPicInfo[field] = witnessPicData[field];
        }
        menuArr[menu_idx].witness_pictures.push(newWitnessPicInfo);
        // Add to a shared dict for drawing. TODO: remove duplication.
        witnessPicDict[key] = newWitnessPicInfo;
    }
}

function populateWitnessPicturesWithTokenPictures(menu_idx) {
    witnessPicDict = {};
    for (const tok_pic of menuArr[menu_idx].token_pictures) {
        witnessPicDict[tok_pic.id] = tok_pic;
    }
}

function fetchWitnessPicsAndRedrawCrop(menu_idx) {
    fetch(getWitnessPicsURL(menu_idx))
        .then(response => {
            if (!response.ok)
                alert('Failed to download witness pictures for the token.');
            else
                return response.json();
        })
        .then(data => {
            if (JSON.stringify(data) === JSON.stringify({})) {
                alert('The selected witness does not have any associated pictures.');
                return;
            }
            populateWitnessPictures(menu_idx, data);
            show_witness_pic_overlay = true;
            m.redraw();
        });
}

/**
 * Shows token and classifier pictures in the context of a witness pictures.
 * @param menu_idx: the into into the data array containing info about the token.
 * @param idx: index for selecting a member of token_pictures or clf_parses
 * @param picType: 'token' or 'classifier'
 * @param callback: the function to call when the data are fetched
 * @param clfPicNum: index into a clf_parse.pictures array
 */
function fetchWitnessPicsAndShow(menu_idx, idx, picType, callback, clfPicNum=0) {
    if (picType === 'token') {
        fetch(getWitnessPicsURL(menu_idx))
            .then(response => {
                if (!response.ok)
                    alert('Failed to download witness pictures for the token.');
                else
                    return response.json();
            })
            .then(data => {
                if (JSON.stringify(data) === JSON.stringify({})) {
                    alert('The witness picture associated with the token picture is missing. Perhaps it has been removed.');
                    return;
                }
                populateWitnessPictures(menu_idx, data);
                callback(menu_idx, idx);
            });
    }
    // TODO: else
}

async function fetchBiblioRefsAndRedraw(menu_idx) {
    if (menuArr[menu_idx].id === null)
        return;

    const tokenID = menuArr[menu_idx].id,
        response = await fetch(`${dbAPIURL}/token_biblio/byforeignid?foreign_key=token_id&foreign_key_id=${tokenID}`);

    if (!response.ok)
        alert('Failed to fetch token biblio records from the server.');
    else {
        const biblio = await response.json();
        for (const key in biblio) {
            if (!biblio.hasOwnProperty(key))
                continue;
            else {
                const datum = biblio[key];
                let newBiblioRecord = copy(emptyBiblioRef);
                newBiblioRecord.token_id      = datum['token_id'];
                newBiblioRecord.source_id     = datum['publication_id'];

                const bibRecord = await getDataForPub(newBiblioRecord.source_id);
                newBiblioRecord.source_abbrev = bibRecord['abbreviation'];
                newBiblioRecord.source_name   = bibRecord['title'];
                newBiblioRecord.pages         = datum['page_n'];
                newBiblioRecord.comments      = datum['comments'];
                menuArr[menu_idx].biblio_refs.push(newBiblioRecord);
            }
        }
        m.redraw();
    }
}

async function getDataForPub(publication_id) {
    const response = await fetch(`${dbAPIURL}/bibliography/byid?id=${publication_id}`);
    if (!response.ok)
        alert('Failed to obtain bibliography data from the server.');
    else
        return response.json();
}

//
// Send the data to the server. If token id is null, this is a new token,
// otherwise this is an update.
//
async function submitToken(menu_idx) {
    const response = await fetch(`${dbAPIURL}/tokens/holisticadd`, {
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
        populateTokenCache();
        fetchTokenIDs();
        if (result.match(/^\d+$/))
            alert(`A new token was created on the server with the ID ${result}`);
        else
            alert(result);
    }
}

async function fetchAdminCommentsAndRedraw(menu_idx) {
    const response = await fetch(`${dbAPIURLCommon}/admincomments/${projectTag}/tokens/${menuArr[menu_idx].id}/getadmincomment`);
    if (!response.ok) {
        const error = await response.text();
        alert(`Failed to download admin comments from the server: ${error}`);
        return;
    }
    const data = await response.json();
    for (const key in data) {
        if (!data.hasOwnProperty(key)) { continue; }
        menuArr[menu_idx].admin_comments.push({
            username: data[key].username,
            comment: data[key].comment
        });
    }
    m.redraw();
}


//
// Delete the token from the server.
//
async function deleteToken(menu_idx) {
    if (!confirm('This action may be irreversible. Are you sure?'))
        return;

    const response = await fetch(`${dbAPIURL}/tokens/holisticdelete`, {
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
        alert(`Failed to delete the token: ${message}`);
    }
    else {
        const result = await response.text();
        alert(result);
        // Close the menu.
        killMenu(menu_idx);
        fetchTokenIDs();
        populateTokenCache();
        m.redraw();
    }
}

async function populateTokenCache() {
    const response = await fetch(`${dbAPIURL}/tokens/all`);
    if (!response.ok) {
        alert('Failed to download token info from the server.');
        return;
    }
    const data = await response.json();
    menu_data_cache.tokensWithMDC.length = 0;
    for (const key in data) {
        if (!data.hasOwnProperty(key))
            continue;
        menu_data_cache.tokensWithMDC.push([
            parseInt(key),
            { MDC: data[key].mdc, lemma_id: data[key].lemma_id, witness_id: data[key].witness_id, coords_in_witness: data[key].coords_in_witness }
        ]);
        if (data[key].lemma_id !== null) {
            if (!tokensByLemmaID.hasOwnProperty(data[key].lemma_id))
                tokensByLemmaID[data[key].lemma_id] = [];
            tokensByLemmaID[data[key].lemma_id].push(parseInt(key));
        }
    }
    for (const lemmaID in tokensByLemmaID) {
        if (!tokensByLemmaID.hasOwnProperty(lemmaID))
            continue;
        tokensByLemmaID[lemmaID].sort(cmpInts);
    }
}