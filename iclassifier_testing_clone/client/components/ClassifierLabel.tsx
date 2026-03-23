import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { ClassifierMeaningMap } from "@/lib/sampleData";
import { getClassifierMeaning } from "@/lib/classifierLabel";
import { mdc2uni } from "@/lib/mdc2uni";
import { getExtendedSignUrl } from "@/lib/networkUtils";
import { fetchJseshBase64, getJseshImageUrl, getJseshRenderHeight } from "@/lib/jsesh";

interface ClassifierLabelProps {
  classifier: string;
  meanings?: ClassifierMeaningMap;
  displayLabel?: string;
  className?: string;
  meaningClassName?: string;
  projectType?: string;
  projectId?: string;
  showGlyph?: boolean;
  glyphClassName?: string;
  glyphImageClassName?: string;
}

const INLINE_GLYPH_HEIGHT = 22;
const inlineJseshCache = new Map<string, string>();

export default function ClassifierLabel({
  classifier,
  meanings,
  displayLabel,
  className,
  meaningClassName,
  projectType,
  projectId,
  showGlyph,
  glyphClassName,
  glyphImageClassName,
}: ClassifierLabelProps) {
  const meaning = getClassifierMeaning(classifier, meanings, projectId);
  const isHieroglyphic = projectType === "hieroglyphic";
  const isCuneiform = projectType === "cuneiform";
  const unicodeGlyph = useMemo(() => (isHieroglyphic ? mdc2uni[classifier] : undefined), [classifier, isHieroglyphic]);
  const hasUnicodeGlyph = Boolean(unicodeGlyph && (unicodeGlyph.codePointAt(0) || 0) >= 256);
  const extendedSignUrl = useMemo(
    () => (showGlyph && isHieroglyphic && !hasUnicodeGlyph ? getExtendedSignUrl(classifier) : null),
    [classifier, hasUnicodeGlyph, isHieroglyphic, showGlyph],
  );
  const [jseshImageUrl, setJseshImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!showGlyph || !isHieroglyphic || hasUnicodeGlyph || extendedSignUrl) {
      setJseshImageUrl(null);
      return;
    }
    const cached = inlineJseshCache.get(classifier);
    if (cached) {
      setJseshImageUrl(cached);
      return;
    }
    let isActive = true;
    fetchJseshBase64(classifier, getJseshRenderHeight(INLINE_GLYPH_HEIGHT), true)
      .then((base64) => {
        if (!isActive || !base64) return;
        const url = getJseshImageUrl(base64);
        inlineJseshCache.set(classifier, url);
        setJseshImageUrl(url);
      })
      .catch(() => undefined);
    return () => {
      isActive = false;
    };
  }, [classifier, extendedSignUrl, hasUnicodeGlyph, isHieroglyphic, showGlyph]);

  const glyphNode = showGlyph && isHieroglyphic
    ? hasUnicodeGlyph
      ? (
          <span className={cn("egyptian-unicode text-lg leading-none", glyphClassName)}>
            {unicodeGlyph}
          </span>
        )
      : extendedSignUrl
        ? (
            <img
              src={extendedSignUrl}
              alt={classifier}
              className={cn("h-5 w-5 object-contain align-baseline", glyphImageClassName)}
            />
          )
        : jseshImageUrl
          ? (
              <img
                src={jseshImageUrl}
                alt={classifier}
                className={cn("h-5 w-5 object-contain align-baseline", glyphImageClassName)}
              />
            )
          : null
    : null;

  return (
    <span className={cn("inline-flex items-baseline gap-1 font-mono", className)}>
      {glyphNode}
      <span className={cn(isCuneiform && "cuneiform-unicode")}>{displayLabel || classifier}</span>
      {meaning ? (
        <span
          className={cn(
            "text-[14px] font-semibold tracking-wide text-gray-500 [font-variant:all-small-caps] font-sans",
            meaningClassName,
          )}
        >
          [{meaning}]
        </span>
      ) : null}
    </span>
  );
}
