let listMenu = {
    oncreate: vnode => {
        console.log('listMenu oncreate');

        const menuName           = vnode.attrs.menuName,
            dataList             = vnode.attrs.dataList,
            filterFunction       = vnode.attrs.filterFunction,
            divBuilderCallback   = vnode.attrs.divBuilderCallback;

        populateContainerMenu(
            `${menuName}-container`,
            dataList,
            filterFunction,
            divBuilderCallback);
    },

    view: vnode => {
        console.log('listMenu view');

        const menuName           = vnode.attrs.menuName,
            dataList             = vnode.attrs.dataList,
            filterDict           = vnode.attrs.filterDict,
            filterFunction       = vnode.attrs.filterFunction,
            divBuilderCallback   = vnode.attrs.divBuilderCallback;

        const menuID = menuName,
            containerID = `${menuName}-container`;

        populateContainerMenu(
            containerID,
            dataList,
            filterFunction,
            divBuilderCallback);

        return m(
            'div.menu-wrapper',
            {
                id: menuID,
                style: { display: 'none', 'z-index': '1000' }
            },
            [
                m('div.float_menu_header', m('input[type=button]', {
                    value: '✕',
                    onclick: () => {
                        byID(menuID).style.display = 'none'
                    }
                })),
                m('div.inner-menu', m('input[type=text]', {
                    placeholder: 'Filter the list...',
                    oninput: e => {
                        e.redraw = false;
                        filterDict[containerID] = e.target.value;
                        populateContainerMenu(
                            containerID,
                            dataList,
                            filterFunction,
                            divBuilderCallback);
                    },
                    style: { width: '240px' }
                })),
                m('div.inner-menu', {
                    id: containerID
                })
            ]
        )
    }
};

function populateContainerMenu(
    containerID,
    dataList,
    filterFunction,
    divBuilderCallback
) {
    let data = dataList;
    if (data.length === 0) {
        return;
    }
    byID(containerID).innerHTML = '';
    data = data.filter(tuple => filterFunction(tuple, containerID));
    for (const tuple of data) {
        byID(containerID).appendChild(
            divBuilderCallback(tuple)
        );
    }
}

let listMenuButton = {
    view: vnode => {
        const menuName = vnode.attrs.menuName;
        return m('input[type=button]', {
            value: 'Search',
            onclick: e => {
                e.redraw = false;
                const x = e.clientX,
                    y = e.clientY;
                byID(menuName).style.display = 'grid';
                byID(menuName).style.position = 'fixed';
                byID(menuName).style.left = x + 'px';
                byID(menuName).style.top = y + 'px';
            }
        })
    }
}