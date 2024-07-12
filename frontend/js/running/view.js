const bulkInputInfo = {
	witness_id: null,
	supertext_id: null,
	tokens: [],
	store_coordinates: false,
	menu_data: {
		inputString: '',
		jseshQueryTimeout: null,
		// Minimise the amount of redrawing?
		// An array of [idx, mdc] tuples.
		jseshCache: [],
		witnessName: null,
		tokenSeparator: 'whitespace',
		tokenType: 'transcription',
		first_line_number: 1
	}
}

const tableCellStyle = {
	'background-color': 'white',
	border: '1px dotted grey',
	padding: '2px'
};

let bulk_entry_menu = {
	view: (vnode) => {
		let menu_idx = vnode.attrs.menu_idx;
		return m(
			'div.wide-menu',
			[
				m('div.menu-row-wide',
					{ style: { display: 'flex', 'justify-content': 'flex-end' } },
					m(killButton, { menu_idx: menu_idx })),
				m('div.menu-row-wide.running-color', [
					m('label', { for: `${menu_idx}-running-witness-select` }, 'Select a witness: '),
					m(menuCacheMenu, {
						menu_idx: menu_idx,
						menuName: 'witness-search-menu',
						cacheFieldName: 'witness',
						filterDict: witnessFilterDict,
						filterFunction: (tuple, containerId) => {
							let test = get(
								witnessFilterDict,
								containerId,
								''
							).toLowerCase();
							return String(tuple[1].name).toLowerCase().indexOf(test) >= 0;
						},
						divBuilderCallback: (tuple, containerId) => {
							let button = document.createElement('div');
							button.innerText = `${tuple[0]}: ${tuple[1].name}`;
							button.classList.add('menu-button-value');
							button.onclick = () => {
								clfFilterDict[containerId] = '';
								menuArr[menu_idx].witness_id = tuple[0];
								menuArr[menu_idx].menu_data.witnessName = tuple[1].name;
								m.redraw();
							}
							return button;
						}
					}),
					m(menuCacheButton, {
						menu_idx: menu_idx,
						menuName: 'witness-search-menu'
					}),
					m('div', { style: { display: menuArr[menu_idx].witness_id === null ? 'none' : 'block' } }, [
						m('br'),
						m('span', 'Selected witness: '),
						m('span', { style: { 'font-weight': 'bold' } }, menuArr[menu_idx].menu_data.witnessName)
					])
				]),
				m('div.menu-row-wide.running-color', [
					m('span', 'Tokens are separated by'), m('br'),
					m('input[type=radio]', {
						name: `${menu_idx}-token-separator`,
						checked: menuArr[menu_idx].menu_data.tokenSeparator === 'whitespace',
						id: `${menu_idx}-token-separator-whitespace`,
						onchange: e => {
							e.redraw = false;
							menuArr[menu_idx].menu_data.tokenSeparator = 'whitespace';
						}
					}),
					m('label', { for: `${menu_idx}-token-separator-whitespace` }, 'any whitespace'),
					m('span', { style: { color: 'grey' } }, ' (only single-word tokens are allowed)'),
					m('br'),
					m('input[type=radio]', {
						name: `${menu_idx}-token-separator`,
						checked: menuArr[menu_idx].menu_data.tokenSeparator === 'newline',
						id: `${menu_idx}-token-separator-newline`,
						onchange: e => {
							e.redraw = false;
							menuArr[menu_idx].menu_data.tokenSeparator = 'newline';
						}
					}),
					m('label', { for: `${menu_idx}-token-separator-newline` }, 'newline'),
					m('span', { style: { color: 'grey' } }, ' (multi-word tokens are allowed)'),
				]),

				m('div.menu-row-wide.running-color', [
					m('span', 'Tokens are in'), m('br'),
					m('input[type=radio]', {
						name: `${menu_idx}-token-type`,
						checked: menuArr[menu_idx].menu_data.tokenType === 'transcription',
						id: `${menu_idx}-token-type-transcription`,
						onchange: e => {
							e.redraw = false;
							menuArr[menu_idx].menu_data.tokenType = 'transcription';
						}
					}),
					m('label', { for: `${menu_idx}-token-type-transcription` }, 'transcription'),
					m('span', { style: { color: 'grey' } }, ' (classifiers can be marked with ~’s)'),
					m('br'),
					m('input[type=radio]', {
						name: `${menu_idx}-token-type`,
						checked: menuArr[menu_idx].menu_data.tokenType === 'transliteration',
						id: `${menu_idx}-token-type-transliteration`,
						onchange: e => {
							e.redraw = false;
							menuArr[menu_idx].menu_data.tokenType = 'transliteration';
						}
					}),
					m('label', { for: `${menu_idx}-token-type-transliteration` }, 'transliteration'),
					m('span', { style: { color: 'grey' } }, ' (classifiers cannot be marked)'),
				]),

				m('div.menu-row-wide.running-color', [
					m('input[type=checkbox]', {
						id: `${menu_idx}-store-coords`,
						checked: menuArr[menu_idx].store_coordinates,
						onclick: e => {
							menuArr[menu_idx].store_coordinates = e.target.checked;
						}
					}),
					m('label', { for: `${menu_idx}-store-coords` }, 'use line and word numbers as coordinates in witness')
				]),
				m('div.menu-row-wide.running-color', [
					m('label', { for: `${menu_idx}-first-line-number` }, 'The number of the first line is '),
					m('input[type=text]', {
						value: menuArr[menu_idx].menu_data.first_line_number,
						placeholder: 1,
						disabled: !menuArr[menu_idx].store_coordinates,
						oninput: e => {
							e.redraw = false;
							if (e.target.value === '') {
								menuArr[menu_idx].menu_data.first_line_number = 1;
								return;
							}
							if (e.target.value.match(/^\d+$/) === null) {
								e.target.value = Array.from(e.target.value)
									.filter(char => char.match(/\d/))
									.join('');
								return;
							}
							menuArr[menu_idx].menu_data.first_line_number = parseInt(e.target.value);
						}
					})
				]),
				m('div.menu-row-wide.running-color', [
					m('h4', { style: { 'margin-bottom': '5px' } }, 'The text'),
					m('div', { style: { 'margin-bottom': '5px' } },
						'(Empty lines will be ignored. Use # to mark empty lines that ' +
						'have no tokens but contribute to the line count. ' +
						'Use $$ to mark uninteresting or unreadable tokens that should be ' +
						'skipped but contribute to the token count.)'),
					m(`textarea`, {
						class: projectType,
						style: { width: '98%', height: '300px', 'font-size': '14pt' },
						value: menuArr[menu_idx].menu_data.inputString,
						oninput: e => {
							e.redraw = false;
							menuArr[menu_idx].menu_data.inputString = e.target.value;
							// Prevent the query from firing before the user ends typing.
							clearTimeout(menuArr[menu_idx].menu_data.jseshQueryTimeout);
							menuArr[menu_idx].menu_data.jseshQueryTimeout = setTimeout(() => {
								updateDataAndFetchJseshBulk(menu_idx)
							}, 1000);
						}
					})
				]
				),
				m('div.menu-row-wide.running-color', [
					m('h4', { style: { 'margin-bottom': '5px' } }, 'Extracted tokens as a table:'),
					m(
						'div',
						{
							style: {
								width: '98%',
								display: menuArr[menu_idx].tokens.length === 0 ? 'none' : 'block'
							}
						},
						m('table', { style: { 'border-collapse': 'collapse' } }, [m('tr',
							[
								m('th', { style: tableCellStyle }, 'Token'),
								m('th', { style: tableCellStyle }, 'Coordinates in witness')])
						].concat([
							menuArr[menu_idx].tokens.map(tokenDict => m('tr', [
								m('td', { style: tableCellStyle }, tokenDict.token),
								m('td', { style: tableCellStyle }, tokenDict.coord)
							]))]))
					)
				]),
				m('input[type=button]', {
					onclick: () => {
						extractAndCheckTokens(menu_idx);
					}, value: 'Show extracted tokens'
				}),
				m('input[type=button]', {
					disabled: menuArr[menu_idx].tokens.length === 0,
					onclick: e => {
						e.redraw = false;
						submitText(menu_idx);
					}, value: 'Submit'
				}),
				// A container for Jsesh pictures for hieroglyphic input.
				m(`div#bulk-input-vis-${menu_idx}.menu-row-wide`, {
					style: { width: '100%', display: projectType === 'hieroglyphic' ? 'block' : 'none' },
				})
			]
		)
	}
}

