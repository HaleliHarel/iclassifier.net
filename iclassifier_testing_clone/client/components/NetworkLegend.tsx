import { useState } from 'react';
import { Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface NetworkLegendProps {
  showLemmaToggle?: boolean;
  showClassifierToggle?: boolean;
}

export default function NetworkLegend({ 
  showLemmaToggle = true, 
  showClassifierToggle = true 
}: NetworkLegendProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 shadow-sm transition-colors hover:bg-blue-100"
        title="Network Interaction Guide"
        aria-label="Network Interaction Guide"
      >
        <Info className="w-5 h-5 text-blue-600" />
        <span className="hidden group-hover:inline text-xs font-semibold text-blue-700">
          Network Interaction Guide
        </span>
      </button>
    );
  }

  return (
    <Card className="mb-4 bg-blue-50 border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 text-sm text-left"
            aria-expanded={isOpen}
          >
            <Info className="w-4 h-4 text-blue-600" />
            Network Interaction Guide
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {showLemmaToggle && (
            <div className="space-y-1">
              <div className="font-semibold text-gray-700">Lemma Nodes</div>
              <div className="text-gray-600">
                <div>• <strong>Single-click:</strong> Toggle between original form and translation</div>
                <div>• <strong>Double-click:</strong> Open lemma details page</div>
              </div>
            </div>
          )}
          
          {showClassifierToggle && (
            <div className="space-y-1">
              <div className="font-semibold text-gray-700">Classifier Nodes</div>
              <div className="text-gray-600">
                <div>• <strong>Single-click:</strong> Toggle between visual and meaning modes</div>
                <div>• <strong>Double-click:</strong> Open classifier details page</div>
              </div>
            </div>
          )}
        </div>
        
        <div className="pt-2 border-t border-blue-200 text-xs text-gray-500">
          <strong>Tip:</strong> Hover over any node to see a tooltip with these options
        </div>
      </CardContent>
    </Card>
  );
}
