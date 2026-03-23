import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface POSSelectorProps {
  availablePOS: string[];
  selectedPOS: Set<string>;
  onSelectionChange: (pos: Set<string>) => void;
}

export default function POSSelector({
  availablePOS,
  selectedPOS,
  onSelectionChange,
}: POSSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (pos: string) => {
    const newSelection = new Set(selectedPOS);
    if (newSelection.has(pos)) {
      newSelection.delete(pos);
    } else {
      newSelection.add(pos);
    }
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedPOS.size === availablePOS.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(availablePOS));
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-semibold mb-3">
        Subset by part-of-speech:
      </label>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm">
            {selectedPOS.size === 0 ? "All POS" : `${selectedPOS.size} selected`}
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              isOpen ? "transform rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 border border-gray-300 rounded-lg bg-white shadow-lg z-10">
            <div className="p-2 border-b">
              <button
                onClick={handleSelectAll}
                className="w-full px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded text-left transition-colors"
              >
                {selectedPOS.size === availablePOS.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {availablePOS.map((pos) => (
                <label
                  key={pos}
                  className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedPOS.has(pos)}
                    onChange={() => handleToggle(pos)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm">{pos}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
