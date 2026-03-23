# Multi-Project Database Integration Setup Guide

## Overview

Your iClassifier application now supports dynamic loading of multiple projects and datasets. The system automatically detects all database files in the `databases/` folder and makes them available across all reports.

## How It Works

1. **Database Discovery**: The API endpoint `/api/iclassifier/projects/list` scans the `databases/` folder for all `.db` files
2. **Project Mapping**: Database files are automatically mapped to project configurations in `client/lib/sampleData.ts`
3. **Dynamic Loading**: All reports (Lemma, Classifier, Map, Query) now have project selectors that load the correct dataset

## Adding the Luwian Database

### Option 1: Direct File Placement (Recommended)

1. **Obtain the database file** you uploaded (`clf.db`)
2. **Place it in the databases folder** with the name `anatolian-hieroglyphs.db`:
   ```
   databases/anatolian-hieroglyphs.db  ← Your Luwian data
   databases/egyptian-texts.db          ← Existing Egyptian data
   ```
3. **The system will automatically detect and load it**

### Option 2: Rename if Using Different Convention

If your database file has a different structure or name, rename it to match the project ID:
- Project ID: `anatolian-hieroglyphs` → File: `anatolian-hieroglyphs.db`
- Project ID: `luwian-corpus` → File: `luwian-corpus.db`
- Project ID: `cuneiform-corpus` → File: `cuneiform-corpus.db`

## Project Configuration

The available projects are defined in `client/lib/sampleData.ts`:

```typescript
export const projects: Project[] = [
  {
    id: "egyptian-texts",
    name: "Ancient Egyptian Scripts",
    type: "hieroglyphic",
    // ...
  },
  {
    id: "anatolian-hieroglyphs",
    name: "Anatolian Hieroglyphs",
    type: "anatolian",  // Luwian
    // ...
  },
  // Additional projects...
];
```

## Database Schema Requirements

Your database files should contain these tables:

### Required Tables:
- **lemmas** - Lemma entries
  - Columns: `id`, `transliteration`, `meaning`
- **tokens** - Token instances
  - Columns: `id`, `lemma_id`, `mdc_w_markup`, `mdc`, `witness_id`, `pos`, `compound_id`
- **witnesses** - Source documents
  - Columns: `id`, `script`

### Optional Tables:
- **classifier_metadata** - Classifier annotations (if available)
  - Columns: `id`, `token_id`, `gardiner_number`, `clf_type`, `clf_level`, `clf_position`

## Reports Now Support Multi-Project Data

### 1. **Lemma Report** (`/lemma-report`)
- ✅ Project selector showing all available databases
- ✅ Dynamically loads lemmas from selected project
- ✅ Filters by witness and script
- ✅ Shows classifier statistics

### 2. **Classifier Report** (`/classifier-report`)
- ✅ Project selector at the top
- ✅ Loads all classifiers from selected database
- ✅ Supports complex filtering (type, level, position, witness, POS, script)
- ✅ Generates co-occurrence networks

### 3. **Map/Network Report** (`/map-report`)
- ✅ Project selector
- ✅ Shows witness distribution across selected dataset
- ✅ Displays classifier inventory by witness
- ✅ Downloadable witness report

### 4. **Query Report** (`/query-report`)
- ✅ Project selector
- ✅ Advanced search using regular expressions on MDC notation
- ✅ Multi-filter support (lemmas, witnesses, scripts, classifiers)
- ✅ Semantic network visualization
- ✅ Export results to CSV

## API Endpoints

### Get Available Projects
```
GET /api/iclassifier/projects/list
```
Returns: `["egyptian-texts", "anatolian-hieroglyphs"]`

### Load Project Data
```
GET /api/iclassifier/{projectId}/full
```
Returns: Complete dataset including lemmas, tokens, witnesses, classifiers

### Individual Data Endpoints
- `GET /api/iclassifier/{projectId}/lemmas` - Lemmas only
- `GET /api/iclassifier/{projectId}/tokens` - Tokens only
- `GET /api/iclassifier/{projectId}/witnesses` - Witnesses only
- `GET /api/iclassifier/{projectId}/classifier-metadata` - Classifier annotations

## Testing Your Integration

1. **Verify Egyptian Data Works**:
   - Navigate to any report page
   - Confirm "Egyptian Scripts" appears in project selector
   - Load and browse data

2. **Add Luwian Database**:
   - Place `anatolian-hieroglyphs.db` in `databases/` folder
   - Refresh your browser
   - "Anatolian Hieroglyphs" should appear in all project selectors

3. **Test Each Report**:
   - **Lemma Report**: Search for lemmas, filter by witness
   - **Classifier Report**: Browse classifiers, apply filters
   - **Map Report**: View witness distribution
   - **Query Report**: Run complex searches with regex patterns

## Troubleshooting

### Projects Not Appearing
- ✓ Ensure database file is in `databases/` folder
- ✓ Check filename matches project ID (e.g., `anatolian-hieroglyphs.db`)
- ✓ Verify file has `.db` extension
- ✓ Check server logs for database loading errors

### "No projects available" Message
- Projects may still be loading - wait a moment
- Check that at least one `.db` file exists in `databases/`
- Look at console logs for database errors

### Missing Data in Reports
- Verify database has required tables (lemmas, tokens, witnesses)
- Check table column names match expected schema
- Look for error messages in server logs

## Performance Notes

- Large datasets (>100,000 tokens) may take a few seconds to load
- The system caches data per project per session
- Switching between projects reloads data from disk

## Next Steps

1. **Place the Luwian database** in the databases folder
2. **Refresh your browser** to see the new project available
3. **Start exploring** your data with the enhanced reports
4. **Use the Query Report** for complex searches across both datasets

## Support

For issues or questions:
1. Check the browser console for error messages
2. Review server logs (visible in dev server output)
3. Verify database files are readable and in the correct location
4. Ensure all required tables exist with correct column names
