import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { getThesaurusLabel } from "@/lib/thesauri";

interface ScriptSelectorProps {
  witnessData: Record<string, any>;
  selectedScripts: Set<string>;
  setSelectedScripts: (scripts: Set<string>) => void;
  projectType?: string;
}

export default function ScriptSelector({
  witnessData,
  selectedScripts,
  setSelectedScripts,
  projectType,
}: ScriptSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Extract available scripts from witnessData
  const availableScripts = useMemo(() => {
    const scripts = new Set<string>();
    Object.values(witnessData).forEach((witness: any) => {
      if (witness?.script && witness.script.trim()) {
        scripts.add(witness.script.trim());
      }
    });
    return Array.from(scripts).sort((a, b) => {
      const labelA = getThesaurusLabel(projectType, "scripts", a);
      const labelB = getThesaurusLabel(projectType, "scripts", b);
      return labelA.localeCompare(labelB);
    });
  }, [witnessData, projectType]);

  const handleToggle = (script: string) => {
    const newSelection = new Set(selectedScripts);
    if (newSelection.has(script)) {
      newSelection.delete(script);
    } else {
      newSelection.add(script);
    }
    setSelectedScripts(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedScripts.size === availableScripts.length) {
      setSelectedScripts(new Set());
    } else {
      setSelectedScripts(new Set(availableScripts));
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-semibold mb-3">
        Subset by script:
      </label>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm">
            {selectedScripts.size === 0
              ? "All scripts"
              : `${selectedScripts.size} selected`}
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
                {selectedScripts.size === availableScripts.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {availableScripts.map((script) => {
                const label = getThesaurusLabel(projectType, "scripts", script);
                return (
                <label
                  key={script}
                  className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedScripts.has(script)}
                    onChange={() => handleToggle(script)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm">{label}</span>
                </label>
              )})}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
