// Data structures shared between menus because only one
// menu can be used to add pictures to a token at a time.
let witnessPicDict = {},
    show_witness_pic_overlay = false,
    show_in_context_overlay = false,
    active_witness_picture_id = null,
    active_menu_idx = null,
    active_clf_parse_idx = null,  // For adding classifier pictures. If null, we're adding a token picture.
    cropped_pic_base64 = null;

const emptyWitnessPicData = {
    id: null,
    title: null,
    witness_id: null,
    base64: null,
    comments: null
};

const emptyTokenPicData = {
    id: null,
    title: null,
    token_id: null,
    base64: null,
    witness_picture_id: null,
    coords: null,
    comments: null
};

const emptyClfPicData = {
    id: null,
    clf_parse_id: null,
    base64: null,
    coords: null,
    witness_picture_id: null,
    comments: null
};

let showPicInContextData = {
    base64: null,
    coords: null
};

//
// Data for drawing images and rectangles on them
//
// Perhaps we can use a single canvas for token and classifier images?
// let image, canvas, canvas2, rect, ctx, ctx2;
// let croppedImage, croppedImage2, contextCoordinates, contextCoordinates2;

let mouseData = {
    drag: false,
    startX: [],
    startY: [],
    endX: [],
    endY: [],
    lastClickTime: 0
};


//
// A component for extracting token pictures from witness pictures.
//
let witnessPicSelectComponent = {
    onupdate: () => {
        if (show_witness_pic_overlay) {
			console.log('Scrolling to the top');
            document.body.scrollTop = 0;             // For Safari
            document.documentElement.scrollTop = 0;  // For Chrome, Firefox, IE and Opera
        }
    },
    view: () => {
        if (active_menu_idx === null)
            return m('span');
        else {
            let pic_options = [];
            for (const key in witnessPicDict) {
                if (!witnessPicDict.hasOwnProperty(key))
                    continue;
                pic_options.push(m('option',
                    {value: witnessPicDict[key].id},
                    `${witnessPicDict[key].id}: ${witnessPicDict[key].title}`))
            }
            return m('div.witness-pic-overlay',
                {style: {display: show_witness_pic_overlay ? 'block' : 'none'}},
                [
                    m('input[type=button]', {value: 'Hide overlay',
                        onclick: () => {show_witness_pic_overlay = false}}),
                    m('h4', `Select a witness picture: `),
                    m(
                        'select',
                        {
                            style: {width: '200px'},
                            value: '---',
                            onchange: (e) => {
                                active_witness_picture_id = parseInt(e.target.value);
                                showPicInContextData.base64 = witnessPicDict[e.target.value].base64;
                            }
                        },
                        // Depending on whether we are cropping a picture of a token or a classifier,
                        // we will be adding witness or token pictures to this list.
                        [m('option', {disabled: true, value: '---'}, '---')].concat(pic_options)),
                    m('br'),
                    m('br'),
                    m(tokenPicCropComponent)
                ])
        }
    }
};

let tokenPicCropComponent = {
    onupdate: () => {
        if (showPicInContextData.base64 === null)
            return;

        let image = new Image();
        image.onload = () => {
            let canvas = document.getElementById('crop');
            canvas.width  = image.width;
            canvas.height = image.height;
            let ctx = canvas.getContext('2d');
            canvas.style.backgroundImage = 'url("' + showPicInContextData.base64 + '")';

            ctx.fillStyle = "rgba(255,0,0,0.3)";

            let rect = canvas.getBoundingClientRect();

            // Clear everything on escape
            document.addEventListener('keyup', e => {
                if (e.code === 'Escape') {
                    mouseData.startX = [];
                    mouseData.startY = [];
                    mouseData.endX = [];
                    mouseData.endY = [];
                    mouseData.drag = false;
                    document.body.style.cursor = 'default';
                    updateRect(ctx, canvas, image);
                }
            });

            canvas.onmousedown = e => {
                // Some corner case? Do not understand this now.
                if (mouseData.drag) {
                    mouseUp();
                    return;
                }

                mouseData.drag = true;
                document.body.style.cursor = 'crosshair';

                // Start from scratch if shift is not pressed.
                if (!e.shiftKey) {
                    mouseData.startX = [];
                    mouseData.startY = [];
                    mouseData.endX = [];
                    mouseData.endY = [];
                }

                mouseData.startX.push(e.pageX - rect.left);
                mouseData.endX.push(e.pageX - rect.left);
                mouseData.startY.push(e.pageY - rect.top);
                mouseData.endY.push(e.pageY - rect.top);
            };

            canvas.onmousemove = e => {
                if (!mouseData.drag)
                    return;

                let nRect = mouseData.endX.length;
                mouseData.endX[nRect - 1] = e.pageX - rect.left;
                mouseData.endY[nRect - 1] = e.pageY - rect.top;
                window.requestAnimationFrame(() => { updateRect(ctx, canvas, image); } );
            };

            document.onmouseup = () => { mouseUp(image) };
        };

        image.src = showPicInContextData.base64;
    },
    view: () => m('div', [
        m('canvas#crop'),
        m('h4', 'Crop preview: '),
        m('img#crop-result', {style: {border: '1px dotted red'}}),
        m('br'), m('br'),
        m('input[type=button]', {value: 'Add the cropped image',
        onclick: addCroppedImage}),
        m('br'), m('br'), m('br')
    ])
};

