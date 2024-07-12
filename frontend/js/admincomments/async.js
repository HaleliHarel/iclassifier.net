async function downloadAndShowAdminTokenComments(menu_idx) {
    const tokenId = byID(`${menu_idx}-admin-token-input`).value;
    if (tokenId === '')
        return;
    else if (tokenId.match(/^[1-9]\d*$/g) === null) {
        alert('Token IDs must be positive integers.')
        return;
    }
    const response = await fetch(`${dbAPIURLCommon}/admincomments/${projectTag}/tokens/${tokenId}/getadmincomment`);
    if (!response.ok) {
        const error = await response.text();
        alert(`Failed to download admin comments for the token: ${error}.`);
        return;
    }
    menuArr[menu_idx].item_id = tokenId;
    menuArr[menu_idx].other_users = [];
    const data = await response.json();
    for (const key in data) {
        if (!data.hasOwnProperty(key)) { continue; }
        if (data[key].username === getCookieByName('username'))
            menuArr[menu_idx].comment = data[key].comment;
        else
            menuArr[menu_idx].other_users.push({
                username: data[key].username,
                comment: data[key].comment
            })
    }
    m.redraw();
}

async function submitComment(menu_idx) {
    const response = await fetch(`${dbAPIURLCommon}/admincomments/${projectTag}/tokens/${menuArr[menu_idx].item_id}/updateadmincomment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain',
        },
        body: JSON.stringify({ comment: menuArr[menu_idx].comment }),
        credentials: 'include'
    });
    if (!response.ok) {
        const error = await response.text();
        alert(`Failed to update the data on the server: ${error}`);
        return;
    }
    alert('Update successful.');
}