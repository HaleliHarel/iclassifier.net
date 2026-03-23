# Builder.io Integration Setup Checklist

Follow these steps to integrate Builder.io with your iClassifier application.

## ✅ Prerequisites

- [ ] Builder.io account created (https://builder.io)
- [ ] Node.js installed
- [ ] Project cloned and dependencies installed (`npm install`)

---

## 🔧 Installation Steps

### Step 1: Get Your API Key

- [ ] Go to https://builder.io/account/settings
- [ ] Navigate to **API Keys** section
- [ ] Copy your **Public API Key** (starts with `eyJ...`)
- [ ] Keep it safe - you'll need it next

### Step 2: Configure Environment

- [ ] Copy `.env.example` to `.env.local`:
  ```bash
  cp .env.example .env.local
  ```
- [ ] Edit `.env.local` and add your API key:
  ```
  REACT_APP_BUILDER_PUBLIC_KEY=your_key_here
  ```
- [ ] Save the file

### Step 3: Verify Files Created

- [ ] `client/builder-registry.ts` exists
- [ ] `client/components/TokenViewer.tsx` exists
- [ ] `client/components/StatisticsTable.tsx` exists
- [ ] `.env.example` is present
- [ ] `BUILDER_IO_INTEGRATION.md` is present

### Step 4: Verify Registry Import

The registry is automatically imported in `client/App.tsx`:

```typescript
import "./builder-registry";
```

This import is included by default and loads the registry when your app starts.

- [ ] Check `client/App.tsx` has `import "./builder-registry"`
- [ ] Import is at the top of the file

### Step 5: Start Development Server

```bash
npm run dev
```

Check the browser console for confirmation message:
- [ ] No errors in console about Builder.io
- [ ] App loads successfully on http://localhost:8080

---

## 🧪 Testing

### Test Component Registration

1. [ ] Open your app in browser
2. [ ] Open browser DevTools (F12)
3. [ ] Check Console tab - should see no Builder-related errors
4. [ ] Go to your Builder.io workspace
5. [ ] Create a new **Page** or **Section**
6. [ ] Click **+ Add Block** or **Add Component**
7. [ ] Search for "IClassifier" - should show:
   - [ ] IClassifier Report - Classifier Analysis
   - [ ] IClassifier Report - Lemma Analysis
   - [ ] IClassifier - Token Viewer
   - [ ] IClassifier - Statistics Table

### Test Component Functionality

1. [ ] Add **Classifier Analysis** component
2. [ ] Configure:
   - [ ] Select a project
   - [ ] Toggle filters on/off
   - [ ] Save settings
3. [ ] Preview should show the classifier report
4. [ ] Try filtering and searching - should work
5. [ ] Try exporting - should download CSV
6. [ ] Network graph should render (if enabled)

---

## 📋 Configuration Checklist

### Environment Variables

- [ ] `REACT_APP_BUILDER_PUBLIC_KEY` set with your key
- [ ] `REACT_APP_API_URL` set correctly (usually `http://localhost:8080`)
- [ ] `REACT_APP_DEFAULT_PROJECT` set (default: `egyptian-texts`)
- [ ] Feature flags set as desired:
  - [ ] `REACT_APP_ENABLE_EXPORTS=true`
  - [ ] `REACT_APP_ENABLE_NETWORK_GRAPH=true`
  - [ ] `REACT_APP_ENABLE_FILTERS=true`

### Builder.io Settings

- [ ] Project created in Builder.io
- [ ] API key is valid and active
- [ ] Components appear in the editor
- [ ] Preview works with sample data

---

## 🚀 Deployment Checklist

### Before Deploying to Production

- [ ] Remove `.env.local` from `.gitignore` (use `.env` instead for CI/CD)
- [ ] Set `REACT_APP_BUILDER_PUBLIC_KEY` in your hosting environment:
  - [ ] **Netlify**: Set in Build & Deploy settings
  - [ ] **Vercel**: Set in Environment Variables
  - [ ] **Other**: Set in your CI/CD pipeline
- [ ] Test deployment in staging first
- [ ] Verify components still work after deploy

### Production Safety

- [ ] API key is in environment variables (not committed)
- [ ] `.env.local` is in `.gitignore`
- [ ] Only public API key is exposed (no private keys)
- [ ] CORS is configured if using separate domain

---

## 🐛 Troubleshooting

### Issue: "Builder.io API key not configured"

- [ ] Check `.env.local` file exists
- [ ] Check key format (should be long JWT string)
- [ ] Restart dev server after updating `.env.local`
- [ ] Clear browser cache

### Issue: Components don't appear in Builder editor

- [ ] Hard refresh Builder.io (Ctrl+Shift+R)
- [ ] Verify API key is correct
- [ ] Check dev server is running
- [ ] Check browser console for errors
- [ ] Try a different browser

### Issue: Data not loading in components

- [ ] Check network tab (DevTools → Network)
- [ ] Verify API URL matches backend
- [ ] Check backend is running
- [ ] Check sample data exists
- [ ] Look for CORS errors

### Issue: Network graph not rendering

- [ ] Enable JavaScript in browser
- [ ] Check browser console for errors
- [ ] Verify `showNetworkGraph` is enabled
- [ ] Try with a different classifier/lemma
- [ ] Check if data has co-occurrences

---

## 📖 Documentation Links

- [ ] Read `BUILDER_IO_INTEGRATION.md` for detailed usage
- [ ] Review `src/builder-registry.tsx` to see all component definitions
- [ ] Check Builder.io docs: https://builder.io/c/docs
- [ ] Explore custom component examples

---

## ✨ Next Steps After Setup

1. [ ] Create your first page in Builder.io
2. [ ] Add a Classifier Report component
3. [ ] Configure it with your preferred project
4. [ ] Publish and test
5. [ ] Create more pages with different components
6. [ ] Share URLs with team members
7. [ ] Set up custom styling and branding

---

## 🎉 Success Indicators

You'll know everything is working when:

✅ Components appear in Builder.io editor  
✅ Components display data correctly  
✅ Filters and sorting work  
✅ CSV export downloads files  
✅ Network graphs render  
✅ No console errors  
✅ Pages publish without errors  

---

## 📞 Need Help?

- Check `BUILDER_IO_INTEGRATION.md` for detailed troubleshooting
- Visit https://builder.io/support
- Review component source code in `client/components/`
- Check `src/builder-registry.tsx` for component definitions

---

**Last Updated**: January 2026  
**Status**: ✅ Ready to use
