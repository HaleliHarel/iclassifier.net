// URLs are now derived from siteURL set in the template
const requestURL = siteURL + "/api/readonly",
  jseshURL = "https://iclassifier.pw/jsesh/?mdc=";

let path = null,
  project = null,
  projectType = null,
  downloadingData = false,
  showClfQueries = false,
  showClfReports = false,
  showLemmaReports = false,
  showTokenStats = false,
  showMap = false;

function setMenu(menuName) {
  showClfQueries = false;
  showClfReports = false;
  showLemmaReports = false;
  showMap = false;
  showTokenStats = false;
  switch (menuName) {
    case "clfQueries":
      showClfQueries = true;
      break;
    case "clfReports":
      showClfReports = true;
      break;
    case "lemmaReports":
      showLemmaReports = true;
      break;
    case "map":
      showMap = true;
      break;
    case "tokenStats":
      showTokenStats = true;
      break;
    default:
      break;
  }
}

let tokenData = {},
  clfData = null,
  compoundTokens = null,
  compoundParts = null,
  clfArr = [],
  lemmaData = null,
  witnessData = {};

// A dictionary mapping compound parts to compounds
// and compounds to part id's.
let compoundPartGraph = null,
  part2Compound = {};

// Data for classifier reports
let clfDict = {},
  comDict = {},
  lemDict = {},
  lemMean = {},
  lemTotal = {},
  posDict = {},
  ordDict = {},
  scrDict = {},
  outerCompoundClfDict = {},
  tokensForClf = [];

// Data for subsetting results by witness
let selectedWitnesses = new Set(),
  selectedWitnessButtons = new Set();

// Data for subsetting results by POS
let selectedPOS = new Set(),
  selectedPOSButtons = new Set();

// Data for subsetting results by script
let selectedScripts = new Set(),
  selectedScriptsButtons = new Set();

// A common part of classifier and lemma reports
let statsDiv = {
  view: (vnode) => {
    const dict = vnode.attrs.data,
      font = vnode.attrs.font,
      header = vnode.attrs.header;
    if (JSON.stringify(dict) === JSON.stringify({})) return m("div", "No data");
    else {
      let sortedLemmaCounts = sortCounterDesc(dict);
      return m(
        "div",
        {
          style: {
            width: "900px",
            "max-height": "400px",
            overflow: "auto",
          },
        },
        m(statsTable, {
          data: sortedLemmaCounts,
          font: font,
          header: header,
        }),
      );
    }
  },
};

let statsTable = {
  view: (vnode) => {
    let rows = vnode.attrs.data,
      font = vnode.attrs.font,
      header = vnode.attrs.header,
      cssClass;
    if (font === "unicode-egyptian") cssClass = font;
    else if (font === "default") cssClass = null;
    else cssClass = projectType;

    return m(
      "table.stats",
      [
        m(
          "tr",
          { style: { "border-bottom": "1px dotted black" } },
          header.map((element) =>
            m("th", { style: { "text-align": "left" } }, element),
          ),
        ),
      ].concat(
        rows.map((row) =>
          m(
            "tr",
            row.map((element) =>
              m.trust(`<td class="${cssClass}">${element}</td>`),
            ),
          ),
        ),
      ),
    );
  },
};

function cmpInts(a, b) {
  let aInt = parseInt(a),
    bInt = parseInt(b);
  if (aInt < bInt) return -1;
  else if (aInt > bInt) return 1;
  else return 0;
}

function sortCounterDesc(dict) {
  // Returns an array of the form [key, val...]
  // sorted in the descending order by the first value in val
  // is vals are arrays or by the val itself if it is a scalar.
  let result = [];
  for (const key in dict)
    if (dict.hasOwnProperty(key)) {
      let val = dict[key];
      if (Array.isArray(val)) {
        result.push([key].concat(val));
      } else {
        result.push([key, val]);
      }
    }
  result.sort((a, b) => -1 * cmpInts(a[1], b[1]));
  return result;
}

function byID(id) {
  return document.getElementById(id);
}

// A JS version of Python's "get" method for dicts.
function get(dict, key, plug) {
  if (dict.hasOwnProperty(key)) return dict[key];
  else return plug;
}

function startswith(inputString, prefix) {
  return inputString.indexOf(prefix) === 0;
}

