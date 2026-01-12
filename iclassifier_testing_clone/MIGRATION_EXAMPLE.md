# Migration Example: Using Real iClassifier Data

This guide shows step-by-step how to convert a page from using sample data to real data from your SQLite databases.

## Example: ClassifierReport.tsx Migration

### Step 1: Import the API Hook

Add this import:
```typescript
import { useProjectData } from '@/lib/api';
```

### Step 2: Fetch Data from API

Add this hook at the start of your component:

```typescript
export default function ClassifierReport() {
  // Get projectId from URL
  const projectId = new URLSearchParams(window.location.search).get('projectId') || 'egyptian-texts';
  
  // Fetch all data from your iClassifier database
  const { data, loading, error } = useProjectData(projectId);

  // Handle loading and error states
  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-screen">
          <p>Loading data from database...</p>
        </div>
      </SidebarLayout>
    );
  }

  if (error) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-red-600">Error loading data: {error}</p>
        </div>
      </SidebarLayout>
    );
  }

  // Destructure the data
  const { lemmas, tokens, witnesses, classifiers } = data;

  // Rest of your component...
}
```

### Step 3: Replace Sample Data References

**Old:**
```typescript
import { lemmaData, tokenData, witnessData } from '@/lib/sampleData';
```

**New:**
```typescript
// No need to import - use the data from the hook instead
const lemmas = data.lemmas;        // Instead of lemmaData
const tokens = data.tokens;        // Instead of tokenData
const witnesses = data.witnesses;  // Instead of witnessData
```

### Step 4: Update Your Filtering Functions

Your existing filtering functions should work the same. Just make sure to use the API data:

```typescript
// Example: Get classifiers for a token
function getTokenClassifiers(tokenId: number) {
  return classifiers.filter(c => c.token_id === tokenId);
}

// Example: Get tokens for a lemma
function getTokensForLemma(lemmaId: number) {
  return Object.values(tokens).filter(t => t.lemma_id === lemmaId);
}

// Example: Get lemma info
function getLemmaInfo(lemmaId: number) {
  return lemmas[lemmaId];
}
```

### Step 5: Keep Your Business Logic

All your existing data transformation and visualization logic stays the same:

```typescript
// These functions still work exactly as before
function extractClfsFromString(mdcStr: string) {
  // Your original implementation
}

function mdc2glyph(mdc: string) {
  // Your original implementation
}

// Your filtering functions
function filterByWitness(tokenId: number) {
  // Your original implementation
}
```

---

## Complete Example: ClassifierReport with Real Data

Here's a complete updated component:

```typescript
import { useState, useMemo } from "react";
import { useProjectData } from '@/lib/api';
import SidebarLayout from "@/components/SidebarLayout";
import ClassifierTypeSelector from "@/components/filters/ClassifierTypeSelector";
import WitnessSelector from "@/components/filters/WitnessSelector";
import POSSelector from "@/components/filters/POSSelector";
import ScriptSelector from "@/components/filters/ScriptSelector";
import StatisticsTable from "@/components/StatisticsTable";
import NetworkGraph from "@/components/NetworkGraph";

export default function ClassifierReport() {
  const projectId = new URLSearchParams(window.location.search).get('projectId') || 'egyptian-texts';
  const { data, loading, error } = useProjectData(projectId);
  
  const [selectedClassifier, setSelectedClassifier] = useState('---');
  const [selectedWitnesses, setSelectedWitnesses] = useState(new Set());
  const [selectedPOS, setSelectedPOS] = useState(new Set());
  const [clfType, setClfType] = useState('any');
  const [clfLevel, setClfLevel] = useState('any');

  if (loading) return <SidebarLayout><div>Loading...</div></SidebarLayout>;
  if (error) return <SidebarLayout><div>Error: {error}</div></SidebarLayout>;

  const { lemmas, tokens, witnesses, classifiers } = data;

  // Your filtering and calculation logic here
  const filteredTokens = useMemo(() => {
    return Object.values(tokens).filter(token => {
      // Apply witness filter
      if (selectedWitnesses.size > 0 && !selectedWitnesses.has(String(token.witness_id))) {
        return false;
      }
      // Apply POS filter
      if (selectedPOS.size > 0 && !selectedPOS.has(String(token.pos).trim())) {
        return false;
      }
      return true;
    });
  }, [tokens, selectedWitnesses, selectedPOS]);

  const statistics = useMemo(() => {
    // Calculate statistics from filtered tokens
    const stats = {
      totalTokens: filteredTokens.length,
      uniqueLemmas: new Set(filteredTokens.map(t => t.lemma_id)).size,
      classifierCounts: {} as Record<string, number>,
    };

    filteredTokens.forEach(token => {
      // Extract classifiers from MDC markup
      const clfList = extractClfsFromString(token.mdc_w_markup || '');
      clfList.forEach(clf => {
        stats.classifierCounts[clf] = (stats.classifierCounts[clf] || 0) + 1;
      });
    });

    return stats;
  }, [filteredTokens]);

  return (
    <SidebarLayout>
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-4">Classifier Report</h1>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <WitnessSelector
            witnessData={witnesses}
            selected={selectedWitnesses}
            onChange={setSelectedWitnesses}
          />
          <POSSelector
            selected={selectedPOS}
            onChange={setSelectedPOS}
          />
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Total Tokens</p>
            <p className="text-2xl font-bold">{statistics.totalTokens}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">Unique Lemmas</p>
            <p className="text-2xl font-bold">{statistics.uniqueLemmas}</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-600">Classifier Count</p>
            <p className="text-2xl font-bold">{Object.keys(statistics.classifierCounts).length}</p>
          </div>
        </div>

        {/* Statistics Table */}
        <StatisticsTable
          data={statistics.classifierCounts}
          header={['Classifier', 'Count']}
        />
      </div>
    </SidebarLayout>
  );
}

// Your utility functions (from original code)
function extractClfsFromString(mdcStr: string): string[] {
  // Your original implementation
  // This should extract classifiers marked with ~...~ in the MDC string
  const regex = /~([^~]+)~/g;
  const matches = mdcStr.match(regex) || [];
  return matches.map(m => m.replace(/~/g, ''));
}
```

---

## Key Changes Summary

| Old (Sample Data) | New (API Data) |
|---|---|
| `import { lemmaData } from ...` | `const { data } = useProjectData(projectId)` |
| `lemmaData[id]` | `data.lemmas[id]` |
| `tokenData[id]` | `data.tokens[id]` |
| `witnessData[id]` | `data.witnesses[id]` |
| All global data | All fetched from API |

---

## Testing Your Migration

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Set environment variable:**
   ```bash
   export ICLASSIFIER_DATA_PATH=/path/to/your/databases
   ```

3. **Check browser console:**
   - Look for any errors
   - Verify data is loading

4. **Test the report:**
   - Navigate to `/classifier-report?projectId=egyptian-texts`
   - Should show data from your database
   - Filters should work

5. **Verify API directly:**
   ```bash
   curl http://localhost:5173/api/iclassifier/egyptian-texts/lemmas
   ```

---

## Gradual Migration

You don't have to convert everything at once:

1. **Start with one page** (e.g., ClassifierReport)
2. **Test thoroughly**
3. **Move to next page** (e.g., LemmaReport)
4. **Remove sample data** once all pages migrated
5. **Clean up** the sampleData.ts file

---

## Questions?

Check `ICLASSIFIER_DATA_INTEGRATION.md` for:
- Full API documentation
- Database schema details
- Troubleshooting guide