function mouseUp(image) {
    if (!mouseData.drag)
        return;

    // Create an invisible canvas of a needed size,
    // project the parts of the copied image you need,
    // and then covert to dataUrl.
    let invCanv = document.createElement('canvas'),
        invCtx = invCanv.getContext('2d'),
        boundingBox = getBoundingBox(),
        shiftedCoords = getShiftedCoords(boundingBox);
    invCanv.width = boundingBox.maxX - boundingBox.minX;
    invCanv.height = boundingBox.maxY - boundingBox.minY;

    for (let i = 0; i < shiftedCoords.startX.length; i++) {
        invCtx.drawImage(
            image,
            mouseData.startX[i],
            mouseData.startY[i],
            mouseData.endX[i] - mouseData.startX[i],
            mouseData.endY[i] - mouseData.startY[i],
            shiftedCoords.startX[i],
            shiftedCoords.startY[i],
            shiftedCoords.endX[i] - shiftedCoords.startX[i],
            shiftedCoords.endY[i] - shiftedCoords.startY[i]
        );
    }

    let cropImg = document.getElementById('crop-result'),
        crop_base64 = invCanv.toDataURL();
    cropImg.src = crop_base64;
    cropped_pic_base64 = crop_base64;
    mouseData.drag = false;
    document.body.style.cursor = 'default';
}

function addTokenPicture(menu_idx) {
    active_menu_idx = menu_idx;
    active_clf_parse_idx = null;  // Switch to token-picture mode.

    engageCropOverlay(menu_idx);
}

function addClassifierPicture(menu_idx, clf_parse_idx) {
    active_menu_idx = menu_idx;
    active_clf_parse_idx = clf_parse_idx;  // Switch to classifier-picture mode.

    engageCropOverlay(menu_idx);
}

function engageCropOverlay(menu_idx) {
    if (menuArr[menu_idx].description.witness_id === null) {
        alert('A witness must be selected first.');
        return;
    }

    // if (menuArr[menu_idx].witness_pictures.length === 0)
    fetchWitnessPicsAndRedrawCrop(menu_idx);
    // else {
    //     witnessPicDict = {};
    //     for (const witnessPicInfo of menuArr[menu_idx].witness_pictures)
    //         witnessPicDict[witnessPicInfo.id] = witnessPicInfo;
    //     show_witness_pic_overlay = true;
    // }
}

function addCroppedImage() {
    if (active_clf_parse_idx === null)
        addTokenCroppedImage();
    else
        addClfCroppedImage();
}

function addTokenCroppedImage() {
    let new_pic = JSON.parse(JSON.stringify(emptyTokenPicData));
    new_pic.base64 = cropped_pic_base64;
    new_pic.coords = {
        startX: mouseData.startX,
        startY: mouseData.startY,
        endX:   mouseData.endX,
        endY:   mouseData.endY
    };
    new_pic.witness_picture_id = active_witness_picture_id;
    // The rest of the stuff should be added from the main menu.
    menuArr[active_menu_idx].token_pictures.push(new_pic);
}

function addClfCroppedImage() {
    let new_pic = JSON.parse(JSON.stringify(emptyClfPicData));
    new_pic.base64 = cropped_pic_base64;
    new_pic.coords = {
        startX: mouseData.startX,
        startY: mouseData.startY,
        endX:   mouseData.endX,
        endY:   mouseData.endY
    };
    new_pic.witness_picture_id = active_witness_picture_id;
    // Comments should be added from the main menu.
    menuArr[active_menu_idx].clfParses[active_clf_parse_idx].pictures.push(new_pic);
}


//
// Helpers functions for drawing rectangles and extracting parts of images.
//

// Draw all the rectangles from mouseData except for the last one, which is being modified.
function redrawPrevious(ctxToUse, image) {
    if (mouseData.startX.length < 2)
        return;

    ctxToUse.drawImage(image, 0, 0);
    for (let i = 0; i < mouseData.startX.length - 1; i++) {
        ctxToUse.fillRect(
            mouseData.startX[i],
            mouseData.startY[i],
            mouseData.endX[i] - mouseData.startX[i],
            mouseData.endY[i] - mouseData.startY[i]
        );
    }
}

