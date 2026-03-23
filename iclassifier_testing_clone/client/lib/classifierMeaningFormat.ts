export const KILIVILA_PROJECT_ID = "kilivilatest";

const stripClassifierMeaning = (
  meaning: string | null | undefined,
  projectId?: string
) => {
  let cleaned = String(meaning || "").trim();
  if (!cleaned) return "";
  if (projectId === KILIVILA_PROJECT_ID) {
    cleaned = cleaned.replace(/\bcp\b\.?\s*/gi, "");
  }
  cleaned = cleaned
    .replace(/<[^>]+>/g, "")
    .replace(/^[\[\]'"“”‘’]+|[\[\]'"“”‘’]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned;
};

const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

export const formatClassifierMeaning = (
  meaning: string | null | undefined,
  projectId?: string
) => {
  const trimmed = stripClassifierMeaning(meaning, projectId);
  if (!trimmed) return "";
  if (projectId === KILIVILA_PROJECT_ID) {
    return trimmed.toUpperCase();
  }
  return trimmed;
};

export const formatClassifierMeaningLabel = (
  meaning: string | null | undefined,
  projectId?: string,
  options?: { html?: boolean }
) => {
  const trimmed = stripClassifierMeaning(meaning, projectId);
  if (!trimmed) return "";
  const normalized = trimmed.toUpperCase();
  if (options?.html) {
    return `[${escapeHtml(normalized)}]`;
  }
  return `[${normalized}]`;
};