function endswith(inputString, prefix) {
  const slen = inputString.length,
    plen = prefix.length;
  return (
    inputString.indexOf(prefix) !== -1 &&
    inputString.slice(slen - plen) === prefix
  );
}

function goFullScreen(elementID) {
  let element = byID(elementID);
  if (element.requestFullscreen) {
    element.requestFullscreen();
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullScreen();
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
  } else if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
  }
}

function extractClfsFromString(s) {
  let inside_clf = false,
    temp = [],
    result = [];
  if (s === null) return result;
  for (let i = 0; i < s.length; i++) {
    if (s.charAt(i) === "~") {
      if (inside_clf) {
        result.push(temp.join(""));
        temp = [];
        inside_clf = false;
      } else {
        inside_clf = true;
      }
    } else {
      if (inside_clf) temp.push(s.charAt(i));
    }
  }
  return result;
}

function mdc2glyph(mdc) {
  if (projectType !== "hieroglyphic") return mdc;

  if (mdc2uni.hasOwnProperty(mdc)) return mdc2uni[mdc];
  else return mdc;
}

function filterCompoundTokens() {
  compoundTokens = new Set();
  compoundParts = new Set();
  compoundPartGraph = {};
  part2Compound = {};
  for (const key in tokenData) {
    if (!tokenData.hasOwnProperty(key)) continue;
    const compoundId = tokenData[key].compound_id;
    if (compoundId !== null && compoundId !== "") {
      const int_key = parseInt(key),
        int_compoundId = parseInt(compoundId);
      compoundTokens.add(int_compoundId);
      compoundParts.add(int_key);
      // Add the edge to the part-compound graph
      part2Compound[int_key] = int_compoundId;
      if (!compoundPartGraph.hasOwnProperty(int_compoundId))
        compoundPartGraph[int_compoundId] = [];
      compoundPartGraph[int_compoundId].push(int_key);
    }
  }
}

function normaliseScript(scriptId) {
  switch (scriptId) {
    case "thot-71":
      return "hieratic";
    case "thot-67":
      return "demotic";
    case "thot-83":
      return "hieroglyphs";
    default:
      return scriptId;
  }
}

// function switchProjectWrapper(element) {
// 	// A synchronous wrapper that changes the project type and then fires switchProject,
// 	// so that Mithril could redraw the interface without using stale data.

// 	// Delete stats used to draw menus.
// 	clfCounts = {};
// 	lemmasForClfs = {};
// 	projectType = element.value.split('|')[1];

// 	// Fetch data and do the usual stuff.
// 	switchProject(element);
// }

async function loadData() {
  // setMenu(null);
  clfReport.currentClf = "---";
  lemmaReport.currentLemma = "---";
  tokenStats.currentWitness = "---";

  selectedWitnesses.clear();
  selectedWitnessButtons.clear();

  try {
    byID("canvas1").innerHTML = "";
    byID("canvas2").innerHTML = "";
  } catch {}

  // Disable the buttons while loading the data.
  // project = null;
  downloadingData = true;
  // const fields = element.value.split('|'),
  // 	newProject = fields[0];
  // projectType = fields[1];
  // This needs to know the new project type so as not to do
  // unnecessary work.
  // window.location.hash = `!${project}`;
  m.redraw();

  let response = await fetch(`${requestURL}/${project}/tokens/all`);
  if (!response.ok) {
    const message = await response.text();
    alert("Failed to download token info from the server: " + message);
    return;
  }

  tokenData = await response.json();
  filterCompoundTokens();

  response = await fetch(`${requestURL}/${project}/clf_parses/all`);
  if (!response.ok) {
    const message = await response.text();
    alert("Failed to download classifier info from the server: " + message);
    return;
  }
  clfData = await response.json();

  // Extract classifiers
  let clfSet = new Set();
  for (const key in tokenData) {
    if (!tokenData.hasOwnProperty(key)) continue;

    const mdc = tokenData[key].mdc_w_markup,
      clfs = extractClfsFromString(mdc);
    for (const clf of clfs) {
      let glyph = mdc2glyph(clf);
      if (clf !== glyph) clfSet.add(`${glyph} (${clf})`);
      else clfSet.add(glyph);
    }
  }
  clfArr = Array.from(clfSet);
  clfArr.sort();

  response = await fetch(`${requestURL}/${project}/lemmas/all`);
  if (!response.ok) {
    const message = await response.text();
    alert("Failed to download lemma info from the server: " + message);
    return;
  }
  lemmaData = await response.json();

  response = await fetch(`${requestURL}/${project}/witnesses/all`);
  if (!response.ok) {
    const message = await response.text();
    alert("Failed to download witness info from the server: " + message);
    return;
  }
  witnessData = await response.json();

  // Turn the buttons back on.
  // project = newProject;
  downloadingData = false;

  // Modify the displayed URL
  // window.location.hash = '!' + project;

  populateClfDict();
  checkThePathAndRedraw();
}