// Update the selection rectangle and redraw the previous ones.
function updateRect(thisCtx, canvas, image) {
    thisCtx.fillStyle = 'rgba(0,255,0,0.3)';
    thisCtx.clearRect(0, 0, canvas.width, canvas.height);
    redrawPrevious(thisCtx, image);
    let nRect = mouseData.startX.length;
    thisCtx.fillRect(
        mouseData.startX[nRect - 1],
        mouseData.startY[nRect - 1],
        mouseData.endX[nRect - 1] - mouseData.startX[nRect - 1],
        mouseData.endY[nRect - 1] - mouseData.startY[nRect - 1]
    );
}

// Get the bounding box for all selection rectangles.
function getBoundingBox() {
    let boundingBox = {
        minX: Infinity,
        minY: Infinity,
        maxX: 0,
        maxY: 0
    };
    let nrect = mouseData.startX.length;
    for (let i = 0; i < nrect; i++) {
        if (Math.min(mouseData.startX[i], mouseData.endX[i]) < boundingBox.minX)
            boundingBox.minX = Math.min(mouseData.startX[i], mouseData.endX[i]);
        if (Math.min(mouseData.startY[i], mouseData.endY[i]) < boundingBox.minY)
            boundingBox.minY = Math.min(mouseData.startY[i], mouseData.endY[i]);
        if (Math.max(mouseData.startX[i], mouseData.endX[i]) > boundingBox.maxX)
            boundingBox.maxX = Math.max(mouseData.startX[i], mouseData.endX[i]);
        if (Math.max(mouseData.startY[i], mouseData.endY[i]) > boundingBox.maxY)
            boundingBox.maxY = Math.max(mouseData.startY[i], mouseData.endY[i]);
    }
    return boundingBox;
}

// Get shifted coordinates for drawing cropped images
// on the small canvas.
function getShiftedCoords(boundingBox) {
    let xOffset = boundingBox.minX,
        yOffset = boundingBox.minY,
        startX = mouseData.startX.map(x => x - xOffset),
        endX = mouseData.endX.map(x => x - xOffset),
        startY = mouseData.startY.map(y => y - yOffset),
        endY = mouseData.endY.map(y => y - yOffset);
    return {
        startX: startX,
        startY: startY,
        endX: endX,
        endY: endY
    };
}

//
// Showing token and classifier pictures in context.
//

/**
 * The component for showing pictures in context.
 * Depends on showPicInContextData.
 */
let showPicInContextComponent = {
    // Try drawing the image after the canvas is attached to the DOM.
    onupdate: () => {
        if (showPicInContextData.coords === null)  // No image yet.
            return;
        let contextImage = new Image();
        contextImage.onload = () => {
            let overlayCanvas = document.getElementById('crop-in-context');
            overlayCanvas.width = contextImage.width;
            overlayCanvas.height = contextImage.height;
            let overlayCtx = overlayCanvas.getContext('2d');
            overlayCtx.drawImage(contextImage, 0, 0);
            overlayCtx.fillStyle = "rgba(255,0,0,0.3)";
            const coords = showPicInContextData.coords;
            for (let i = 0; i < coords.startX.length; i++)
                overlayCtx.fillRect(
                    coords.startX[i],
                    coords.startY[i],
                    coords.endX[i] - coords.startX[i],
                    coords.endY[i] - coords.startY[i]
                );
            document.body.scrollTop = 0;             // For Safari
            document.documentElement.scrollTop = 0;  // For Chrome, Firefox, IE and Opera
        };
        contextImage.src = showPicInContextData.base64;
    },
    view: () => {
        return m('div.witness-pic-overlay',
            {style: {display: show_in_context_overlay ? 'block' : 'none'}},
            [m('input[type=button]', {value: 'Hide overlay', onclick: () => {
                show_in_context_overlay = false;
                }}),
            m('br'),
            m('br'),
            m('canvas#crop-in-context')])
    }
};

/**
 * Fetch witness pics if necessary and choose the correct one for drawing.
 */
function showTokenPicInContext(menu_idx, idx) {
    if (menuArr[menu_idx].witness_pictures.length === 0)
        fetchWitnessPicsAndShow(menu_idx, idx, 'token', showInContext);
    else
        showInContext(menu_idx, idx);
}

/**
 * Populate showPicInContextData and call m.redraw()
 */
function showInContext(menu_idx, idx) {
    const witnessPicID = menuArr[menu_idx].token_pictures[idx].witness_picture_id;
    let witnessPicData = null;
    for (const witnessPic of menuArr[menu_idx].witness_pictures)
        if (witnessPic.id === witnessPicID) {
            witnessPicData = witnessPic;
            break;
        }
    if (witnessPicData === null) {
        alert(`Inconsistent data: the witness picture id ${witnessPicID} from the token picture #${idx+1} does not correspond to any witness picture associated with the token. You may have deleted a witness picture.`);
        return;
    }
    showPicInContextData.base64 = witnessPicData['base64'];
    showPicInContextData.coords = menuArr[menu_idx].token_pictures[idx].coords;
    show_in_context_overlay = true;
    m.redraw();
}
