/**
 * Converts a bib-entry template to a description dict.
 */
function getFields(template) {
    let description = {};
    for (const key of template)
        description[key.name] = '';
    return description;
}

function changeBibtexType(menu_idx, bibtexType) {
    // Preserve filled forms if possible
    let oldData   = copy(menuArr[menu_idx].description),
        oldAbbrev = menuArr[menu_idx].abbreviation;
    menuArr[menu_idx].description = getFields(templateLookupTable[bibtexType]);
    menuArr[menu_idx].abbreviation = oldAbbrev;
    for (const fieldName in menuArr[menu_idx].description) {
        if (oldData.hasOwnProperty(fieldName)) {
            menuArr[menu_idx].description[fieldName] = oldData[fieldName];
        }
    }
}

function validateBibData(menu_idx) {
    let template = templateLookupTable[menuArr[menu_idx].entry_type],
        bibDataValid = true,
        emptyFields = [];
    console.log(template);
    for (const fieldObj of template) {
        if (fieldObj.required && (
            menuArr[menu_idx].description[fieldObj.name] === '' ||
            menuArr[menu_idx].description[fieldObj.name] === null
        )) {
            emptyFields.push(fieldObj.name);
            bibDataValid = false;
        }
    }
    if (!bibDataValid)
        alert(`The fields are not set: ${emptyFields.join((', '))}.`);
    return bibDataValid;
}

const bibPlaceholders = {
    'author': ' Please use bibtex conventions: Gardiner, Alan H. and Polotsky Hans J. and Champollion, Jean-François',
    'editor': ' Please use bibtex conventions: Gardiner, Alan H. and Polotsky Hans J. and Champollion, Jean-François'
};

function getBibEntryForm(menu_idx, field, required=false) {
    const ncol = 40,
        nrow = 5,
        width = '250px',
        formID = `input-${field}`,
        inputHandler = (e) => {
            e.redraw = false;
            menuArr[menu_idx].description[field] = e.target.value;
        };
    if (required)
        return m('div.menu-entry', [
            m('div.input-label', field),
            m(
                'div.select-div',
                m('textarea', {
                    rows: nrow,
                    style: {width: width},
                    id: formID,
                    placeholder: 'Required field' + get(bibPlaceholders, field, ''),
                    oninput: inputHandler,
                    value: menuArr[menu_idx].description[field]
                }))
        ]);
    else
        return m('div.menu-entry', [
            m('div.input-label', field),
            m(
                'div.select-div',
                m('textarea', {
                    rows: nrow,
                    style: {width: width},
                    id: formID,
                    placeholder: '',  // otherwise null placeholders appear
                    oninput: inputHandler,
                    value: menuArr[menu_idx].description[field]
            }))
        ]);
}

function getAbbreviationForm(menu_idx) {
    return m('div.menu-entry', [
            m('div', [
                m('span', 'abbrev.'),
                m('br'),
                m('span', 'title')
            ]),
            m('input[type=text]', {
                style: {width: '247px'},
                id: 'input-abbreviation',
                oninput: (e) => {
                    e.redraw = false;
                    menuArr[menu_idx].abbreviation = e.target.value
                },
                value: menuArr[menu_idx].abbreviation
            })
        ]);
}

let getBibMenu = (menu_idx, template) => { return m(
    'div.bib-menu',
    template
        .map(templateEntry => getBibEntryForm(menu_idx, templateEntry.name, templateEntry.required))
        .concat(getAbbreviationForm(menu_idx)))
};

// Menus corresponding to different bibtex classes.
// They have to be re-evaluated when we change the bibtex
// class so as to keep the already filled fields.
let articleMenu = menu_idx => getBibMenu(menu_idx, bibtexArticleTemplate),
    bookMenu = menu_idx => getBibMenu(menu_idx, bibtexBookTemplateAuthor),
    bookMenuEdited = menu_idx => getBibMenu(menu_idx, bibtexBookTemplateEditor),
    chapterMenu = menu_idx => getBibMenu(menu_idx, bibtexChapterTemplate),
    thesisMenu = menu_idx => getBibMenu(menu_idx, bibtexThesisTemplate);