function populateClfDict() {
  clfCounts = {};
  lemmasForClfs = {};
  // console.clear();
  for (const key in tokenData) {
    // console.log(`Checking: ${key}`);

    if (!tokenData.hasOwnProperty(key)) continue;
    const tokenInfo = tokenData[key],
      lemmaID = tokenInfo.lemma_id,
      clfs = extractClfsFromString(tokenInfo.mdc_w_markup);
    if (clfs.length === 0) continue;

    // Subset by:

    // Token metadata
    const intKey = parseInt(key);
    if (clfQueries.tokenType !== "any") {
      let tokenType = "simple";
      if (compoundTokens.has(intKey)) tokenType = "compound";
      else if (compoundParts.has(intKey)) tokenType = "part";
      if (tokenType !== clfQueries.tokenType) continue;
    }

    if (!POSSet.has("any") && !POSSet.has(tokenInfo.pos)) continue;

    // console.log('Checking witness meta...');
    // Witness metadata
    if (
      clfQueries.witnessId !== "any" &&
      !selectedWitnesses.has(String(tokenInfo.witness_id))
    ) {
      // console.log(clfQueries.witnessId, tokenInfo.witness_id);
      continue;
    }
    // console.log('Witness meta checked passed.');

    let witnessInfo = {
      genre: null,
      script: null,
      period_date_start: null,
      period_date_end: null,
      chrono_date_start: null,
      chrono_date_end: null,
    };
    const witnessId = parseInt(tokenInfo.witness_id);
    if (!isNaN(witnessId) && witnessData.hasOwnProperty(witnessId)) {
      witnessInfo.genre = witnessData[witnessId].genre;
      witnessInfo.script = witnessData[witnessId].script;
      witnessInfo.period_date_start = witnessData[witnessId].period_date_start;
      witnessInfo.period_date_end = witnessData[witnessId].period_date_end;
      witnessInfo.chrono_date_start = witnessData[witnessId].chrono_date_start;
      witnessInfo.chrono_date_end = witnessData[witnessId].chrono_date_end;
    }
    if (clfQueries.genre !== "any" && clfQueries.genre !== witnessInfo.genre)
      continue;
    if (clfQueries.script !== "any" && clfQueries.script !== witnessInfo.script)
      continue;
    // TODO: dates

    // Classifier metadata
    for (const clf of clfs) {
      // If any subsetting was asked for, only
      // parsed classifiers will be shown.
      let clfParse = {
        clf_level: null,
        clf_type: null,
        semantic_relation: null,
      };
      for (const clfParseKey in clfData)
        if (
          clfData.hasOwnProperty(clfParseKey) &&
          clfData[clfParseKey].token_id === intKey &&
          clfData[clfParseKey].gardiner_number === clf
        ) {
          clfParse = JSON.parse(JSON.stringify(clfData[clfParseKey]));
          break;
        }

      if (
        clfQueries.clfLevel != "any" &&
        clfQueries.clfLevel != clfParse.clf_level
      )
        continue;

      if (
        clfQueries.semRelation != "any" &&
        clfQueries.semRelation != clfParse.semantic_relation
      )
        continue;

      let types = new Set();
      for (const clfType of String(clfParse.clf_type).split(";"))
        types.add(clfType);
      if (clfQueries.clfType != "any" && !types.has(clfQueries.clfType))
        continue;

      // He made it
      // Add the lemma
      if (!lemmasForClfs.hasOwnProperty(clf)) lemmasForClfs[clf] = new Set();
      if (lemmaID !== null) lemmasForClfs[clf].add(lemmaID);
      // Count the token
      if (!clfCounts.hasOwnProperty(clf)) clfCounts[clf] = 0;
      clfCounts[clf]++;
    }
  }
}

