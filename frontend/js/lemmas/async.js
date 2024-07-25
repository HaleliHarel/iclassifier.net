// const dictionaryAPIURL = 'https://www.iclassifier.pw/api/dictserver';
const dictionaryAPIURL = 'https://iclassifier.click/dictionary';

/**
 * The callback is used to add default dictionary values
 * to the lemma description if there are no data
 * on the server.
 */
async function fetchLemmaInfoAndRedraw(
    menu_idx,
    lemma_id,
    no_data_callback = () => { },
    invoked_by_user = false,
) {
    const response = await fetch(`${dbAPIURL}/lemmas/byid?id=${lemma_id}`)
    if (!response.ok)
        alert('Failed to download lemma info from the server.');
    else {
        const data = await response.json();

        if (JSON.stringify(data) === JSON.stringify({}).trim()) {
            console.log(JSON.stringify(data));
            console.log(invoked_by_user);
            if (invoked_by_user) {
                alert('There is no lemma with this id in the database.');
                return;
            }
            // This is a non-annotated dictionary word.
            // Can create a record with a corresponding id.
            menuArr[menu_idx].add_lemma_with_id = true;
            no_data_callback();
            return;
        }

        menuArr[menu_idx].add_lemma_with_id = false;
        menuArr[menu_idx] = copy(emptyLemmaInfo);
        menuArr[menu_idx].id = lemma_id;

        for (const key in data) {
            if (
                data.hasOwnProperty(key) &&
                menuArr[menu_idx]
                    .description
                    .hasOwnProperty(key) &&
                data[key] !== ''
            )
                menuArr[menu_idx].description[key] = data[key];
        }

        // Fetch data for subcomponents and redraw.
        fetchLemmaVariantsAndRedraw(menu_idx);
        fetchLemmaBorrowingInfoAndRedraw(menu_idx);
        fetchLemmaCognatesAndRedraw(menu_idx);
        fetchLemmaReferencesAndRedraw(menu_idx);

        m.redraw();
    }
}

//
// Component data
//
async function fetchLemmaBorrowingInfoAndRedraw(menu_idx) {
    const response = await fetch(`${dbAPIURL}/lemma_other_languages/byforeignid?foreign_key=lemma_id&foreign_key_id=${menuArr[menu_idx].id}`);
    if (!response.ok) {
        alert('Failed to download borrowing information from the server.');
        return;
    }
    menuArr[menu_idx].borrowingInfo = copy(emptyBorrowingInfo);
    const borrowingInfo = await response.json();
    if (JSON.stringify(borrowingInfo) === JSON.stringify({}))
        return;
    menuArr[menu_idx].menu_switches.borrowing_info = true;
    for (const key in borrowingInfo) {
        if (borrowingInfo.hasOwnProperty(key)) {
            const b = borrowingInfo[key];
            menuArr[menu_idx].borrowing_info.id = parseInt(key);
            for (const fieldName of [
                'lemma_id', 'source_root', 'source_meaning',
                'contact_type', 'certainty_level',
                'hoch_n_occurrences', 'comments'
            ]) {
                menuArr[menu_idx]
                .borrowing_info
                .description[fieldName] = b[fieldName];
            }
        }
    }
    m.redraw();
}

async function fetchLemmaVariantsAndRedraw(menu_idx) {
    const response = await fetch(`${dbAPIURL}/lemma_variants/byforeignid?foreign_key=lemma_id&foreign_key_id=${menuArr[menu_idx].id}`);
    if (!response.ok) {
        alert('Failed to download lemma variants from the server.');
        return;
    }
    const variantData = await response.json();
    menuArr[menu_idx].variants.length = 1;
    for (const key in variantData) {
        if (!variantData.hasOwnProperty(key))
            continue;
        let v = variantData[key];
        if (v.primary === 1 || v.primary === '1') {
            console.log('updating the primary from key ' + key);
            menuArr[menu_idx].variants[0] = copy(
                emptyLemmaVariant
            );
            menuArr[menu_idx]
                .variants[0]
                .id = parseInt(key);
            menuArr[menu_idx]
                .variants[0]
                .description
                .primary = 1;
            for (const fieldName of [
                'lemma_id', 'transliteration', 'meaning',
                'source_id', 'source_pages'
            ]) {
                menuArr[menu_idx]
                    .variants[0]
                    .description[fieldName] = n(v[fieldName]);
            }

            menuArr[menu_idx].menu_switches.show_lemma_details = true;
            m.redraw();
        } else {
            console.log('adding non-primary from key ' + key);
            let newVariant = copy(emptyLemmaVariant);
            newVariant.id = parseInt(key);
            newVariant.description.primary = 0;
            for (const fieldName of [
                'lemma_id', 'transliteration', 'meaning', 'source_id', 'source_pages'
            ]) { newVariant.description[fieldName] = n(v[fieldName]); }
            menuArr[menu_idx].variants.push(copy(newVariant));
            console.log('variant arr length is ' + menuArr[menu_idx].variants.length);
        }
    }

    // If the basic lemma description is filled, but the primary variant is not,
    // fill the primary variant from the description.
    let v = menuArr[menu_idx].variants[0].description;
    if (v.transliteration === null && menuArr[menu_idx].description.transliteration !== null) {
        menuArr[menu_idx].variants[0].description.transliteration = menuArr[menu_idx].description.transliteration;
    }
    if (v.meaning === null && menuArr[menu_idx].description.meaning !== null) {
        menuArr[menu_idx].variants[0].description.meaning = menuArr[menu_idx].description.meaning;
    }
}