function extractAndCheckTokens(menu_idx) {
	const inputString = menuArr[menu_idx].menu_data.inputString,
		separator = menuArr[menu_idx].menu_data.tokenSeparator;
	let tokenArr = extractTokens(inputString, separator, menu_idx);
	if (tokenArr.length === 0) {
		return;
	}

	console.log(tokenArr);

	// Postprocessing
	// Check that ~'s are matched.
	for (const tokenDatum of tokenArr) {
		if (tokenDatum.token.split('').filter(char => char === '~').length % 2 !== 0) {
			alert(`Mismatched ~'s in token "${tokenDatum.token}" (${tokenDatum.coord}).`);
			return;
		}
	}

	menuArr[menu_idx].tokens = tokenArr;
	updateDataAndFetchJseshBulk(menu_idx);
}

// Returns an arr of tokens consisting of their value and coordinates in the witness:
// [{
// token: XXX,
// coord: XXX
// },
// ...]
function extractTokens(text, separator, menu_idx) {
	let result = [];

	let lineArrRaw = text.split(/\n+/)
		.map(line => line.trim())
		.filter(line => line !== "");

	if (lineArrRaw.length === 0) {
		return result;
	}

	let lineArr = [];
	const firstLineNumber = menuArr[menu_idx].menu_data.first_line_number;
	for (let i = 0; i < lineArrRaw.length; i++) {
		if (lineArrRaw[i] === '#') continue;
		lineArr.push({
			line: lineArrRaw[i],
			coord: i + firstLineNumber
		});
	}

	for (let j = 0; j < lineArr.length; j++) {
		if (separator === "whitespace") {
			let tokenArr = lineArr[j].line.split(/\s+/)
				.map(token => token.trim())
				.filter(token => token !== "");
			for (let i = 0; i < tokenArr.length; i++) {
				if (tokenArr[i] === '$$') { continue; }
				result.push({
					token: tokenArr[i],
					coord: `${lineArr[j].coord},${i + 1}`
				})
			}
		} else {
			// The whole line is a token.
			result.push({
				token: lineArr[j].line,
				coord: `${lineArr[j].coord}`
			})
		}
	}
	console.log(result);
	return result
}

function submitText(menu_idx) {
	if (menuArr[menu_idx].witness_id === null) {
		alert("A witness must be selected.");
		return;
	}

	// Send the data.
	const POST_data = {
		witness_id: menuArr[menu_idx].witness_id,
		tokens: menuArr[menu_idx].tokens,
		store_coordinates: menuArr[menu_idx].store_coordinates
	};

	// console.log(JSON.stringify(POST_data, '', 2));

	const postURL = menuArr[menu_idx].menu_data.tokenType === 'transcription' ?
		`${dbAPIURL}/tokens/addtokenstowitness` :
		`${dbAPIURL}/tokens/addtokenstowitnesstransliteration`;

	fetch(postURL, {
		method: 'POST',
		headers: {
			'Content-Type': 'text/plain',
		},
		body: JSON.stringify(POST_data),
		credentials: 'include'
	}).then(response => {
		if (!response.ok)
			alert('Failed to add tokens to the witness.');
		else {
			alert('Tokens successfully added.');
			fetchTokenIDs();
		}
	});
}