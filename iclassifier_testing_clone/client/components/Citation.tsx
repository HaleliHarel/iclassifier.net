import { useMemo } from "react";

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
}

export default function Citation({
  type,
  projectName,
  authors,
  projectId,
  lemmaInfo,
  classifierId,
}: CitationProps) {
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

  return (
    <div className="mt-12 pt-8 border-t border-gray-300">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Citation</h3>
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm leading-relaxed text-gray-700">{citationText}</p>
      </div>
    </div>
  );
}