async function fetchLemmaCognatesAndRedraw(menu_idx) {
    const response = await fetch(`${dbAPIURL}/lemma_cognates/byforeignid?foreign_key=lemma_id&foreign_key_id=${menuArr[menu_idx].id}`);
    if (!response.ok) {
        alert('Failed to download lemma cognates from the server.');
        return;
    }
    const cognateData = await response.json();
    for (const key in cognateData) {
        if (cognateData.hasOwnProperty(key)) {
            let newCognate = copy(emptyCognateInfo);
            newCognate.id = parseInt(key);
            let d = newCognate.description;
            const c = cognateData[key];
            for (const fieldName of [
                'language', 'cognate', 'meaning',
                'publication_id', 'page_n',
                'discussion', 'lemma_id'
            ])
                d[fieldName] = c[fieldName] === '' ? null : c[fieldName];
            menuArr[menu_idx].cognates.push(copy(newCognate));
        }
    }
    m.redraw();
}

async function fetchLemmaReferencesAndRedraw(menu_idx) {
    let response = await fetch(`${dbAPIURL}/lemma_other_languages_lexicon_entries/byforeignid?foreign_key=lemma_id&foreign_key_id=${menuArr[menu_idx].id}`);
    if (!response.ok) {
        alert('Failed to download lemma biblio references from the server.');
        return;
    }
    const biblioData = await response.json();
    for (const key in biblioData)
        if (biblioData.hasOwnProperty(key)) {
            let newBiblioRef = copy(emptyLemmaLexiconEntry);

            newBiblioRef.id = parseInt(key);
            response = await fetch(`${dbAPIURL}/bibliography/byid?id=${newBiblioRef.id}`);
            if (!response.ok) {
                alert('Failed to download bibliographic data from the server.');
                return;
            }
            const biblio_record = await response.json();
            if (JSON.stringify(biblio_record) === JSON.stringify({})) {
                alert(`The bibliographical record with the id ${newBiblioRef.id} not found.`);
                newBiblioRef.title = '';
            } else {
                if (biblio_record.abbreviation !== '' && biblio_record.abbreviation !== null)
                    newBiblioRef.title = biblio_record.abbreviation;
                else
                    newBiblioRef.title = biblio_record.title;
            }

            newBiblioRef.description.lemma_id = menuArr[menu_idx].id;
            newBiblioRef.description.dictionary_id = biblioData[key].dictionary_id;
            newBiblioRef.description.page = biblioData[key].pages === '' ? null : biblioData[key].pages;
            newBiblioRef.description.url = biblioData[key].url === '' ? null : biblioData[key].url;

            menuArr[menu_idx].biblio_refs.push(newBiblioRef);
        }
    m.redraw();
}

// For next/prev.
let lemmaIDs = [];
let fetchLemmaIDs = () => { fetchIDs('lemmas', 'lemma', lemmaIDs); }

