import { useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useProjectContextOverride } from "@/context/ProjectContextOverride";

type CompareReportType = "project" | "network" | "classifier" | "lemma" | "query";

interface CompareTarget {
  type: CompareReportType;
  classifier?: string | null;
  lemmaId?: number | null;
}

export function useCompareNavigation() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { panelPosition } = useProjectContextOverride();
  const isCompare = location.pathname.startsWith("/compare/");

  const setCompareTarget = useCallback(
    (target: CompareTarget) => {
      if (!isCompare || !panelPosition) return false;
      const params = new URLSearchParams(searchParams);
      const typeKey = panelPosition === "left" ? "leftType" : "rightType";
      const lemmaKey = `${panelPosition}LemmaId`;
      const classifierKey = `${panelPosition}Classifier`;

      params.set(typeKey, target.type);

      if (target.type === "lemma") {
        if (target.lemmaId !== null && target.lemmaId !== undefined) {
          params.set(lemmaKey, String(target.lemmaId));
        } else {
          params.delete(lemmaKey);
        }
        params.delete(classifierKey);
      } else if (target.type === "classifier") {
        if (target.classifier) {
          params.set(classifierKey, target.classifier);
        } else {
          params.delete(classifierKey);
        }
        params.delete(lemmaKey);
      } else {
        params.delete(lemmaKey);
        params.delete(classifierKey);
      }

      setSearchParams(params);
      return true;
    },
    [isCompare, panelPosition, searchParams, setSearchParams]
  );

  const getCompareParam = useCallback(
    (key: "lemmaId" | "classifier") => {
      if (!isCompare || !panelPosition) return null;
      const paramKey = key === "lemmaId" ? `${panelPosition}LemmaId` : `${panelPosition}Classifier`;
      return searchParams.get(paramKey);
    },
    [isCompare, panelPosition, searchParams]
  );

  return { isCompare, panelPosition, setCompareTarget, getCompareParam };
}
