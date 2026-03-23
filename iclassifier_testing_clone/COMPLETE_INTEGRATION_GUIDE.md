# Complete Integration Guide: React App + iClassifier Data

This guide covers everything needed to integrate your iClassifier BETA SQLite databases with the new React/Vite application.

## Overview

Your old system:
```
Mithril.js UI → HTML Template (reports.html.jinja) → JavaScript (clfreport.js, lemmareport.js) → Data (JavaScript objects)
```

Your new system:
```
React Components → Modern UI (Tailwind CSS) → API Routes (Express) → SQLite Databases (.db files)
```

---

## Architecture

### Frontend Flow
```
ClassifierReport.tsx / LemmaReport.tsx
         ↓
    useProjectData() hook
         ↓
    API Request (/api/iclassifier/:projectId/full)
         ↓
    Filter & Calculate Statistics
         ↓
    Display with Vis.js Graphs & Tables
```

### Backend Flow
```
Express Server
    ↓
/api/iclassifier/:projectId/* routes
    ↓
iclassifier-db.ts (SQLite client)
    ↓
Project Database Files (.db)
```

---

## Step 1: Database Setup

### File Structure

Your databases should be organized like this:
```
/Users/halel/Desktop/b_iclassifier_2.0/iclassifier/builderio/
├── client/                    # React frontend
├── server/                    # Express backend
│   ├── database/
│   │   └── iclassifier-db.ts  # SQLite client
│   ├── routes/
│   │   └── iclassifier-api.ts # API routes
│   └── index.ts               # Server setup
├── databases/                 # Your .db files (symlink or copy)
│   ├── egyptian-texts.db      # Pebers data
│   ├── anatolian-hieroglyphs.db  # Luwian data
│   ├── cuneiform-corpus.db
│   └── chinese-oracle.db
└── package.json
```

### Create Database Directory

```bash
# Create directory for databases
mkdir -p /Users/halel/Desktop/b_iclassifier_2.0/iclassifier/builderio/databases

# Option A: Copy your .db files
cp /path/to/your/pebers.db ./databases/egyptian-texts.db
cp /path/to/your/luwian.db ./databases/anatolian-hieroglyphs.db

# Option B: Create symlinks (keeps originals in place)
ln -s /path/to/your/pebers.db ./databases/egyptian-texts.db
ln -s /path/to/your/luwian.db ./databases/anatolian-hieroglyphs.db
```

### Set Environment Variable

Add to `.env.local`:
```
ICLASSIFIER_DATA_PATH=./databases
```

Or export in terminal:
```bash
export ICLASSIFIER_DATA_PATH=./databases
```

---

## Step 2: Database Schema Verification

Your SQLite databases need these tables:

### Table: `lemmas`
```sql
CREATE TABLE lemmas (
  id INTEGER PRIMARY KEY,
  transliteration TEXT NOT NULL,
  meaning TEXT
);

-- Example data:
-- id | transliteration | meaning
-- 1  | šrm            | to greet
-- 2  | sḏm            | to hear
```

### Table: `tokens`
```sql
CREATE TABLE tokens (
  id INTEGER PRIMARY KEY,
  lemma_id INTEGER,
  mdc_w_markup TEXT,      -- Classifier markup: ~A1~word~Z1~
  mdc TEXT,               -- Plain MDC
  witness_id TEXT,        -- Source document
  compound_id INTEGER,    -- For compounds
  pos TEXT                -- Part of speech
);

-- Example data:
-- id | lemma_id | mdc_w_markup | mdc | witness_id | compound_id | pos
-- 493| 1        | SA-A-Z4~...  | ... | O. Turin...|           | Verb
```

### Table: `witnesses`
```sql
CREATE TABLE witnesses (
  id TEXT PRIMARY KEY,
  script TEXT             -- Hieratic, Hieroglyphic, etc
);

-- Example data:
-- id                | script
-- O. Turin 9588/...|  Hieratic
-- Medinet Habu    |  Hieroglyphic
```

### Table: `classifier_metadata`
```sql
CREATE TABLE classifier_metadata (
  token_id INTEGER,
  gardiner_number TEXT,   -- A1, Z1, etc
  clf_type TEXT,         -- action, agent, etc
  clf_level INTEGER,     -- 1=Lexical, 2=Pragmatic, etc
  clf_position TEXT      -- pre, post, inner
);

-- Example data:
-- token_id | gardiner_number | clf_type | clf_level | clf_position
-- 493      | A1             | action  | 1         | pre
```