function toggleClfReport(clf2Report) {
  lemmaReport.currentLemma = "---";
  // window.location.hash = `!${project}/classifiers`;
  selectedWitnesses.clear();
  selectedWitnessButtons.clear();
  selectedPOS.clear();
  selectedPOSButtons.clear();
  selectedScripts.clear();
  selectedScriptsButtons.clear();
  console.log(clf2Report);
  if (clf2Report === undefined) {
    clfReport.currentClf = "---";
    byID("canvas1").innerHTML = "";
    byID("canvas2").innerHTML = "";
  } else {
    clfReport.currentClf = clf2Report;
    getClfReport(clf2Report);
  }
  setMenu("clfReports");
  m.redraw();
}

function checkThePathAndRedraw() {
  // Check the path for a particular report
  if (path === null || path.length === 0)
    //
    m.redraw();
  else {
    console.log(path);
    const reportType = path[0];
    console.log(reportType);
    path = path.slice(1);
    switch (reportType) {
      case "lemmas":
        toggleLemmaReport();
        break;
      case "classifiers":
        let clf2Report;
        if (path !== null && path.length > 0) {
          // Classifiers can contain weird characters.
          clf2Report = decodeURI(path[0]);
          path.length = 0;
        }
        toggleClfReport(clf2Report);
        break;
      case "clfqueries":
        toggleClfQueries();
        break;
      case "map":
        toggleMap();
        break;
      case "stats":
        toggleTokenStats();
        break;
      default:
        m.redraw();
        alert(`Wrong report type: ${reportType}`);
        break;
    }
  }
}

function toggleTokenStats() {
  setMenu("tokenStats");
  selectedWitnesses.clear();
  selectedWitnessButtons.clear();
  m.redraw();
  // window.location.hash = `!${project}/stats`;
}

function toggleClfQueries() {
  setMenu("clfQueries");
  selectedWitnesses.clear();
  selectedWitnessButtons.clear();
  m.redraw();
  // window.location.hash = `!${project}/clfqueries`;
}

function toggleLemmaReport() {
  clfReport.currentClf = "---";
  selectedWitnesses.clear();
  selectedWitnessButtons.clear();
  selectedScripts.clear();
  selectedScriptsButtons.clear();
  if (path !== null && path.length > 0) {
    getLemmaReport(parseInt(path[0]));
    lemmaReport.currentLemma = parseInt(path[0]);
    path.length = 0;
  } else {
    lemmaReport.currentLemma = "---";
  }
  byID("canvas").innerHTML = "";
  setMenu("lemmaReports");
  m.redraw();
  // window.location.hash = `!${project}/lemmas`;
}

function toggleMap() {
  setMenu("map");
  selectedWitnesses.clear();
  selectedWitnessButtons.clear();
  selectedPOS.clear();
  selectedPOSButtons.clear();
  selectedScripts.clear();
  selectedScriptsButtons.clear();
  m.redraw();
  // window.location.hash = `!${project}/map`;
}

function toggleBgrCol(elementID) {
  const currentCol = byID(elementID).style["background-color"];
  byID(elementID).style["background-color"] =
    currentCol === "white" ? "black" : "white";
}

// async function fetchProjects() {
// 	const response = await fetch(`${authURL}/getprojectsforbrowsing`);
// 	if (!response.ok) {
// 		alert("Couldn’t download the list of projects from the server.");
// 		return;
// 	}

// 	const data = await response.json();
// 	let projectSelect = byID('project-select');
// 	for (const key in data) {
// 		if (!data.hasOwnProperty(key))
// 			continue;
// 		let option = document.createElement('option');
// 		option.text = data[key].title;
// 		option.value = `${key}|${data[key].type}`;
// 		projectSelect.appendChild(option);
// 	}

// 	// Check for routes.
// 	const url = window.location.href;
// 	console.log(url);
// 	let parts = url.split('#!');
// 	if (parts.length === 1)
// 		projectSelect.value = '---';
// 	else {
// 		parts = parts[1].split('/');
// 		// Select a project.
// 		const key = parts[0];
// 		if (data.hasOwnProperty(key)) {
// 			projectSelect.value = `${key}|${data[key].type}`;
// 			path = parts.slice(1);
// 			switchProjectWrapper(projectSelect);
// 		} else {
// 			alert(`Wrong project tag in the URL: ${key}`);
// 			path = null;
// 			projectSelect.value = '---';
// 		}
// 	}
// }

