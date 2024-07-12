
async function updateDataAndFetchJseshBulk(menu_idx) {

	const token_lines = bulk_extract_tokens(menuArr[menu_idx].menu_data.inputString);

	if (JSON.stringify(token_lines) === JSON.stringify([]))
		return;

	// TODO: update the data for upload

	if (projectType !== 'hieroglyphic')
		return;

	// Separate new lines and send them to be drawn.
	let lines_to_draw = [],
		cache = menuArr[menu_idx].menu_data.jseshCache,
		all_lines_read = false;
	for (let i = 0; i < token_lines.length && i < cache.length; i++) {
		if (cache[i][0] === i && cache[i][1] === token_lines[i][2])
			continue;
		else {
			lines_to_draw = copy(token_lines.slice(i));
			for (let j = i; j < token_lines.length; j++)
				menuArr[menu_idx].menu_data.jseshCache.push([j, token_lines[j][2]]);
			all_lines_read = true;
			break;
		}
	}

	// When token_lines and cache have identical lines at the beginning,
	// but token_lines has extra at the end.
	if (token_lines.length > cache.length && !all_lines_read) {
		lines_to_draw = copy(token_lines.slice(cache.length));
		for (let i = cache.length; i < token_lines.length; i++)
			menuArr[menu_idx].menu_data.jseshCache.push([i, token_lines[i][2]]);
	}

	if (lines_to_draw.length === 0)
		return;
	
	fetchJseshBulk(lines_to_draw, menu_idx);
}

async function fetchJseshBulk(token_lines, menu_idx) {
	// Use page_n, line_n, and mdc as ids. When first mismatch is found,
	// delete the children starting from it and append new ones.
	byID(`bulk-input-vis-${menu_idx}`).innerHTML = '';
	for (const line of token_lines) {
		const tokens = line[2],
			token_mdc = tokens.join('-').replace(/~/g, ''),
			response = await fetch(jseshURL + token_mdc);
		
		if (!response.ok) {
			alert('Failed to obtain the hieroglyph picture from the server.');
			break;
		}

		const base64 = await response.text();
		let img = document.createElement('img');
		img.src = 'data:image/png;base64,' + base64;
		img.style.display = 'inline-block';
		byID(`bulk-input-vis-${menu_idx}`).appendChild(img);
		byID(`bulk-input-vis-${menu_idx}`).appendChild(document.createElement('br'));
	}
}

/**
 * Returns an array of tokens together with
 * their coordinates in the witness. Each item
 * in the array has the form [page, line, tokens_for_line]
 * Tokens are grouped by line in order to easily show them
 * together in the visualisation.
 */
function bulk_extract_tokens(input_text) {
	if (input_text === '')
		return [];

	let result = [];

	const lines = input_text.split('\n');
	let current_page = '';
	for (let line of lines) {
		line = line.trim();

		let current_line = '';

		if (startswith(line, '### ')) {
			current_page = line.slice(4);
			continue;
		} else if (line === '')
			continue;
		
		let parts = line.split(' '),
			tokens = [];
		if (parts[0].match(/^\d+$/)) {
			current_line = parts[0];
			tokens = parts.slice(1);
		} else
			tokens = parts;

		result.push([current_page, current_line, tokens]);
	}

	return result;
}
