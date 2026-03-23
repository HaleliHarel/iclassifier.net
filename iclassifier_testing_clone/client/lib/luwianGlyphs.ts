// Auto-generated from data/labels_data/luwian_labels.csv and public/luwian
export const LUWIAN_CLASSIFIER_GLYPH_MAP: Record<string, string> = {
  "AEDIFICARE": "246",
  "AEDIFICIUM": "244",
  "ANIMA": "383",
  "ASCIA": "241",
  "ASINUS2": "101",
  "AVUS": "331",
  "BIBERE": "8",
  "BONUS": "402",
  "BONUS2": "370",
  "BOS": "105",
  "CAELUM": "182",
  "CANIS": "98",
  "CAPUT": "10",
  "CASTRUM": "231",
  "CONTRACTUS": "344",
  "COR": "237",
  "CRUX": "309",
  "CUBITUM": "243",
  "CULTER": "338",
  "CURRUS": "288",
  "DARE": "66",
  "DEUS": "404",
  "DIES": "358",
  "DOMUS": "247",
  "EDERE": "7",
  "EQUUS": "99",
  "FILIA": "45",
  "FINES": "216",
  "FLUMEN": "212",
  "FRONS": "26",
  "FULGUR": "200",
  "I": "388",
  "INFRA": "57",
  "IUSTITIA": "371",
  "LA/I/U": "445",
  "LECTUS": "301",
  "LEPUS": "115",
  "LIBARE": "27",
  "LIGNUM": "292",
  "LOCUS": "201",
  "MAGNUS": "363",
  "MALUS": "368",
  "MALUS2": "368",
  "MANUS": "12",
  "MENSA": "294",
  "MI": "104",
  "MINUS": "381",
  "MORI": "381",
  "NEPOS": "300",
  "OCCIDENS": "379",
  "OCULUS": "25",
  "ORIENS": "172",
  "OVIS": "111",
  "PES2": "371",
  "PODIUM": "264",
  "PONERE": "65",
  "PONERE2": "65",
  "POST": "34",
  "PUGNUS": "39",
  "PURUS": "322",
  "RA/I": "97",
  "REGIO": "43",
  "SA4": "402",
  "SCUTUM": "272",
  "SIGILLUM": "327",
  "SOL": "191",
  "SOLIUM": "299",
  "STELE": "267",
  "SUPER": "70",
  "TERRA": "201",
  "THRONUS": "294",
  "VACUUS": "245",
};

export const LUWIAN_AVAILABLE_GLYPHS = new Set<string>([
  "1",
  "43",
]);

export const getLuwianGlyphSvgPath = (classifier: string) => {
  if (!classifier) return null;
  const rawKey = String(classifier).trim();
  if (!rawKey) return null;
  const glyph =
    LUWIAN_CLASSIFIER_GLYPH_MAP[rawKey] ||
    LUWIAN_CLASSIFIER_GLYPH_MAP[rawKey.toUpperCase()] ||
    LUWIAN_CLASSIFIER_GLYPH_MAP[rawKey.toLowerCase()];
  if (!glyph) return null;
  if (!LUWIAN_AVAILABLE_GLYPHS.has(glyph)) return null;
  return `/luwian/_${glyph}.svg`;
};
