import type { ClassifierMeaningMap, Lemma } from "./sampleData";

import labelsUpdatedJson from "./labels_data/labels_updated_live_2026.json?raw";

type FallbackLabelSource = {
  labels: Record<string, string>;
  lemmaIds: Record<string, number>;
};

const FALLBACK_DATA = JSON.parse(labelsUpdatedJson) as Record<string, FallbackLabelSource>;

const PROJECT_FALLBACK_KEY: Record<string, string> = {
  "ancient-egyptian": "egyptian",
  gebhardselz: "sumerian",
  luwiancorpus: "luwian",
  kilivilatest: "kilivila",
  guodianimported: "chinese"
};

const resolveFallbackKey = (projectId: string, projectType?: string) => {
  if (PROJECT_FALLBACK_KEY[projectId]) return PROJECT_FALLBACK_KEY[projectId];
  if (projectType === "hieroglyphic") return "egyptian";
  if (projectType === "cuneiform") return "sumerian";
  if (projectType === "anatolian") return "luwian";
  if (projectType === "chinese") return "chinese";
  return "";
};

const coerceMeaning = (value: string | undefined | null) => {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 ? trimmed : "";
};

export const mergeClassifierMeaningsWithFallback = ({
  projectId,
  projectType,
  classifierMeanings,
  lemmas
}: {
  projectId: string;
  projectType?: string;
  classifierMeanings: ClassifierMeaningMap;
  lemmas?: Record<number, Lemma>;
}) => {
  const fallbackKey = resolveFallbackKey(projectId, projectType);
  if (!fallbackKey) return classifierMeanings;

  const fallback = FALLBACK_DATA[fallbackKey];
  if (!fallback) return classifierMeanings;

  const merged: ClassifierMeaningMap = { ...classifierMeanings };

  Object.entries(fallback.labels).forEach(([classifier, label]) => {
    const existing = coerceMeaning(merged[classifier]);
    if (existing) return;
    const fallbackLabel = coerceMeaning(label);
    if (fallbackLabel) {
      merged[classifier] = fallbackLabel;
    }
  });

  Object.entries(fallback.lemmaIds).forEach(([classifier, lemmaId]) => {
    const existing = coerceMeaning(merged[classifier]);
    if (existing) return;
    const lemma = lemmas?.[lemmaId];
    const fallbackLabel = coerceMeaning(lemma?.meaning || lemma?.transliteration || String(lemmaId));
    if (fallbackLabel) {
      merged[classifier] = fallbackLabel;
    }
  });

  return merged;
};