/**
 * A function for prettyfying lemma meanings in graphs.
 */
function firstMeaning(meaning) {
  if (meaning === null || meaning === undefined) return "";
  meaning = meaning.split(";")[0];
  meaning = meaning.split(",")[0];
  return meaning;
}

/**
 * Extracts classifiers from the token and shows hieroglyphs
 * in a larger font compared to the Latin text together with
 * witness name and coordinates when those are available.
 */
function showTokenWithClfs(tokenId) {
  let clfArr = extractClfsFromString(tokenData[tokenId].mdc_w_markup),
    colouredSpan = colourClassifiers(tokenData[tokenId].mdc_w_markup);

  if (projectType === "hieroglyphic")
    clfArr = clfArr.map(
      (mdc) =>
        `<span class="hieroglyphic" style="font-size: 16pt">${mdc2glyph(mdc)}</span>`,
    );

  const witnessID = tokenData[tokenId].witness_id;
  let witnessName = null,
    witnessLine = tokenData[tokenId].coordinates_in_witness;

  if (
    witnessID !== "" &&
    witnessID !== null &&
    witnessData[witnessID] !== undefined
  ) {
    witnessName = witnessData[witnessID].name;
  }
  let witnessString = "";
  if (witnessName !== null) {
    witnessString = ` (${tokenId}, ${witnessName}`;
    if (witnessLine !== null && witnessLine !== "")
      witnessString = witnessString + `: ${witnessLine})`;
    else witnessString = witnessString + ")";
  }
  if (clfArr.length > 0)
    return `${colouredSpan} (${clfArr.join(", ")})${witnessString}`;
  else return colouredSpan + witnessString;
}

// document.addEventListener('DOMContentLoaded', fetchProjects);

let witnessSelectComponent = {
  view: (vnode) =>
    m(
      "div",
      {
        style: vnode.attrs.styleDict,
      },
      [
        m("span", "Restrict examples to tokens from the following witnesses: "),
        m("input[type=button]", {
          value: "Clear selection",
          onclick: () => {
            selectedWitnesses.clear();
            selectedWitnessButtons.forEach((b) => {
              b.style.backgroundColor = "palegoldenrod";
              b.style.color = "black";
            });
            selectedWitnessButtons.clear();
          },
        }),
        m("br"),
        m(
          "div",
          {
            style: {
              height: "150px",
              "background-color": "white",
              overflow: "auto",
              border: "1px solid black",
              "border-radius": "2px",
            },
          },
          Object.entries(witnessData)
            .sort((a, b) => {
              if (
                a[1].name.trim().toLowerCase() > b[1].name.trim().toLowerCase()
              ) {
                return 1;
              } else if (
                a[1].name.trim().toLowerCase() < b[1].name.trim().toLowerCase()
              ) {
                return -1;
              } else {
                return 0;
              }
            })
            .map((el) =>
              m(
                "div",
                {
                  style: {
                    display: "inline-block",
                    "background-color": "palegoldenrod",
                    padding: "3px",
                    "border-radius": "3px",
                    margin: "3px",
                    cursor: "pointer",
                    "user-select": "none",
                  },
                  onclick: (e) => {
                    e.redraw = false;
                    if (selectedWitnesses.has(el[0])) {
                      selectedWitnesses.delete(el[0]);
                      selectedWitnessButtons.delete(e.target);
                      e.target.style.backgroundColor = "palegoldenrod";
                      e.target.style.color = "black";
                    } else {
                      selectedWitnesses.add(el[0]);
                      selectedWitnessButtons.add(e.target);
                      e.target.style.backgroundColor = "black";
                      e.target.style.color = "white";
                    }
                  },
                },
                el[1].name,
              ),
            ),
        ),
      ],
    ),
};