### Verify Your Schema

```bash
# Check what tables exist
sqlite3 ./databases/egyptian-texts.db ".tables"

# Check lemmas table structure
sqlite3 ./databases/egyptian-texts.db ".schema lemmas"

# Count records
sqlite3 ./databases/egyptian-texts.db "SELECT COUNT(*) FROM lemmas;"
sqlite3 ./databases/egyptian-texts.db "SELECT COUNT(*) FROM tokens;"
sqlite3 ./databases/egyptian-texts.db "SELECT COUNT(*) FROM witnesses;"
sqlite3 ./databases/egyptian-texts.db "SELECT COUNT(*) FROM classifier_metadata;"
```

---

## Step 3: Start Development Server

```bash
# Navigate to project
cd /Users/halel/Desktop/b_iclassifier_2.0/iclassifier/builderio

# Install dependencies (if not already done)
pnpm install

# Set environment variable
export ICLASSIFIER_DATA_PATH=./databases

# Start dev server
pnpm dev
```

You should see:
```
  VITE v5.x.x  ready in 123 ms

  ➜  Local:   http://localhost:5173/
```

---

## Step 4: Test the API

### Test Lemmas Endpoint
```bash
curl http://localhost:5173/api/iclassifier/egyptian-texts/lemmas | jq '.["1"]'
```

Expected response:
```json
{
  "id": 1,
  "transliteration": "šrm",
  "meaning": "to greet"
}
```

### Test Tokens Endpoint
```bash
curl http://localhost:5173/api/iclassifier/egyptian-texts/tokens | jq '.["493"]'
```

Expected response:
```json
{
  "id": 493,
  "lemma_id": 1,
  "mdc_w_markup": "SA-A-Z4:r-Z1-m:a-A30~Y1~",
  "mdc": "SA-A-Z4:r-Z1-m:a-A30-Y1",
  "witness_id": "O. Turin 9588/57365",
  "compound_id": null,
  "pos": "Verb"
}
```

### Test Full Data Endpoint
```bash
curl http://localhost:5173/api/iclassifier/egyptian-texts/full | jq 'keys'
```

Should return:
```json
["classifiers", "lemmas", "tokens", "witnesses"]
```

---

## Step 5: Test the UI

### Navigate to Reports

1. **Home page**: http://localhost:5173/
   - Should show project cards
   - Click "Ancient Egyptian Scripts"

2. **Lemma Report**: http://localhost:5173/lemma-report?projectId=egyptian-texts
   - Should load lemmas from database
   - Can search and filter

3. **Classifier Report**: http://localhost:5173/classifier-report?projectId=egyptian-texts
   - Should load classifiers from database
   - Can select classifiers and apply filters

### Check Browser Console

Look for any errors in DevTools (F12):
- Network tab: Verify API calls return data
- Console: Look for JavaScript errors
- Application tab: Check if data is loading

---

## Step 6: Migration from Old Mithril.js Template

### Old HTML Template Structure

Your `reports.html.jinja` probably looked like:
```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
    <script src="mithril.js"></script>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="app"></div>
    
    <script src="thesauri.js"></script>
    <script src="data-loader.js"></script>
    <script src="clfreport.js"></script>
    <script src="lemmareport.js"></script>
    
    <script>
        m.mount(document.getElementById('app'), MyApp);
    </script>
</body>
</html>
```

### New React Structure

No HTML template needed! The React app:
1. Loads automatically from `index.html`
2. Fetches data from `/api/iclassifier/:projectId/full`
3. Renders components with Tailwind CSS
4. Uses Vis.js for graphs (embedded in React)

The old `reports.html.jinja` is **no longer needed** because:
- React components handle all rendering
- API routes handle all data fetching
- Tailwind CSS replaces the old CSS files

---

## Step 7: Understanding the Data Flow

### Old Flow (Mithril.js)
```
1. Load HTML template (reports.html.jinja)
2. Load JavaScript files (clfreport.js, lemmareport.js)
3. Data loaded as global objects: tokenData, lemmaData, etc.
4. User interacts → Mithril updates DOM
```

### New Flow (React)
```
1. React app loads (index.html)
2. User navigates to /classifier-report
3. ClassifierReport.tsx component mounts
4. useProjectData() hook fetches from API
5. Component renders with data
6. User filters/searches → Component re-renders
```

