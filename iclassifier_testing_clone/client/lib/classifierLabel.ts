import type { ClassifierMeaningMap } from "./sampleData";
import { formatClassifierMeaning } from "./classifierMeaningFormat";

const normalizeMeaningLabel = (meaning: string | null | undefined) => {
  const trimmed = String(meaning || "").trim();
  if (!trimmed) return "";
  const bracketMatch = trimmed.match(/en:\s*\[([^\]]+)\]/i);
  if (bracketMatch && bracketMatch[1]) {
    const english = bracketMatch[1].trim();
    return english.split(/[;,]/)[0]?.trim() || english;
  }
  const inlineMatch = trimmed.match(/en:\s*([^;()]+)/i);
  if (inlineMatch && inlineMatch[1]) {
    const english = inlineMatch[1].trim();
    return english.split(/[;,]/)[0]?.trim() || english;
  }
  return trimmed.split(/[;,]/)[0]?.trim() || trimmed;
};

export function getClassifierMeaning(
  classifier: string,
  meanings?: ClassifierMeaningMap,
  projectId?: string
) {
  const normalized = normalizeMeaningLabel(meanings?.[classifier]);
  return formatClassifierMeaning(normalized, projectId);
}

export function formatClassifierLabelText(
  classifier: string,
  meanings?: ClassifierMeaningMap,
  displayLabel?: string,
  projectId?: string
) {
  const meaning = getClassifierMeaning(classifier, meanings, projectId);
  const baseLabel = displayLabel || classifier;
  if (!meaning) return baseLabel;
  return `${baseLabel} [${meaning}]`;
}
