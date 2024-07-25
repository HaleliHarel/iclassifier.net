let report = {
	view: () => {
		return m(
			'div#report-main',
			[
				m('div#button-row', [
					m('button', {
						disabled: project === null,
						onclick: toggleTokenStats,
					}, 'Show token classification statistics'),
					m('button', {
						disabled: project === null,
						style: {'margin-left': '5px'},
						onclick: toggleClfQueries
					}, 'Show classifier queries'),
					m('button', {
						disabled: project === null,
						// So that we do not pass the event as the parameter.
						onclick: () => { toggleClfReport(undefined) },
						style: {'margin-left': '5px'}
					}, 'Show classifier reports'),
					m('button', {
						disabled: project === null,
						onclick: toggleLemmaReport,
						style: {'margin-left': '5px'}
					}, 'Show lemma reports'),
					m('button', {
						disabled: project === null,
						onclick: toggleMap,
						style: {'margin-left': '5px'}
					}, 'Show classifier map')
				]),

				m(
					'div#download', {
						style: {
							display: downloadingData ? 'block' : 'none',
							'margin-top': '5px'
						}
					},
					m('span', 'Fetching data...')
				),

				// token classification statistics
				m(tokenStats),

				m(clfQueries),

				m(clfReport),

				m(lemmaReport),

				m(map)
			]
		);
	}
}
