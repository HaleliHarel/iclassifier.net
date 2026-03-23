import { useMemo, useState } from "react";

interface CitationProps {
  type: "lemma" | "classifier" | "query" | "network" | "project";
  projectName: string;
  authors: string;
  projectId: string;
  lemmaInfo?: {
    transliteration: string;
    meaning: string;
    id?: number;
  };
  classifierId?: string;
  variant?: "default" | "compact";
  title?: string;
}

export default function Citation({
  type,
  projectName,
  authors,
  projectId,
  lemmaInfo,
  classifierId,
  variant = "default",
  title = "Citation",
}: CitationProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const citationText = useMemo(() => {
    const year = new Date().getFullYear();
    const url = window.location.href;
    const editors = "O. Goldwasser, H. Harel and D. Nikolaev";
    let pageId = "";

    if (type === "lemma" && lemmaInfo) {
      const lemmaLabel = `${lemmaInfo.transliteration}${lemmaInfo.meaning ? ` (${lemmaInfo.meaning})` : ""}`;
      pageId = `Lemma ${lemmaLabel}${lemmaInfo.id ? ` [${lemmaInfo.id}]` : ""} in ${projectName}`;
    } else if (type === "classifier" && classifierId) {
      pageId = `Classifier ${classifierId} in ${projectName}`;
    } else if (type === "network") {
      pageId = `Network map for ${projectName}`;
    } else if (type === "query") {
      pageId = `Query report for ${projectName}`;
    } else if (type === "project") {
      pageId = `Project page for ${projectName}`;
    }

    return `${authors}. ${year}. ${pageId}. In: iClassifier reports, edited by ${editors}. ${url}.`;
  }, [type, projectName, authors, projectId, lemmaInfo, classifierId]);

  const handleCopy = async () => {
    const text = citationText;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("idle");
    }
  };

  const containerClassName = variant === "compact"
    ? "space-y-2"
    : "mt-12 pt-8 border-t border-gray-300";
  const boxClassName = variant === "compact"
    ? "rounded-lg border border-gray-200 bg-gray-50 p-3"
    : "p-4 bg-gray-50 rounded-lg border border-gray-200";
  const titleClassName = variant === "compact"
    ? "text-xs font-semibold text-gray-900 mb-2"
    : "text-sm font-semibold text-gray-900 mb-3";
  const bodyClassName = variant === "compact"
    ? "text-xs leading-relaxed text-gray-700 break-words [overflow-wrap:anywhere] whitespace-normal"
    : "text-sm leading-relaxed text-gray-700 break-words [overflow-wrap:anywhere] whitespace-normal";

  return (
    <div className={containerClassName}>
      <div className="flex items-center justify-between gap-3">
        <h3 className={titleClassName}>{title}</h3>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs font-semibold text-gray-600 hover:text-gray-900"
        >
          {copyState === "copied" ? "Copied" : "Copy"}
        </button>
      </div>
      <div className={boxClassName}>
        <p className={bodyClassName}>{citationText}</p>
      </div>
    </div>
  );
}
