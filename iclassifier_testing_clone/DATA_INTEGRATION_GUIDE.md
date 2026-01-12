# iClassifier Data Integration Guide

This guide explains how to integrate your existing SQLite database with the new React-based iClassifier reporting system.

## Overview

The application currently uses mock data defined in `client/lib/sampleData.ts`. To use your own data from the SQLite database, you need to:

1. Export your database tables as JSON
2. Update the `sampleData.ts` file with your data
3. Ensure your data matches the required schema

## Required Data Structure

The application requires three main data types:

### 1. **Lemma Data**
Represents individual lemmas with transliteration and meaning.

```typescript
export const lemmaData: Record<number, Lemma> = {
  1: {
    id: 1,
    transliteration: "šrm",
    meaning: "to greet"
  },
  // ... more lemmas
};

interface Lemma {
  id: number;
  transliteration: string;
  meaning: string;
}
```

### 2. **Witness Data**
Represents text sources/witnesses with their script type.

```typescript
export const witnessData: Record<string, Witness> = {
  "O. Turin 9588/57365": {
    id: "O. Turin 9588/57365",
    script: "Hieratic"
  },
  // ... more witnesses
};

interface Witness {
  id: string;
  script: string;
}
```

### 3. **Token Data**
Represents individual token occurrences with classifier markup.

```typescript
export const tokenData: Record<number, Token> = {
  493: {
    id: 493,
    lemma_id: 1,
    mdc_w_markup: "SA-A-Z4:r-Z1-m:a-A30~Y1~",
    mdc: "SA-A-Z4:r-Z1-m:a-A30-Y1",
    witness_id: "O. Turin 9588/57365",
    compound_id: null
  },
  // ... more tokens
};

interface Token {
  id: number;
  lemma_id: number;
  mdc_w_markup: string;      // MDC notation with classifier markup
  mdc: string;                // Plain MDC notation
  witness_id: string;         // Reference to witness
  compound_id: number | null; // Reference to compound token if applicable
}
```

## Exporting Data from SQLite

### Step 1: Access Your Database

You'll need to export data from your SQLite database. Use one of these methods:

#### Option A: Using SQLite Command Line

```bash
# Connect to your database
sqlite3 neuaegyptischeerzaehlungen_clf.db

# Export lemmas as JSON (if your table is named "lemmas")
.mode json
.output lemmas.json
SELECT * FROM lemmas;

# Export witnesses as JSON
.output witnesses.json
SELECT * FROM witnesses;

# Export tokens as JSON
.output tokens.json
SELECT * FROM tokens;

# Exit SQLite
.quit
```

#### Option B: Using Python

Create a script `export_database.py`:

```python
import sqlite3
import json
from typing import Any

def export_table_to_json(db_path: str, table_name: str, output_file: str):
    """Export a SQLite table to JSON format"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute(f"SELECT * FROM {table_name}")
    rows = cursor.fetchall()
    
    data = [dict(row) for row in rows]
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    conn.close()
    print(f"Exported {table_name} to {output_file}")

# Export all tables
db_path = "neuaegyptischeerzaehlungen_clf.db"
export_table_to_json(db_path, "lemmas", "lemmas.json")
export_table_to_json(db_path, "witnesses", "witnesses.json")
export_table_to_json(db_path, "tokens", "tokens.json")
```

Run the script:
```bash
python export_database.py
```

#### Option C: Using DB Browser for SQLite

