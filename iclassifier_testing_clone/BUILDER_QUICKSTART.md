# 🚀 Builder.io Integration Quick Start

Your iClassifier app is now ready to use with Builder.io!

## 5-Minute Setup

### 1. **Get Your API Key** (2 minutes)

```
1. Go to: https://builder.io/account/settings
2. Click: API Keys
3. Copy: Public API Key (looks like: eyJ...)
```

### 2. **Add to Your App** (2 minutes)

Create `.env.local` in your project root:

```bash
REACT_APP_BUILDER_PUBLIC_KEY=paste_your_key_here
```

### 3. **Start Dev Server** (1 minute)

```bash
npm run dev
```

✅ **Done!** Visit http://localhost:8080

---

## ✨ What You Can Do Now

### In Builder.io Editor

1. **Create a new page**: Click **+ Create Content**
2. **Add a component**: Click **+ Add Block**
3. **Search for "IClassifier"** → Pick one:
   - **Classifier Analysis** - Explore classifier patterns
   - **Lemma Analysis** - Study lemma usage
   - **Token Viewer** - Display token lists
   - **Statistics Table** - Show any data table

4. **Configure**: Adjust settings in the right panel
5. **Publish**: Click **Publish** to save

### Available Components

| Component | What It Does |
|-----------|-------------|
| **Classifier Analysis** | Show classifier statistics, co-occurrence patterns, and tokens |
| **Lemma Analysis** | Display lemma frequencies, classifiers, and linguistic patterns |
| **Token Viewer** | List tokens with lemma, classifier, and witness info |
| **Statistics Table** | Flexible table with sorting, filtering, and export |

---

## 🎯 Common Use Cases

### Create a "Classifier Report" Page

```
1. In Builder.io, create new page "classifier-report"
2. Add block: "IClassifier Report - Classifier Analysis"
3. Configure:
   - Project: Egyptian Scripts
   - Show Filters: ✓
   - Show Network Graph: ✓
4. Publish
5. Visit: https://your-domain.com/classifier-report
```

### Create a "Lemma Analysis" Page

```
1. Create page "lemma-analysis"
2. Add block: "IClassifier Report - Lemma Analysis"
3. Configure filters
4. Publish
```

### Embed in Existing Content

Add components to existing pages or sections in Builder.io.

---

## 🔧 Component Inputs Explained

### Classifier Analysis

- **projectId**: Which corpus to analyze (Egyptian, Sumerian, Chinese, Anatolian Hieroglyphs)
- **classifierId**: (Optional) Start with specific classifier selected
- **showFilters**: Toggle witness/script/POS filters
- **showNetworkGraph**: Toggle co-occurrence visualization
- **showStatistics**: Toggle statistics tables

### Lemma Analysis

- **projectId**: Which corpus to use
- **lemmaId**: (Optional) Pre-select a lemma
- **tokenDisplayType**: Show all/standalone/compound/parts
- **showFilters**: Toggle filters
- **showNetworkGraph**: Toggle classifier network

### Token Viewer

- **tokens**: Specific token IDs to show
- **showLemma**: Display lemma column
- **showWitness**: Display witness column
- **showClassifiers**: Display classifiers
- **rowsPerPage**: How many rows per page

### Statistics Table

- **title**: Table heading
- **data**: Array of data objects
- **columns**: Which columns to display
- **sortable**: Allow clicking headers to sort
- **filterable**: Show filter input
- **exportable**: Enable CSV download

---

## 📁 Files Created/Modified

```
client/
  └── builder-registry.ts            ← Component registration
client/
  ├── components/
  │   ├── TokenViewer.tsx            ← New component
  │   ├── StatisticsTable.tsx        ← New component
  │   └── ClassifierTypeSelector.tsx ← New component
  ├── filters/
  │   ├── WitnessSelector.tsx
  │   ├── POSSelector.tsx
  │   ├── ScriptSelector.tsx
  │   └── ClassifierTypeSelector.tsx
  ├── App.tsx                        ← Updated (imports registry)
  └── pages/
      ├── ClassifierReport.tsx       ← Updated
      └── LemmaReport.tsx            ← Updated
.env.example                         ← Template
BUILDER_IO_INTEGRATION.md            ← Full documentation
BUILDER_SETUP_CHECKLIST.md           ← Step-by-step guide
```

---

## 🧪 Test It Works

1. **Open Builder.io editor**
2. **Create new page**
3. **Click "+ Add Block"**
4. **Search "IClassifier"**

❓ **Don't see components?**
- Refresh browser (Ctrl+Shift+R)
- Check API key in `.env.local`
- Check browser console for errors
- Restart dev server

✅ **See 4 components?**  
Success! You're ready to create pages.

---

## 📖 Need More Info?

- **Setup Guide**: Read `BUILDER_SETUP_CHECKLIST.md`
- **Full Docs**: Read `BUILDER_IO_INTEGRATION.md`
- **Troubleshooting**: Check section at end of integration guide
- **Component Code**: Check `src/builder-registry.tsx`

---

## 🎨 Next Steps

1. ✅ Add API key to `.env.local`
2. ✅ Start dev server
3. 📱 Go to Builder.io editor
4. ➕ Create a new page
5. 🧩 Add an iClassifier component
6. ⚙️ Configure settings
7. 📤 Publish
8. 🎉 View your page!

---

## ⚡ Pro Tips

**💡 Tip 1**: You can use multiple components on one page

**💡 Tip 2**: Components are responsive - work on mobile too

**💡 Tip 3**: Use the "Preview" button in Builder to see changes

**💡 Tip 4**: Export data as CSV from most components

**💡 Tip 5**: Network graphs are interactive - drag nodes around!

---

## 🚨 Common Issues

**Q: "Components don't show in Builder editor"**  
A: Refresh Builder page (Ctrl+Shift+R), check API key, restart dev server

**Q: "Data not loading"**  
A: Check dev server is running, verify network tab in DevTools, check console for errors

**Q: "Network graph not showing"**  
A: Not all classifiers have co-occurrences. Try different classifier/lemma with more data

**Q: "CSV export not working"**  
A: Check browser console for errors, verify data exists, try different browser

---

## 🎓 Learning Resources

- https://builder.io/c/docs/getting-started
- https://builder.io/c/docs/custom-components
- https://builder.io/c/docs/apis

---

**Ready to go!** 🚀 Your components are registered and waiting in Builder.io.
