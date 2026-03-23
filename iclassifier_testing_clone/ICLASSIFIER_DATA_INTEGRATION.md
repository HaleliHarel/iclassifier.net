# iClassifier Data Integration Guide

This guide explains how to load data from your iClassifier SQLite databases into the React app.

## Overview

The integration consists of:
1. **Backend**: Flask/Express server that reads from SQLite databases
2. **API Layer**: RESTful endpoints to fetch data
3. **Frontend**: React hooks that fetch and cache data

## Setup

### 1. Configure Database Path

Set the `ICLASSIFIER_DATA_PATH` environment variable to point to your database directory:

```bash
# In your .env file or shell
export ICLASSIFIER_DATA_PATH="/Users/halel/Desktop/b_iclassifier_2.0/iclassifier/databases"
```

Or add to `.env.local`:
```
ICLASSIFIER_DATA_PATH=/Users/halel/Desktop/b_iclassifier_2.0/iclassifier/databases
```

### 2. Database File Structure

Your database files should be named with the project ID:
```
/path/to/databases/
├── egyptian-texts.db      # Egyptian/Pebers data
├── cuneiform-corpus.db    # Sumerian data
├── chinese-oracle.db      # Ancient Chinese data
└── anatolian-hieroglyphs.db  # Luwian/Anatolian data
```

### 3. Expected Database Schema

Each `.db` file should have these tables:

#### `lemmas` table
```sql
CREATE TABLE lemmas (
  id INTEGER PRIMARY KEY,
  transliteration TEXT NOT NULL,
  meaning TEXT
);
```

#### `tokens` table
```sql
CREATE TABLE tokens (
  id INTEGER PRIMARY KEY,
  lemma_id INTEGER,
  mdc_w_markup TEXT,
  mdc TEXT,
  witness_id TEXT,
  compound_id INTEGER,
  pos TEXT,
  FOREIGN KEY(lemma_id) REFERENCES lemmas(id)
);
```

#### `witnesses` table
```sql
CREATE TABLE witnesses (
  id TEXT PRIMARY KEY,
  script TEXT
);
```

#### `classifier_metadata` table
```sql
CREATE TABLE classifier_metadata (
  token_id INTEGER,
  gardiner_number TEXT,
  clf_type TEXT,
  clf_level INTEGER,
  clf_position TEXT,
  FOREIGN KEY(token_id) REFERENCES tokens(id)
);
```

## API Endpoints

The backend provides these endpoints:

### Get All Lemmas
```
GET /api/iclassifier/{projectId}/lemmas
```
Returns: `Record<number, Lemma>` - Dictionary of lemmas by ID

### Get All Tokens
```
GET /api/iclassifier/{projectId}/tokens
```
Returns: `Record<number, Token>` - Dictionary of tokens by ID

### Get All Witnesses
```
GET /api/iclassifier/{projectId}/witnesses
```
Returns: `Record<string, Witness>` - Dictionary of witnesses by ID

### Get Classifier Metadata
```
GET /api/iclassifier/{projectId}/classifier-metadata
```
Returns: `ClassifierMetadata[]` - Array of classifier metadata

### Get Full Project Data
```
GET /api/iclassifier/{projectId}/full
```
Returns: All data for the project in one request
```json
{
  "lemmas": { ... },
  "tokens": { ... },
  "witnesses": { ... },
  "classifiers": [ ... ]
}
```

## React Hooks

Use these hooks in your components to fetch data:

### useLemmas
```typescript
import { useLemmas } from '@/lib/api';

function MyComponent() {
  const { data: lemmas, loading, error } = useLemmas('egyptian-texts');
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return <div>{Object.keys(lemmas).length} lemmas loaded</div>;
}
```

### useTokens
```typescript
const { data: tokens, loading, error } = useTokens('egyptian-texts');
```

### useWitnesses
```typescript
const { data: witnesses, loading, error } = useWitnesses('egyptian-texts');
```

### useClassifierMetadata
```typescript
const { data: classifiers, loading, error } = useClassifierMetadata('egyptian-texts');
```

### useProjectData
Fetches all data at once:
```typescript
const { data: fullData, loading, error } = useProjectData('egyptian-texts');
const { lemmas, tokens, witnesses, classifiers } = fullData;
```

## Updating Components

### Example: ClassifierReport.tsx

Replace the sample data with API calls:

```typescript
import { useProjectData } from '@/lib/api';

export default function ClassifierReport() {
  const projectId = new URLSearchParams(window.location.search).get('projectId') || 'egyptian-texts';
  const { data, loading, error } = useProjectData(projectId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  const { lemmas, tokens, witnesses, classifiers } = data;

  // Use lemmas, tokens, witnesses, classifiers instead of sample data
  // All your existing logic works the same
  
  return (
    <SidebarLayout>
      {/* Your component JSX */}
    </SidebarLayout>
  );
}
```

### Example: LemmaReport.tsx

```typescript
import { useProjectData } from '@/lib/api';

export default function LemmaReport() {
  const projectId = new URLSearchParams(window.location.search).get('projectId') || 'egyptian-texts';
  const { data, loading, error } = useProjectData(projectId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  const { lemmas, tokens, witnesses, classifiers } = data;

  // Replace sampleData references with API data
  return (
    <SidebarLayout>
      {/* Your component JSX */}
    </SidebarLayout>
  );
}
```

## Migration from Sample Data

### Old Way (Sample Data)
```typescript
import { lemmaData, tokenData, witnessData } from '@/lib/sampleData';

// Use global data
```

### New Way (API Data)
```typescript
import { useProjectData } from '@/lib/api';

// Fetch data from API
const { data } = useProjectData(projectId);
const { lemmas, tokens, witnesses } = data;
```

## Performance Tips

1. **Use `useProjectData`** for initial load - fetches all data once
2. **Cache data** - hooks use the API response as cache
3. **Lazy load** - fetch specific data sets only when needed:
   ```typescript
   const { data: lemmas } = useLemmas(projectId);
   // Don't fetch tokens if you don't need them
   ```

## Error Handling

All hooks return an error state:

```typescript
const { data, loading, error } = useProjectData(projectId);

if (error) {
  console.error('Failed to load project data:', error);
  // Show fallback UI
}
```

## Troubleshooting

### Database not found error
- Check `ICLASSIFIER_DATA_PATH` environment variable
- Verify database files exist in the path
- File names should match project IDs (e.g., `egyptian-texts.db`)

### CORS errors
- Backend CORS is already enabled
- Check that API is running on correct port
- Set `REACT_APP_API_URL` if using different port

### Data not loading
- Check browser console for errors
- Verify database has required tables
- Check database schema matches expected format

## Next Steps

1. Set up `ICLASSIFIER_DATA_PATH` in your environment
2. Copy/link your `.db` files to the configured path
3. Update your page components to use the hooks
4. Test with `npm run dev`
5. Verify data loads correctly

## Testing

Test the API directly in browser:
```
http://localhost:5173/api/iclassifier/egyptian-texts/lemmas
http://localhost:5173/api/iclassifier/egyptian-texts/tokens
http://localhost:5173/api/iclassifier/egyptian-texts/full
```

Or in terminal:
```bash
curl http://localhost:5173/api/iclassifier/egyptian-texts/lemmas | jq
```
