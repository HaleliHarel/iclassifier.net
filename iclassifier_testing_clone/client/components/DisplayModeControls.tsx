import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DisplayModeControlsProps {
  classifierDisplayMode: "visual" | "meaning";
  onClassifierDisplayModeChange: (mode: "visual" | "meaning") => void;
  lemmaDisplayMode: "origin" | "translation" | "both";
  onLemmaDisplayModeChange: (mode: "origin" | "translation" | "both") => void;
  projectType?: string;
  useUnicode?: boolean;
  onUnicodeToggle?: (useUnicode: boolean) => void;
  showLemmaNodes?: boolean;
  compact?: boolean;
}

export default function DisplayModeControls({
  classifierDisplayMode,
  onClassifierDisplayModeChange,
  lemmaDisplayMode,
  onLemmaDisplayModeChange,
  projectType,
  useUnicode,
  onUnicodeToggle,
  showLemmaNodes = true,
  compact = false,
}: DisplayModeControlsProps) {
  const gridClass = showLemmaNodes
    ? (compact ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-4")
    : (compact ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 gap-4");
  const sectionPadding = compact ? "pt-3 pb-3" : "pt-6";
  const titleClass = compact ? "text-[11px] font-semibold mb-1" : "text-xs font-semibold mb-2";
  const buttonClass = compact ? "text-[11px] h-7 px-2" : "text-xs h-8 px-2";
  const unicodeButtonClass = compact ? "text-[10px] h-7 px-2" : "text-xs h-8 px-2";
  const classifierVisualLabel = compact ? "Classifier" : "Show Classifier";
  const classifierMeaningLabel = compact ? "Label" : "Show Classifier Label";
  const unicodeLabel = compact ? "Unicode" : "Show in Unicode";
  const mdcLabel = compact ? "MdC" : "Show Hieroglyphs (MdC)";
  const lemmaOriginLabel = compact ? "Original" : "Lemmas by original form";
  const lemmaTranslationLabel = compact ? "Translation" : "Lemmas by translation";
  const lemmaBothLabel = compact ? "Origin + Trans." : "Lemmas by origin + translation";

  const classifierButtonClass = (active: boolean) =>
    cn(
      buttonClass,
      "border-blue-200 bg-blue-100 text-blue-900 hover:bg-blue-200",
      active && "bg-blue-300 text-blue-950 border-blue-300 shadow-inner"
    );

  const lemmaButtonClass = (active: boolean) =>
    cn(
      buttonClass,
      "border-yellow-200 bg-yellow-100 text-yellow-900 hover:bg-yellow-200",
      active && "bg-yellow-300 text-yellow-950 border-yellow-300 shadow-inner"
    );

  const classifierToggleClass = (active: boolean) =>
    cn(
      unicodeButtonClass,
      "border-blue-200 bg-blue-100 text-blue-900 hover:bg-blue-200",
      active && "bg-blue-300 text-blue-950 border-blue-300 shadow-inner"
    );

  return (
    <div className={gridClass}>
      {/* Classifier Nodes Box */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className={sectionPadding}>
          <h3 className={`${titleClass} text-blue-900`}>Classifier nodes</h3>
          <div className={compact ? "space-y-1" : "space-y-2"}>
            <div className={compact ? "flex flex-wrap gap-1" : "flex flex-wrap gap-2"}>
              <Button
                variant="outline"
                size="sm"
                className={classifierButtonClass(classifierDisplayMode === "visual")}
                onClick={() => onClassifierDisplayModeChange("visual")}
              >
                {classifierVisualLabel}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={classifierButtonClass(classifierDisplayMode === "meaning")}
                onClick={() => onClassifierDisplayModeChange("meaning")}
              >
                {classifierMeaningLabel}
              </Button>
            </div>
            {projectType === "hieroglyphic" && classifierDisplayMode === "visual" && (
              <div className={compact ? "flex flex-wrap gap-1" : "flex flex-wrap gap-2"}>
                <Button
                  variant="outline"
                  size="sm"
                  className={classifierToggleClass(Boolean(useUnicode))}
                  onClick={() => onUnicodeToggle?.(true)}
                >
                  {unicodeLabel}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={classifierToggleClass(!useUnicode)}
                  onClick={() => onUnicodeToggle?.(false)}
                >
                  {mdcLabel}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lemma Nodes Box */}
      {showLemmaNodes && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className={sectionPadding}>
            <h3 className={`${titleClass} text-yellow-900`}>Lemma nodes</h3>
            <div className={compact ? "flex flex-wrap gap-1" : "flex flex-wrap gap-2"}>
              <Button
                variant="outline"
                size="sm"
                className={lemmaButtonClass(lemmaDisplayMode === "origin")}
                onClick={() => onLemmaDisplayModeChange("origin")}
              >
                {lemmaOriginLabel}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={lemmaButtonClass(lemmaDisplayMode === "translation")}
                onClick={() => onLemmaDisplayModeChange("translation")}
              >
                {lemmaTranslationLabel}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={lemmaButtonClass(lemmaDisplayMode === "both")}
                onClick={() => onLemmaDisplayModeChange("both")}
              >
                {lemmaBothLabel}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
