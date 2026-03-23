import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { CLASSIFIER_LEVEL_LABELS } from "@/lib/sampleData";

interface LevelSelectorProps {
  selectedLevels: Set<number>;
  onLevelsChange: (levels: Set<number>) => void;
  maxLevel?: number;
}

export default function LevelSelector({
  selectedLevels,
  onLevelsChange,
  maxLevel = 5,
}: LevelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (level: number) => {
    const newSelection = new Set(selectedLevels);
    if (newSelection.has(level)) {
      newSelection.delete(level);
    } else {
      newSelection.add(level);
    }
    onLevelsChange(newSelection);
  };

  const levelLabelMap = new Map<number, string>(CLASSIFIER_LEVEL_LABELS);
  const selectedLevelList = Array.from(selectedLevels).sort((a, b) => a - b);
  const summaryLabel =
    selectedLevelList.length === 0
      ? "All levels"
      : selectedLevelList.length <= 2
        ? selectedLevelList
            .map((level) => levelLabelMap.get(level) || `Level ${level}`)
            .join(", ")
        : `${selectedLevelList.length} levels selected`;

  return (
    <div className="w-full">
      <label className="block text-sm font-semibold mb-2">
        Subset by level:
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm">{summaryLabel}</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              isOpen ? "transform rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 border border-gray-300 rounded-lg bg-white shadow-lg z-10">
            <div className="p-4 space-y-3">
              {CLASSIFIER_LEVEL_LABELS
                .filter(([level]) => level <= maxLevel)
                .map(([level, label]) => (
                  <div key={level} className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedLevels.has(level)}
                      onCheckedChange={() => handleToggle(level)}
                      className="cursor-pointer"
                    />
                    <label
                      onClick={() => handleToggle(level)}
                      className="text-sm cursor-pointer hover:text-blue-600"
                    >
                      {label}
                    </label>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
