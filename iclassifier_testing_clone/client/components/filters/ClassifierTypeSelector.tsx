interface ClassifierTypeSelectorProps {
  clfType: string;
  clfLevel: string;
  clfPosition?: string;
  typeOptions: Array<[string, string]>;
  levelOptions: Array<[string, string]>;
  positionOptions?: Array<[string, string]>;
  onTypeChange: (type: string) => void;
  onLevelChange: (level: string) => void;
  onPositionChange?: (position: string) => void;
}

export default function ClassifierTypeSelector({
  clfType,
  clfLevel,
  clfPosition,
  typeOptions,
  levelOptions,
  positionOptions,
  onTypeChange,
  onLevelChange,
  onPositionChange,
}: ClassifierTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Type Selector */}
        <div>
          <label htmlFor="clf-type" className="block text-sm font-semibold mb-2">
            Subset by type:
          </label>
          <select
            id="clf-type"
            value={clfType}
            onChange={(e) => onTypeChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {typeOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Level Selector */}
        <div>
          <label htmlFor="clf-level" className="block text-sm font-semibold mb-2">
            Subset by level:
          </label>
          <select
            id="clf-level"
            value={clfLevel}
            onChange={(e) => onLevelChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {levelOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Position Selector */}
        {positionOptions && onPositionChange && (
          <div>
            <label htmlFor="clf-position" className="block text-sm font-semibold mb-2">
              Subset by position:
            </label>
            <select
              id="clf-position"
              value={clfPosition || "any"}
              onChange={(e) => onPositionChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {positionOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
