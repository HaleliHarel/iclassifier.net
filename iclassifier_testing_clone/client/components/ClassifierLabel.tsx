import { cn } from "@/lib/utils";
import type { ClassifierMeaningMap } from "@/lib/sampleData";
import { getClassifierMeaning } from "@/lib/classifierLabel";

interface ClassifierLabelProps {
  classifier: string;
  meanings?: ClassifierMeaningMap;
  displayLabel?: string;
  className?: string;
  meaningClassName?: string;
}

export default function ClassifierLabel({
  classifier,
  meanings,
  displayLabel,
  className,
  meaningClassName,
}: ClassifierLabelProps) {
  const meaning = getClassifierMeaning(classifier, meanings);

  return (
    <span className={cn("inline-flex items-baseline gap-1 font-mono", className)}>
      <span>{displayLabel || classifier}</span>
      {meaning ? (
        <span
          className={cn(
            "text-[10px] font-semibold tracking-wide text-gray-500 [font-variant:all-small-caps]",
            meaningClassName,
          )}
        >
          [{meaning}]
        </span>
      ) : null}
    </span>
  );
}
