let tokenStatsData = {
  total: 0,
  classified: 0,
  clfByPOS: {},
};

let tokenStats = {
  currentWitness: "---",
  onupdate: () => {
    if (tokenStats.currentWitness !== "---") {
      // window.location.hash = `!${project}/stats/${tokenStats.currentWitness}`;
      byID("witness-report-select").value = tokenStats.currentWitness;
    }
  },
  view: () => {
    // if (tokenStats.currentWitness !== '---')
    // 	window.location.hash = `!${project}/stats/${tokenStats.currentWitness}`;
    return m(
      "div",
      {
        style: {
          display: showTokenStats ? "block" : "none",
          "padding-top": "0",
        },
      },
      [
        m("h4", "Select a witness: "),
        m("br"),
        m(
          "select",
          {
            id: "witness-report-select",
            style: { width: "300px" },
            onchange: (e) => {
              getTokenStats(e.target.value);
              tokenStats.currentWitness = e.target.value;
            },
            value: tokenStats.currentWitness,
          },
          [m("option", { disabled: true, value: "---" }, "---")].concat(
            getWitnessMenuData(),
          ),
        ),
        m("br"),
        m(
          "div",
          {
            id: "token-stats",
            style: {
              display: tokenStats.currentWitness === "---" ? "none" : "block",
            },
          },
          [
            m("h4", "Token classification statistics"),
            m("br"),
            m("p", `Total number of tokens: ${tokenStatsData.total}`),
            m("p", `Classified tokens: ${tokenStatsData.classified}`),
            m("br"),
            m("h5", "Classified tokens by part of speech"),
            m(
              "table",
              { style: { borderCollapse: "collapse", width: "60%" } },
              [
                m("tr", [
                  m(
                    "th",
                    { style: { border: "1px solid #ccc", padding: "4px" } },
                    "POS",
                  ),
                  m(
                    "th",
                    { style: { border: "1px solid #ccc", padding: "4px" } },
                    "Classified",
                  ),
                  m(
                    "th",
                    { style: { border: "1px solid #ccc", padding: "4px" } },
                    "Unclassified",
                  ),
                ]),
                Object.entries(tokenStatsData.clfByPOS).map(([pos, stats]) =>
                  m("tr", [
                    m(
                      "td",
                      { style: { border: "1px solid #ccc", padding: "4px" } },
                      pos,
                    ),
                    m(
                      "td",
                      { style: { border: "1px solid #ccc", padding: "4px" } },
                      stats.classified,
                    ),
                    m(
                      "td",
                      { style: { border: "1px solid #ccc", padding: "4px" } },
                      stats.unclassified,
                    ),
                  ]),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  },
};

function getWitnessMenuData() {
  let tmp = [];
  for (const key in witnessData) {
    if (!witnessData.hasOwnProperty(key)) continue;
    tmp.push({
      key: key,
      name: witnessData[key].name,
    });
  }
  tmp.sort((a, b) => {
    if (a.name.trim() < b.name.trim()) {
      return -1;
    }
    if (a.name.trim() > b.name.trim()) {
      return 1;
    }
    return 0;
  });
  tmp.unshift({ key: "all", name: "All witnesses" });
  return tmp.map((obj) => m("option", { value: obj.key }, obj.name));
}

function getTokenStats(witness) {
  tokenStatsData.total = 0;
  tokenStatsData.classified = 0;
  tokenStatsData.clfByPOS = {};
  for (const key in tokenData) {
    if (!tokenData.hasOwnProperty(key)) continue;
    if (
      witness === "all" ||
      String(tokenData[key].witness_id) === String(witness)
    ) {
      tokenStatsData.total += 1;
      const pos = tokenData[key].pos || "UNKNOWN";
      if (!tokenStatsData.clfByPOS.hasOwnProperty(pos)) {
        tokenStatsData.clfByPOS[pos] = { classified: 0, unclassified: 0 };
      }
      if (isClassified(key)) {
        tokenStatsData.classified += 1;
        tokenStatsData.clfByPOS[pos].classified += 1;
      } else {
        tokenStatsData.clfByPOS[pos].unclassified += 1;
      }
      // if (tokenData[key].classification_status === 'CL')
      // 	tokenStatsData.classified += 1;
    }
  }
}

function isClassified(tokenId) {
  if (!tokenData.hasOwnProperty(tokenId)) return false;
  const mdcMarkup = tokenData[tokenId].mdc_w_markup;
  return typeof mdcMarkup === "string" && mdcMarkup.includes("~");
}