async function fetchDictionaryWordsAndRedraw(menu_idx, queryType) {
    let query;
    if (queryType === 'transliteration')
        query = menuArr[menu_idx].menu_data.dict_query_transliteration;
    else
        query = menuArr[menu_idx].menu_data.dict_query_translation;

    // Don't try to download all the dictionary at once.
    if (query === null)
        return;

    // Don't repeat the previous query; otherwise you will enter an
    // endless loop. We assume that the dictionary is never (or very rarely),
    // updated, so the data returned by the query can be cached indefinitely.
    if (query === menuArr[menu_idx].menu_data.previous_dict_query)
        return;

    // Don't fetch if the query is too short and short queries are not allowed.
    if (query.length === 1 && !menuArr[menu_idx].menu_data.allow_short_searches)
        return;

    let dictID;
    if (projectType === 'hieroglyphic')
        dictID = 'tla';
    else if (projectType === 'chinese')
        dictID = 'chinese';
    else
        throw `Project type ${projectType} does not have an associated dictionary.`;

    const response = await fetch(`${dictionaryAPIURL}/${dictID}/bysubstring?substr=${query}&type=${queryType}`);
    if (!response.ok) {
        alert('Failed to obtain words from the dictionary.');
        return;
    }
    menuArr[menu_idx].menu_data.previous_dict_query = query;
    const data = await response.json();
    menuArr[menu_idx].menu_data.dictionary_cache = [];
    for (const key in data)
        if (data.hasOwnProperty(key))
            menuArr[menu_idx].menu_data.dictionary_cache.push([key, data[key]]);
    m.redraw();
}

function addLemmaBiblioRef(menu_idx) {
    menuArr[menu_idx].biblio_tmp = copy(emptyLemmaLexiconEntry);
    menuArr[menu_idx].biblio_tmp.description.lemma_id = menuArr[menu_idx].id;
    menuArr[menu_idx].menu_switches.biblio = true;
    fetchLemmaBiblioAndRedraw(menu_idx);
}

let fetchLemmaBiblioAndRedraw = fetchDataAndRedrawGenerator(
    'bibliography/all',
    'biblio',
    'bibliographical references');


//
// Submit and delete
//

async function submitLemma(menu_idx) {
    const d = menuArr[menu_idx],
        payload = {
            id: d.id,
            add_lemma_with_id: menuArr[menu_idx].add_lemma_with_id,
            description: d.description,
            cognates: d.cognates,
            borrowing_info: d.borrowing_info,
            variants: d.variants,
            biblio_refs: d.biblio_refs
        },
        response = await fetch(`${dbAPIURL}/lemmas/holisticadd`, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            credentials: 'include',
            headers: {
                'Content-Type': 'text/plain'
            },
            redirect: 'follow',
            referrerPolicy: 'no-referrer',
            body: JSON.stringify(payload)
        });
    if (!response.ok) {
        const message = await response.text();
        alert(`Failed to upload data to the server: ${message}`);
    }
    else {
        const result = await response.text();
        if (result.match(/^\d+$/))
            alert(`A new lemma was created on the server with the ID ${result}`);
        else
            alert(result);
        populateLemmaCache();
        menuArr[menu_idx].add_lemma_with_id = false;
    }
}

async function deleteLemma(menu_idx) {
    if (!confirm('This action may be irreversible. Are you sure?'))
        return;

    const response = await fetch(`${dbAPIURL}/lemmas/holisticdelete`, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'include',
        headers: {
            'Content-Type': 'text/plain'
        },
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify({ id: menuArr[menu_idx].id })
    });

    if (!response.ok) {
        const message = await response.text();
        alert(`Failed to delete the lemma: ${message}`);
    }
    else {
        const result = await response.text();
        alert(result);
        // Close the menu.
        killMenu(menu_idx);
        fetchLemmaIDs();
        populateLemmaCache();
        m.redraw();
    }
}

async function populateLemmaCache() {
    const response = await fetch(`${dbAPIURL}/lemmas/all`);
    if (!response.ok) {
        alert('Failed to download lemma info from the server.');
        return;
    }
    const data = await response.json();
    menu_data_cache.lemmaBasic.length = 0;
    for (const key in data) {
        if (!data.hasOwnProperty(key))
            continue;
        menu_data_cache.lemmaBasic.push([
            parseInt(key),
            {
                transliteration: data[key].transliteration,
                translation: data[key].meaning
            }
        ])
    }
}

async function downloadConcepticon() {
    // Do not download Concepticon more than once.
    if (menu_data_cache.concepts.length > 0)
        return;
    const response = await fetch('https://www.iclassifier.pw/static/thesauri/allconcepts.json');
    if (!response.ok) {
        const error = await response.text();
        alert(`Could not download Concepticon concepts: ${error}`);
        return;
    }
    const data = await response.json();
    menu_data_cache.concepts = copy(data);
}