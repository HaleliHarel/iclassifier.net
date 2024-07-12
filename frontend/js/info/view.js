//
// A component displaying statistics and other data about the project.
//
let info_div = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        return m('div.menu', [
            m(killButton, {menu_idx: menu_idx}),

            m('div.menu-row', m('h3', projectTitle)),
            m('div.menu-row', [
                m('h4', 'Statistics'),
                m('p', `Number of tokens: ${projectStats.tokens}`),
                m('p', `Number of lemmas: ${projectStats.lemmas}`),
                m('p', 'Number of tokens by classifier count:'),
                m(
                    'ul',
                    {style: {'list-style-type': 'none'}},
                    processNumericStats(projectStats.tokens_by_clf_number))
            ]),
            m('div.menu-row', [
                m('h4', 'Project description'),
                m('textarea', {
                    style: {width: '440px', height: '275px', 'font-family': 'inherit', 'font-size': '12pt'},
                    value: projectInfo.descr,
                    oninput: e => { e.redraw = false; projectInfo.descr = e.target.value; }
                })
            ]),
            m('div.menu-row', [
                m('h4', 'How to cite'),
                m('textarea', {
                    style: {width: '440px', height: '100px', 'font-family': 'inherit', 'font-size': '12pt'},
                    value: projectInfo.howtocite,
                    oninput: e => { e.redraw = false; projectInfo.howtocite = e.target.value; }
                })
            ]),
            m('div.menu-row', [
                m('label', {'for': `open-for-browsing-checkbox-${menu_idx}`}, 'The project is visible in the reports: '),
                m('input[type=checkbox]', {
                    id: `open-for-browsing-checkbox-${menu_idx}`,
                    checked: projectInfo.open_for_browsing,
                    onclick: e => { projectInfo.open_for_browsing = e.target.checked; }
                })
            ]),
            m('div.menu-row', m('input[type=button]', {onclick: submitProjectInfo, value: 'Submit'}))
        ]);
    }
}

/**
 * The keys of @param statsDict are assumed to be numeric.
 * The are sorted in the increasing order and an array of m('li') elements
 * with keys and values is returned.
 */
function processNumericStats(statsDict) {
    let keys = [];
    for (const k in statsDict)
        if (statsDict.hasOwnProperty(k))
            keys.push(k);
    keys.sort((a, b) => {
        if (parseInt(a) < parseInt(b))
            return -1;
        else if (parseInt(a) > parseInt(b))
            return 1;
        else
            return 0;
    });
    return keys.map(k => m('li', `${k}: ${statsDict[k]}`));
}