1. Open your database file in [DB Browser for SQLite](https://sqlitebrowser.org/)
2. Right-click each table (lemmas, witnesses, tokens)
3. Select "Export as JSON"
4. Save to files: `lemmas.json`, `witnesses.json`, `tokens.json`

## Mapping Your Database Schema

Your database schema may differ from the expected format. Map your columns as follows:

### Lemmas Mapping

| Your Column | Expected | Notes |
|-------------|----------|-------|
| `id` | `id` | Primary key, numeric |
| `transliteration` | `transliteration` | The transliteration form |
| `meaning` | `meaning` | English translation/meaning |

If your columns have different names, adjust the mapping in the transformation step.

### Witnesses Mapping

| Your Column | Expected | Notes |
|-------------|----------|-------|
| `id` or `name` | `id` | Unique identifier, can be string |
| `script` | `script` | Script type (e.g., "Hieratic", "Hieroglyphic") |

### Tokens Mapping

| Your Column | Expected | Notes |
|-------------|----------|-------|
| `id` | `id` | Primary key, numeric |
| `lemma_id` | `lemma_id` | Foreign key to lemmas |
| `mdc_with_markup` or `mdc_w_markup` | `mdc_w_markup` | MDC with classifier markup (e.g., `~A30~`) |
| `mdc` | `mdc` | Plain MDC without markup |
| `witness_id` or `source` | `witness_id` | Reference to witness |
| `compound_id` | `compound_id` | NULL if not part of compound, else compound token ID |

## Step 2: Transform Data to Required Format

Create a transformation script `transform_data.py`:

```python
import json
from typing import Dict, List, Any, Optional

def transform_lemmas(raw_data: List[Dict]) -> Dict[int, Dict]:
    """Transform raw lemma data to required format"""
    result = {}
    for item in raw_data:
        # Adjust these column names if your schema differs
        lemma_id = int(item.get('id') or item.get('lemma_id'))
        result[lemma_id] = {
            'id': lemma_id,
            'transliteration': item.get('transliteration', ''),
            'meaning': item.get('meaning', '')
        }
    return result

def transform_witnesses(raw_data: List[Dict]) -> Dict[str, Dict]:
    """Transform raw witness data to required format"""
    result = {}
    for item in raw_data:
        # Adjust these column names if your schema differs
        witness_id = str(item.get('id') or item.get('name') or item.get('witness_id'))
        result[witness_id] = {
            'id': witness_id,
            'script': item.get('script', 'Unknown')
        }
    return result

def transform_tokens(raw_data: List[Dict]) -> Dict[int, Dict]:
    """Transform raw token data to required format"""
    result = {}
    for item in raw_data:
        # Adjust these column names if your schema differs
        token_id = int(item.get('id') or item.get('token_id'))
        result[token_id] = {
            'id': token_id,
            'lemma_id': int(item.get('lemma_id')),
            'mdc_w_markup': item.get('mdc_w_markup') or item.get('mdc_with_markup', ''),
            'mdc': item.get('mdc', ''),
            'witness_id': str(item.get('witness_id') or item.get('source', '')),
            'compound_id': int(item.get('compound_id')) if item.get('compound_id') else None
        }
    return result

def main():
    # Load exported JSON files
    with open('lemmas.json', 'r', encoding='utf-8') as f:
        lemmas_raw = json.load(f)
    
    with open('witnesses.json', 'r', encoding='utf-8') as f:
        witnesses_raw = json.load(f)
    
    with open('tokens.json', 'r', encoding='utf-8') as f:
        tokens_raw = json.load(f)
    
    # Transform data
    lemmas = transform_lemmas(lemmas_raw)
    witnesses = transform_witnesses(witnesses_raw)
    tokens = transform_tokens(tokens_raw)
    
    # Create output
    output = {
        'lemmas': lemmas,
        'witnesses': witnesses,
        'tokens': tokens
    }
    
    # Save to file
    with open('transformed_data.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"Transformed data:")
    print(f"  - Lemmas: {len(lemmas)}")
    print(f"  - Witnesses: {len(witnesses)}")
    print(f"  - Tokens: {len(tokens)}")
    print(f"Saved to: transformed_data.json")

if __name__ == "__main__":
    main()
```

Run the transformation:
```bash
python transform_data.py
```

## Step 3: Update sampleData.ts

After transformation, update `client/lib/sampleData.ts` with your data:

1. Open `transformed_data.json` created in Step 2
2. Copy the content of `lemmas` object
3. Replace the `lemmaData` object in `sampleData.ts`
4. Repeat for `witnessData` and `tokenData`

**Example:**

```typescript
// Copy the transformed lemmas object here
export const lemmaData: Record<number, Lemma> = {
  1: { id: 1, transliteration: "šrm", meaning: "to greet" },
  2: { id: 2, transliteration: "sḏm", meaning: "to hear" },
  // ... more from your data
};

// Copy the transformed witnesses object here
export const witnessData: Record<string, Witness> = {
  "O. Turin 9588/57365": { id: "O. Turin 9588/57365", script: "Hieratic" },
  // ... more from your data
};

// Copy the transformed tokens object here
export const tokenData: Record<number, Token> = {
  493: {
    id: 493,
    lemma_id: 1,
    mdc_w_markup: "SA-A-Z4:r-Z1-m:a-A30~Y1~",
    mdc: "SA-A-Z4:r-Z1-m:a-A30-Y1",
    witness_id: "O. Turin 9588/57365",
    compound_id: null
  },
  // ... more from your data
};
```

## Step 4: Update Projects (Optional)

If you have different projects/corpora, update the `projects` array in `sampleData.ts`:

```typescript
export const projects: Project[] = [
  {
    id: "egyptian-texts",
    name: "Egyptian Texts",
    description: "Late Egyptian texts from various sources",
    type: "hieroglyphic"
  },
  {
    id: "cuneiform-corpus",
    name: "Cuneiform Corpus",
    description: "Sumerian and Akkadian texts",
    type: "cuneiform"
  },
  // Add your projects here
];
```

## Step 5: Verify Data Integration

1. Save your changes to `sampleData.ts`
2. The development server should auto-reload (if running)
3. Navigate to each report tab in the application:
   - **Lemma Report**: Verify lemmas appear in the dropdown
   - **Classifier Report**: Verify classifiers are extracted from your data
   - **Query Report**: Test filters with your data
   - **Map Report**: Verify witnesses display correctly

## Important Notes

### Classifier Extraction

Classifiers are extracted from the `mdc_w_markup` field using this pattern:
```regex
~([A-Z0-9]+)~
```

For example: `SA-A-Z4:r-Z1-m:a-A30~Y1~` → Classifiers: `["Y1"]`

Ensure your markup follows this format with classifiers wrapped in tildes (`~`).

### Compound Tokens

If your database has compound words/tokens:
- Set `compound_id` to reference the main compound token
- The application will group and filter compound tokens separately
- The "Lemma Report" has filters for viewing compound tokens

### Data Validation

Before updating `sampleData.ts`, verify:
- All `lemma_id` values in tokens reference existing lemmas
- All `witness_id` values in tokens reference existing witnesses
- `compound_id` values are either NULL or reference valid token IDs
- Transliterations and meanings are properly encoded (UTF-8)

## Performance Considerations

### Large Datasets

If your dataset is very large (10,000+ tokens):

1. **Option A**: Keep using client-side data (current approach)
   - Load all data on app startup
   - All queries run in the browser
   - Best for datasets up to 50,000 tokens

2. **Option B**: Implement a backend API (future enhancement)
   - Create API endpoints in `server/routes/`
   - Implement pagination and server-side filtering
   - Recommended for datasets 50,000+ tokens

For now, **Option A** is recommended with your current dataset.

## Troubleshooting

### Issue: "Lemma not found" errors
**Solution**: Verify `lemma_id` values in tokens match `id` values in lemmas

### Issue: Classifiers not showing
**Solution**: Ensure `mdc_w_markup` contains classifier markup like `~A30~`

### Issue: Witnesses not displaying
**Solution**: Verify `witness_id` in tokens matches `id` in witnesses exactly (case-sensitive)

### Issue: Data not updating after changes
**Solution**: 
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard reload the page (Ctrl+F5 on Windows/Linux, Cmd+Shift+R on Mac)
3. Restart the dev server

## Next Steps

Once your data is integrated:

1. **Test all report views** to ensure data displays correctly
2. **Export reports** to CSV to verify data integrity
3. **Create multiple projects** if needed
4. **Customize the design** if desired (see `client/global.css`)

## Support

If you encounter any issues:
1. Check the browser console (F12) for error messages
2. Verify your JSON is valid using [jsonlint.com](https://www.jsonlint.com/)
3. Compare your data structure with the example in this guide

## Example: Complete Transform Script with Error Handling

Here's a more robust transformation script:

```python
import json
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional

def safe_int(value: Any, default: int = 0) -> int:
    """Safely convert value to int"""
    try:
        return int(value) if value is not None else default
    except (ValueError, TypeError):
        return default

def safe_str(value: Any, default: str = "") -> str:
    """Safely convert value to str"""
    return str(value) if value is not None else default

def validate_lemmas(data: Dict[int, Dict]) -> bool:
    """Validate lemma data"""
    for lemma_id, lemma in data.items():
        if not isinstance(lemma_id, int):
            print(f"Error: Lemma ID must be int, got {type(lemma_id)}")
            return False
        if not lemma.get('transliteration'):
            print(f"Warning: Lemma {lemma_id} has no transliteration")
    return True

def validate_witnesses(data: Dict[str, Dict]) -> bool:
    """Validate witness data"""
    for witness_id, witness in data.items():
        if not witness.get('script'):
            print(f"Warning: Witness {witness_id} has no script")
    return True

def validate_tokens(tokens: Dict[int, Dict], 
                   lemmas: Dict[int, Dict],
                   witnesses: Dict[str, Dict]) -> bool:
    """Validate token data"""
    missing_lemmas = set()
    missing_witnesses = set()
    
    for token_id, token in tokens.items():
        lemma_id = token.get('lemma_id')
        if lemma_id not in lemmas:
            missing_lemmas.add(lemma_id)
        
        witness_id = token.get('witness_id')
        if witness_id not in witnesses:
            missing_witnesses.add(witness_id)
    
    if missing_lemmas:
        print(f"Warning: Tokens reference missing lemmas: {missing_lemmas}")
    if missing_witnesses:
        print(f"Warning: Tokens reference missing witnesses: {missing_witnesses}")
    
    return len(missing_lemmas) == 0 and len(missing_witnesses) == 0

def transform_and_validate():
    """Main transformation with validation"""
    try:
        # Load data
        print("Loading source files...")
        with open('lemmas.json', 'r', encoding='utf-8') as f:
            lemmas_raw = json.load(f)
        with open('witnesses.json', 'r', encoding='utf-8') as f:
            witnesses_raw = json.load(f)
        with open('tokens.json', 'r', encoding='utf-8') as f:
            tokens_raw = json.load(f)
        
        # Transform
        print("Transforming data...")
        lemmas = {
            safe_int(item.get('id')): {
                'id': safe_int(item.get('id')),
                'transliteration': safe_str(item.get('transliteration')),
                'meaning': safe_str(item.get('meaning'))
            }
            for item in lemmas_raw
            if safe_int(item.get('id')) > 0
        }
        
        witnesses = {
            safe_str(item.get('id') or item.get('name')): {
                'id': safe_str(item.get('id') or item.get('name')),
                'script': safe_str(item.get('script'))
            }
            for item in witnesses_raw
        }
        
        tokens = {
            safe_int(item.get('id')): {
                'id': safe_int(item.get('id')),
                'lemma_id': safe_int(item.get('lemma_id')),
                'mdc_w_markup': safe_str(item.get('mdc_w_markup', item.get('mdc_with_markup'))),
                'mdc': safe_str(item.get('mdc')),
                'witness_id': safe_str(item.get('witness_id', item.get('source'))),
                'compound_id': safe_int(item.get('compound_id')) if item.get('compound_id') else None
            }
            for item in tokens_raw
            if safe_int(item.get('id')) > 0
        }
        
        # Validate
        print("Validating data...")
        validate_lemmas(lemmas) and print("  ✓ Lemmas valid")
        validate_witnesses(witnesses) and print("  ✓ Witnesses valid")
        validate_tokens(tokens, lemmas, witnesses) and print("  ✓ Tokens valid")
        
        # Save
        print("Saving transformed data...")
        output = {
            'lemmas': lemmas,
            'witnesses': witnesses,
            'tokens': tokens
        }
        
        with open('transformed_data.json', 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        
        print(f"\n✓ Success!")
        print(f"  - Lemmas: {len(lemmas)}")
        print(f"  - Witnesses: {len(witnesses)}")
        print(f"  - Tokens: {len(tokens)}")
        print(f"  - Output: transformed_data.json")
        
    except FileNotFoundError as e:
        print(f"Error: Missing file {e.filename}")
        print("Make sure lemmas.json, witnesses.json, and tokens.json exist")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in source file: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    transform_and_validate()
```

---

## Summary of Steps

1. **Export** your SQLite tables as JSON
2. **Transform** the JSON to match the required schema
3. **Update** `client/lib/sampleData.ts` with transformed data
4. **Verify** all reports display data correctly
5. **Test** filtering, searching, and export features

Your data is now integrated into the iClassifier reporting system!
