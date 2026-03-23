import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { CLASSIFIER_TYPE_LABELS } from "@/lib/sampleData";

interface TypeSelectorProps {
  selectedTypes: Set<string>;
  onTypesChange: (types: Set<string>) => void;
}

export default function TypeSelector({
  selectedTypes,
  onTypesChange,
}: TypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (type: string) => {
    const next = new Set(selectedTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onTypesChange(next);
  };

  const summaryLabel = useMemo(() => {
    if (selectedTypes.size === 0) return "All types";
    const selected = CLASSIFIER_TYPE_LABELS.filter(([type]) => selectedTypes.has(type));
    if (selected.length <= 2) {
      return selected.map(([, label]) => label).join(", ");
    }
    return `${selected.length} types selected`;
  }, [selectedTypes]);

  return (
    <div className="w-full">
      <label className="block text-sm font-semibold mb-2">
        Subset by type:
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
              {CLASSIFIER_TYPE_LABELS.map(([type, label]) => (
                <div key={type} className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedTypes.has(type)}
                    onCheckedChange={() => handleToggle(type)}
                    className="cursor-pointer"
                  />
                  <label
                    onClick={() => handleToggle(type)}
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