// thesauriDict
let scriptSelectComponent = {
  view: (vnode) =>
    m(
      "div",
      {
        style: vnode.attrs.styleDict,
      },
      [
        m("span", "Restrict examples to tokens with the following scripts: "),
        m("input[type=button]", {
          value: "Clear selection",
          onclick: () => {
            selectedScripts.clear();
            selectedScriptsButtons.forEach((b) => {
              b.style.backgroundColor = "palegoldenrod";
              b.style.color = "black";
            });
            selectedScriptsButtons.clear();
          },
        }),
        m("br"),
        m(
          "div",
          {
            style: {
              height: "150px",
              "background-color": "white",
              overflow: "auto",
              border: "1px solid black",
              "border-radius": "2px",
            },
          },
          tuplesOrNothing(projectType, "scripts").map((scriptTuple) =>
            m(
              "div",
              {
                style: {
                  display: "inline-block",
                  "background-color": "palegoldenrod",
                  padding: "3px",
                  "border-radius": "3px",
                  margin: "3px",
                  cursor: "pointer",
                  "user-select": "none",
                },
                onclick: (e) => {
                  e.redraw = false;
                  if (selectedScripts.has(scriptTuple[1])) {
                    selectedScripts.delete(scriptTuple[1]);
                    selectedScriptsButtons.delete(e.target);
                    e.target.style.backgroundColor = "palegoldenrod";
                    e.target.style.color = "black";
                  } else {
                    selectedScripts.add(scriptTuple[1]);
                    selectedScriptsButtons.add(e.target);
                    e.target.style.backgroundColor = "black";
                    e.target.style.color = "white";
                  }
                },
              },
              scriptTuple[0].split("- ").slice(-1)[0],
            ),
          ),
        ),
      ],
    ),
};

function tuplesOrNothing(projectType, thesaurus) {
  if (
    thesauriDict !== undefined &&
    thesauriDict.hasOwnProperty(projectType) &&
    thesauriDict[projectType].hasOwnProperty(thesaurus)
  ) {
    return thesauriDict[projectType][thesaurus];
  } else {
    return [];
  }
}

let posSelectComponent = {
  view: (vnode) =>
    m(
      "div",
      {
        style: vnode.attrs.styleDict,
      },
      [
        m(
          "span",
          "Restrict examples to tokens with the following parts of speech: ",
        ),
        m("input[type=button]", {
          value: "Clear selection",
          onclick: () => {
            selectedPOS.clear();
            selectedPOSButtons.forEach((b) => {
              b.style.backgroundColor = "palegoldenrod";
              b.style.color = "black";
            });
            selectedPOSButtons.clear();
          },
        }),
        m("br"),
        m(
          "div",
          {
            style: {
              height: "150px",
              "background-color": "white",
              overflow: "auto",
              border: "1px solid black",
              "border-radius": "2px",
            },
          },
          extractUniquePOS(tokenData).map((partOfSpeechName) =>
            m(
              "div",
              {
                style: {
                  display: "inline-block",
                  "background-color": "palegoldenrod",
                  padding: "3px",
                  "border-radius": "3px",
                  margin: "3px",
                  cursor: "pointer",
                  "user-select": "none",
                },
                onclick: (e) => {
                  e.redraw = false;
                  if (selectedPOS.has(partOfSpeechName)) {
                    selectedPOS.delete(partOfSpeechName);
                    selectedPOSButtons.delete(e.target);
                    e.target.style.backgroundColor = "palegoldenrod";
                    e.target.style.color = "black";
                  } else {
                    selectedPOS.add(partOfSpeechName);
                    selectedPOSButtons.add(e.target);
                    e.target.style.backgroundColor = "black";
                    e.target.style.color = "white";
                  }
                },
              },
              partOfSpeechName,
            ),
          ),
        ),
      ],
    ),
};

function extractUniquePOS(dataDict) {
  let tmpSet = new Set();

  for (const key in dataDict) {
    if (!dataDict.hasOwnProperty(key)) continue;
    if (dataDict[key].pos === null || dataDict[key].pos.trim() === "") continue;
    tmpSet.add(dataDict[key].pos.trim());
  }
  let result = Array.from(tmpSet);
  result.sort();
  return result;
}

function scriptIsAppropriate(tokenId) {
  if (selectedScripts.size === 0) {
    return true;
  }
  const witnessId = tokenData[tokenId].witness_id;
  if (witnessId !== null && witnessId !== "") {
    if (witnessData[witnessId] === undefined) {
      console.log(`Witness data for witness_id ${witnessId} is undefined.`);
      return false;
    }
    return selectedScripts.has(String(witnessData[witnessId]["script"]));
  } else {
    return false;
  }
}