### Data Transformation

The same logic from your JS files is preserved:

**Old (clfreport.js):**
```javascript
function extractClfsFromString(mdcStr) {
  // Extract classifiers from ~A1~..~Z1~ patterns
  return clfs;
}
```

**New (ClassifierReport.tsx):**
```typescript
function extractClassifiers(mdcStr: string): string[] {
  // Same logic, now in TypeScript
  return classifiers;
}
```

---

## Troubleshooting

### Database Not Found
**Error:** `Error: ENOENT: no such file or directory`

**Solution:**
```bash
# Verify database exists
ls -la ./databases/

# Check env variable
echo $ICLASSIFIER_DATA_PATH

# Restart server
pnpm dev
```

### API Returns Empty Data
**Check:**
1. Database file exists and has data
2. Table names match exactly (case-sensitive on Linux)
3. Column names match schema

```bash
# Count rows
sqlite3 ./databases/egyptian-texts.db "SELECT COUNT(*) FROM tokens;"

# Check columns
sqlite3 ./databases/egyptian-texts.db "PRAGMA table_info(tokens);"
```

### Port Already in Use
**Error:** `listen EADDRINUSE: address already in use :::5173`

**Solution:**
```bash
# Use different port
pnpm dev -- --port 3000

# Or kill process on 5173
lsof -ti:5173 | xargs kill -9
```

### CORS Errors
CORS is enabled by default. If you still get errors:
1. Check server is running (`pnpm dev`)
2. Check API URL is correct (`/api/iclassifier/...`)
3. Check browser console for exact error

---

## Project ID Mapping

Map your databases to project IDs:

| Project ID | Database File | Description |
|---|---|---|
| `egyptian-texts` | `egyptian-texts.db` | Pebers (Egyptian) |
| `anatolian-hieroglyphs` | `anatolian-hieroglyphs.db` | Luwian (Anatolian Hieroglyphs) |
| `cuneiform-corpus` | `cuneiform-corpus.db` | Sumerian |
| `chinese-oracle` | `chinese-oracle.db` | Ancient Chinese |

These IDs match the project IDs in `client/lib/sampleData.ts` in the `projects` array.

---

## Next Steps

### 1. Verify Database Setup
```bash
# Check all databases
for db in ./databases/*.db; do
  echo "=== $db ==="
  sqlite3 "$db" "SELECT COUNT(*) as lemmas FROM lemmas;"
  sqlite3 "$db" "SELECT COUNT(*) as tokens FROM tokens;"
done
```

### 2. Start Dev Server
```bash
pnpm dev
```

### 3. Test Each Report
- http://localhost:5173/lemma-report?projectId=egyptian-texts
- http://localhost:5173/classifier-report?projectId=egyptian-texts

### 4. Check for Errors
- Open browser DevTools (F12)
- Go to Network tab
- Click on an API call (e.g., `/api/iclassifier/egyptian-texts/full`)
- Verify response contains data

### 5. Customize If Needed
- Update project metadata in `client/lib/sampleData.ts` (projects array)
- Update filters in component files
- Customize styling with Tailwind

---

## File Reference

### New Files Created
- `server/database/iclassifier-db.ts` - SQLite connection
- `server/routes/iclassifier-api.ts` - API endpoints
- `client/lib/api.ts` - React hooks

### Modified Files
- `server/index.ts` - Added API routes
- `client/pages/ClassifierReport.tsx` - Uses API data
- `client/pages/LemmaReport.tsx` - Uses API data

### Old Files (No Longer Needed)
- `reports.html.jinja` - Replaced by React components
- `clfreport.js` - Logic ported to ClassifierReport.tsx
- `lemmareport.js` - Logic ported to LemmaReport.tsx
- Old CSS files - Replaced by Tailwind CSS

---

## Questions?

Check these files for details:
- `ICLASSIFIER_DATA_INTEGRATION.md` - API documentation
- `MIGRATION_EXAMPLE.md` - Code examples
- Browser console (F12) - Error messages
- Server logs - Debug information

---

## Success Indicators

✅ You'll know it's working when:
- API endpoints return data (test with curl)
- Pages load without errors (check console)
- Classifiers/lemmas display correctly
- Filters work as expected
- Network graphs render
- Statistics tables populate

Let me know when you're ready to test! 🚀
