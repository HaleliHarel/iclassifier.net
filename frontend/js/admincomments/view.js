const adminCommentTemplate = {
    comment: null,
    table: 'tokens',  // The only supported value for now.
    item_id: null,
    other_users: []
};

let admin_comments_menu = {
    view: vnode => {
        const menu_idx = vnode.attrs.menu_idx;
        return m(
            'div.menu', [
                m(killButton, {menu_idx: menu_idx}),
                m('div.menu-col', [
                    m('label', {for: `${menu_idx}-admin-token-input`}, 'Select token by id:'),
                    m('input[type=text]', {
                        id: `${menu_idx}-admin-token-input`,
                        value: menuArr[menu_idx].item_id
                    })
                ]),
                m('div.menu-col', {style: { display: 'flex', 'align-items': 'flex-end' }}, m('input[type=button]', {
                    value: 'Select',
                    onclick: () => { downloadAndShowAdminTokenComments(menu_idx); }
                })),
                m('div.menu-row', {style: {display: menuArr[menu_idx].other_users.length > 0 ? 'block' : 'none'}},
                    m('h4', {style: {'margin-bottom': '0'}}, 'Comments by other users:')),
                m('div.menu-row', menuArr[menu_idx].other_users.map(comment => m('div', {
                    style: {
                        width: '410px',
                        padding: '5px',
                        border: '1px dotted darkgrey',
                        'margin-bottom': '5px'
                    }
                }, [
                    m('span.b', 'User: '),
                    m('span', comment.username),
                    m('span.b', {style: {'margin-left': '10px'}}, 'Comment: '),
                    m('span', comment.comment)
                ]))),
                m('div.menu-row', [
                    m('span.b', 'Comment:'), m('br'),
                    m('textarea', {
                        class: projectType,
                        style: {width: '100% !important', height: '200px', 'font-size': '12pt'},
                        value: menuArr[menu_idx].comment,
                        oninput: e => {
                            e.redraw = false;
                            menuArr[menu_idx].comment = e.target.value;
                        }
                    })
                ]),
                m('div.menu-row', m('input[type=button]', {
                    value: 'Submit',
                    onclick: () => { submitComment(menu_idx); }
                }))
                ])
    }
}