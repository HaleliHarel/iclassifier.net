
// Bibtext templates

// Short for getField
function gf(name, required=false) {
    return {
        name: name,
        required: required
    }
}

const bibtexArticleTemplate = [
    gf('author', true),
    gf('title', true),
    gf('journal', true),
    gf('year', true),
    gf('volume'),
    gf('number'),
    gf('pages'),
    gf('URL')
];

const bibtexBookTemplateAuthor = [
    gf('author', true),
    gf('title', true),
    gf('publisher', true),
    gf('year', true),
    gf('address'),
    gf('edition'),
    gf('URL')
];

const bibtexBookTemplateEditor = [
    gf('editor', true),
    gf('title', true),
    gf('publisher', true),
    gf('year', true),
    gf('address'),
    gf('edition'),
    gf('URL')
];

const bibtexChapterTemplate = [
    gf('author', true),
    gf('title', true),
    gf('booktitle', true),
    gf('publisher', true),
    gf('year', true),
    gf('editor'),
    gf('pages'),
    gf('address'),
    gf('URL')
];

const bibtexThesisTemplate = [
    gf('author', true),
    gf('title', true),
    gf('school', true),
    gf('year', true),
    gf('type'),
    gf('address'),
    gf('URL')
];

// Source of truth for the names of different templates/menu.
const templateLookupTable = {
    'book':          bibtexBookTemplateAuthor,
    'book (edited)': bibtexBookTemplateEditor,
    'article':       bibtexArticleTemplate,
    'chapter':       bibtexChapterTemplate,
    'thesis':        bibtexThesisTemplate
};
