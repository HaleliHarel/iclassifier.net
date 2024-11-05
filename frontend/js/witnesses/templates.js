const witnessInfoTemplate = {
    id: null,
    description: {
        name: null,
        supertext_id: null,
        genre: null,
        object_type: null,
        location: null,
        script: null,
        period_date_start: null,
        period_date_end: null,
        chrono_date_start: null,
        chrono_date_end: null,
        url: null,
        comments: null
    },
    // We store these fields in a separate object because they go into
    // another table in the database and we need to issue another
    // request to obtain or modify them.
    object_and_tla_data: {
        object_id: null,
        tla_data: null
    },
    pictures: [],
    show_overlay: false,
    biblio_tmp: {
        publication_id: null,
        page_n: null,
        comments: null
    },
    biblio_filter: '',
    biblio_refs: []
};

const witnessBiblioRefTemplate = {
    id: null,
    description: {
        witness_id: null,
        publication_id: null,
        page_n: null,
        comments: null
    }
};

const witnessPictureInfoTemplate = {
    id: null,
    description: {
        witness_id: null,
        base64: null,
        comments: null,
        title: null
    }
};