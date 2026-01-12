import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { getThesaurusLabel } from "@/lib/thesauri";

interface WitnessSelectorProps {
  witnessData: Record<string, any>;
  selectedWitnesses: Set<string>;
  setSelectedWitnesses: (witnesses: Set<string>) => void;
  projectType?: string;
}

export default function WitnessSelector({
  witnessData,
  selectedWitnesses,
  setSelectedWitnesses,
  projectType,
}: WitnessSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Extract available witnesses from witnessData
  const availableWitnesses = useMemo(() => {
    return Object.keys(witnessData).sort((a, b) => {
      const witnessA = witnessData[a];
      const witnessB = witnessData[b];
      const nameA = String(witnessA?.name || witnessA?.id || a);
      const nameB = String(witnessB?.name || witnessB?.id || b);
      return nameA.localeCompare(nameB);
    });
  }, [witnessData]);

  const handleToggle = (witnessId: string) => {
    const newSelection = new Set(selectedWitnesses);
    if (newSelection.has(witnessId)) {
      newSelection.delete(witnessId);
    } else {
      newSelection.add(witnessId);
    }
    setSelectedWitnesses(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedWitnesses.size === availableWitnesses.length) {
      setSelectedWitnesses(new Set());
    } else {
      setSelectedWitnesses(new Set(availableWitnesses));
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-semibold mb-3">
        Subset by text:
      </label>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm">
            {selectedWitnesses.size === 0
              ? "All texts"
              : `${selectedWitnesses.size} selected`}
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
                {selectedWitnesses.size === availableWitnesses.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {availableWitnesses.map((witnessId) => {
                const witness = witnessData[witnessId];
                const displayName = witness?.name || witnessId;
                const genreLabel = getThesaurusLabel(projectType, "genres", witness?.genre);
                const scriptLabel = getThesaurusLabel(projectType, "scripts", witness?.script);
                const additionalInfo = [genreLabel, scriptLabel].filter(Boolean).join(" • ");
                
                return (
                  <label
                    key={witnessId}
                    className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedWitnesses.has(witnessId)}
                      onChange={() => handleToggle(witnessId)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-2 text-sm">
                      <div>{displayName}</div>
                      {additionalInfo && (
                        <div className="text-xs text-gray-500">{additionalInfo}</div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
