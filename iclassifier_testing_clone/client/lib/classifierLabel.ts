import type { ClassifierMeaningMap } from "./sampleData";

export function getClassifierMeaning(
  classifier: string,
  meanings?: ClassifierMeaningMap
) {
  return meanings?.[classifier] || "";
}

export function formatClassifierLabelText(
  classifier: string,
  meanings?: ClassifierMeaningMap,
  displayLabel?: string
) {
  const meaning = getClassifierMeaning(classifier, meanings);
  const baseLabel = displayLabel || classifier;
  if (!meaning) return baseLabel;
  return `${baseLabel} [${meaning}]`;
}
