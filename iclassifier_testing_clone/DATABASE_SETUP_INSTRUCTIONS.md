# Database Setup Instructions

## What I've Done

✅ Created `.env.local` file with the correct configuration  
✅ Created `./data/projects/` directory where your database files should go  
✅ The API is now configured to look for files in `./data/projects/`

## What You Need to Do

### Step 1: Locate Your Database Files

You uploaded two `clf.db` files:
- One for **Egyptian text** (Pebers data)
- One for **Luwian/Anatolian text** (Luwian data)

Find where these files are located on your system.

### Step 2: Copy Files to the Data Projects Directory

The API looks for databases with these specific names:

```
./data/projects/
├── egyptian-texts.db          ← For Egyptian/Pebers data
└── anatolian-hieroglyphs.db   ← For Luwian/Anatolian Hieroglyphs data
```

**Option A: Copy the files**

```bash
# If your Egyptian file is called clf.db:
cp /path/to/egyptian/clf.db ./data/projects/egyptian-texts.db

# If your Luwian file is called clf.db:
cp /path/to/luwian/clf.db ./data/projects/anatolian-hieroglyphs.db
```

**Option B: Create symlinks** (keeps originals in place)

```bash
ln -s /path/to/egyptian/clf.db ./data/projects/egyptian-texts.db
ln -s /path/to/luwian/clf.db ./data/projects/anatolian-hieroglyphs.db
```

### Step 3: Verify the Setup

Check that your files are in place:

```bash
ls -lh ./data/projects/
```

You should see:
```
-rw-r--r-- user  group  size  date  egyptian-texts.db
-rw-r--r-- user  group  size  date  anatolian-hieroglyphs.db
```

### Step 4: Verify Database Contents

Make sure the databases have the required tables:

```bash
# Check Egyptian database
sqlite3 ./databases/egyptian-texts.db ".tables"

# You should see: classifier_metadata, lemmas, tokens, witnesses
```

### Step 5: Restart the Dev Server

```bash
# Stop the current dev server (Ctrl+C)
# Then restart it:
npm run dev
```

### Step 6: Test the App

Visit in your browser:
- http://localhost:8080/lemma-report?projectId=egyptian-texts

You should see:
- ✅ Page loads without errors
- ✅ Data from your database appears
- ✅ Lemmas, tokens, and classifiers display
- ✅ Filters work

---

## Troubleshooting

### Still Getting JSON Error?

**Problem:** "Unexpected token '<', '<!doctype' is not valid JSON"

**Solution:**
1. Check files exist: `ls -lh ./data/projects/`
2. Check environment variable is set: `echo $ICLASSIFIER_DATA_PATH`
3. Verify database has correct tables: `sqlite3 ./data/projects/egyptian-texts.db ".tables"`
4. Check server logs for errors: Look at terminal running `npm run dev`

### Database Says "No such file or directory"

**Solution:**
1. Make sure you copied the files to `./data/projects/`
2. Check filenames are exact: `egyptian-texts.db` and `anatolian-hieroglyphs.db`
3. Verify with: `ls -la ./data/projects/`

### Table Not Found Error

**Solution:**
Make sure your database files have the required tables:
```bash
sqlite3 ./data/projects/egyptian-texts.db "SELECT name FROM sqlite_master WHERE type='table';"
```

Expected tables:
- lemmas
- tokens
- witnesses
- classifier_metadata

---

## File Paths Reference

| What | Path |
|---|---|
| Config file | `.env.local` |
| Database directory | `./data/projects/` |
| Egyptian data | `./data/projects/egyptian-texts.db` |
| Anatolian data | `./data/projects/anatolian-hieroglyphs.db` |
| Server code | `server/` |
| API routes | `server/routes/iclassifier-api.ts` |
| Database client | `server/database/iclassifier-db.ts` |

---

## API Endpoints

Once your databases are set up, these endpoints will work:

```
GET /api/iclassifier/egyptian-texts/lemmas
GET /api/iclassifier/egyptian-texts/tokens
GET /api/iclassifier/egyptian-texts/witnesses
GET /api/iclassifier/egyptian-texts/classifier-metadata
GET /api/iclassifier/egyptian-texts/full

GET /api/iclassifier/anatolian-hieroglyphs/lemmas
GET /api/iclassifier/anatolian-hieroglyphs/tokens
GET /api/iclassifier/anatolian-hieroglyphs/witnesses
GET /api/iclassifier/anatolian-hieroglyphs/classifier-metadata
GET /api/iclassifier/anatolian-hieroglyphs/full
```

Test with curl:
```bash
curl http://localhost:8080/api/iclassifier/egyptian-texts/lemmas | jq '.' | head -20
```

---

## Next Steps

1. ✅ **Locate your clf.db files**
2. ✅ **Copy them to ./data/projects/ with the correct names**
3. ✅ **Verify they're readable: `ls -lh ./data/projects/`**
4. ✅ **Restart dev server: `npm run dev`**
5. ✅ **Test the app: http://localhost:8080/lemma-report?projectId=egyptian-texts**

Let me know when you've done these steps, and if you hit any issues! 🚀
