let tokenStatsData = {
	total: 0,
	classified: 0
};

let tokenStats = {
	currentWitness: '---',
	onupdate: () => {
		if (tokenStats.currentWitness !== '---') {
			window.location.hash = `!${project}/stats/${tokenStats.currentWitness}`;
			byID('witness-report-select').value = tokenStats.currentWitness;
		}
	},
	view: () => {
		if (tokenStats.currentWitness !== '---')
			window.location.hash = `!${project}/stats/${tokenStats.currentWitness}`;
		return m(
			'div',
			{ style: {
				display: showTokenStats ? 'block' : 'none', 'padding-top': '0'
			} },
			[
				m('h4', 'Select a witness: '),
				m('br'),
				m(
					'select',
					{
						id: 'witness-report-select',
						style: { width: '300px' },
						onchange: e => {
							getTokenStats(e.target.value);
							tokenStats.currentWitness = e.target.value;
						},
						value: tokenStats.currentWitness
					},
					[m('option', { disabled: true, value: '---' }, '---')]
						.concat(getWitnessMenuData())
				),
				m('br'),
				m(
					'div',
					{
						id: 'token-stats',
						style: { display: tokenStats.currentWitness === '---' ? 'none' : 'block' }
					},
					[
						m('h4', 'Token classification statistics'),
						m('br'),
						m('p', `Total number of tokens: ${tokenStatsData.total}`),
						m('p', `Classified tokens: ${tokenStatsData.classified}`),
					]
				)
			]);
	}
}

function getWitnessMenuData() {
	let tmp = [];
	for (const key in witnessData) {
		if (!witnessData.hasOwnProperty(key))
			continue;
		tmp.push({
			key: key,
			name: witnessData[key].name
		})
	}
	tmp.sort((a, b) => {
		if (a.name.trim() < b.name.trim()) {
			return -1;
		}
		if (a.name.trim() > b.name.trim()) {
			return 1;
		}
		return 0;
	})
	tmp.unshift({ key: 'all', name: 'All witnesses' });
	return tmp.map(obj => m('option', { value: obj.key }, obj.name))
}

function getTokenStats(witness) {
	tokenStatsData.total = 0;
	tokenStatsData.classified = 0;
	if (witness === 'all') {
		for (const key in tokenData) {
			if (!tokenData.hasOwnProperty(key))
				continue;
			tokenStatsData.total += 1;
			if (tokenData[key].classification_status === 'CL')
				tokenStatsData.classified += 1;
		}
	} else {
		for (const key in tokenData) {
			if (!tokenData.hasOwnProperty(key))
				continue;
			if (String(tokenData[key].witness_id) === String(witness)) {
				tokenStatsData.total += 1;
				if (tokenData[key].classification_status === 'CL')
					tokenStatsData.classified += 1;
			}
		}
	}
}