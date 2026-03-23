# Builder.io Integration Guide

This guide explains how to use the Builder.io visual editor with the iClassifier application to create and manage reports dynamically.

## 📋 Table of Contents

1. [Setup](#setup)
2. [Registered Components](#registered-components)
3. [Component Usage](#component-usage)
4. [Environment Variables](#environment-variables)
5. [Examples](#examples)

## Setup

### 1. Get Builder.io API Key

1. Go to [Builder.io](https://builder.io)
2. Sign up or log in to your account
3. Navigate to **Account Settings** → **API Keys**
4. Copy your **Public API Key**

### 2. Configure Environment Variables

Create a `.env.local` file in your project root:

```bash
cp .env.example .env.local
```

Add your Builder.io API key:

```
REACT_APP_BUILDER_PUBLIC_KEY=your_public_key_here
```

### 3. Import Builder Registry

In your app's entry point (`client/main.tsx` or similar), import the registry:

```typescript
import '../src/builder-registry'
```

### 4. Verify Setup

Run your dev server and visit http://localhost:8080. Check the console for any errors:

```bash
npm run dev
```

If successful, you should see: `Builder.io initialized with API key: [key]`

---

## Registered Components

### 1. **IClassifier Report - Classifier Analysis**

Display detailed classifier statistics and co-occurrence patterns.

**Inputs:**
- `projectId` (enum): Select from predefined projects
- `classifierId` (string): Pre-select a classifier
- `showFilters` (boolean): Show/hide filter controls
- `showNetworkGraph` (boolean): Show/hide network visualization
- `showStatistics` (boolean): Show/hide statistics tables

**Use Cases:**
- Explore classifier usage patterns
- Analyze co-occurrence with other classifiers
- View lemma frequencies for a specific classifier
- Examine token distribution by witness/script

---

### 2. **IClassifier Report - Lemma Analysis**

Display lemma frequencies and linguistic patterns.

**Inputs:**
- `projectId` (enum): Select from predefined projects
- `lemmaId` (string): Pre-select a lemma
- `tokenDisplayType` (enum): Filter by token type
  - `all`: All tokens
  - `standalone`: Standalone tokens only
  - `compound`: Compound tokens only
  - `compound-part`: Compound parts only
- `showFilters` (boolean): Show/hide filter controls
- `showNetworkGraph` (boolean): Show/hide classifier network

**Use Cases:**
- Study lemma usage across different witnesses
- Analyze classifier combinations with lemmas
- Compare linguistic patterns by script type
- Examine compound word structures

---

### 3. **IClassifier - Token Viewer**

Display tokens with detailed information.

**Inputs:**
- `tokens` (array): Token IDs to display
- `showLemma` (boolean): Display lemma information
- `showWitness` (boolean): Display witness/source
- `showClassifiers` (boolean): Highlight classifiers
- `rowsPerPage` (number): Pagination size
- `exportable` (boolean): Enable CSV export

**Use Cases:**
- Display specific token lists
- Create custom token collections
- Generate token reports with selected fields
- Export token data for analysis

---

### 4. **IClassifier - Statistics Table**

Flexible table component for displaying any statistical data.

**Inputs:**
- `title` (string): Table title
- `data` (array): Data to display
- `columns` (array): Column definitions
- `sortable` (boolean): Enable column sorting
- `filterable` (boolean): Show filter input
- `exportable` (boolean): Enable CSV export
- `pageSize` (number): Rows per page

**Use Cases:**
- Display lemma frequency rankings
- Show classifier co-occurrence matrices
- Present linguistic statistics
- Create comparison tables

---

## Component Usage

### Using the Builder.io Visual Editor

1. **Create New Page/Section**
   - Go to your Builder.io workspace
   - Create a new page or edit existing content
   - Click **+ Add Block** in the editor

2. **Insert iClassifier Component**
   - Search for "IClassifier" in the component panel
   - Select the component you want (e.g., "Classifier Analysis")
   - Configure inputs in the right sidebar

3. **Configure Settings**
   - Select project from dropdown
   - Set filters and display options
   - Preview changes in real-time

4. **Publish**
   - Click **Publish** to save changes
   - Changes will be reflected in your app automatically

**Note**: The Builder.io registry is initialized automatically when your app loads (`client/builder-registry.ts` is imported in `client/App.tsx`)

### Programmatic Usage

You can also use components directly in your React code:

```tsx
import ClassifierReport from '@/pages/ClassifierReport'
import TokenViewer from '@/components/TokenViewer'
import StatisticsTable from '@/components/StatisticsTable'

export function MyPage() {
  return (
    <div>
      <ClassifierReport projectId="egyptian-texts" />
      
      <TokenViewer
        tokens={[493, 494, 495]}
        showLemma={true}
        rowsPerPage={50}
      />
      
      <StatisticsTable
        title="Classifier Frequencies"
        data={[
          { name: 'A30', count: 42 },
          { name: 'D37', count: 38 }
        ]}
        columns={[
          { key: 'name', label: 'Classifier' },
          { key: 'count', label: 'Frequency', numeric: true }
        ]}
      />
    </div>
  )
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REACT_APP_BUILDER_PUBLIC_KEY` | - | Your Builder.io public API key (required) |
| `REACT_APP_API_URL` | `http://localhost:8080` | Backend API base URL |
| `REACT_APP_API_TIMEOUT` | `30000` | API request timeout in ms |
| `REACT_APP_DEFAULT_PROJECT` | `egyptian-texts` | Default project on load |
| `REACT_APP_ENABLE_SAMPLE_DATA` | `true` | Use sample data or fetch from API |
| `REACT_APP_ENABLE_EXPORTS` | `true` | Enable CSV export functionality |
| `REACT_APP_ENABLE_NETWORK_GRAPH` | `true` | Enable network visualization |
| `REACT_APP_MAX_TOKENS_DISPLAY` | `1000` | Maximum tokens to load at once |

---

## Examples

### Example 1: Create a Classifier Analysis Page

1. In Builder.io, create a new page named "Classifier Report"
2. Add the component: **IClassifier Report - Classifier Analysis**
3. Configure:
   - **projectId**: `egyptian-texts`
   - **showFilters**: ✓
   - **showNetworkGraph**: ✓
4. Publish and visit the page

### Example 2: Lemma Study Page

1. Create a new page "Lemma Study"
2. Add: **IClassifier Report - Lemma Analysis**
3. Add a second block: **IClassifier - Statistics Table**
4. Configure the stats table to show lemma frequencies
5. Publish

### Example 3: Custom Token Dashboard

1. Create a new page "Token Analysis"
2. Add: **IClassifier - Token Viewer**
3. Provide specific token IDs: `[493, 494, 495, 496]`
4. Enable all fields
5. Add: **IClassifier - Statistics Table**
6. Show POS distribution
7. Publish

---

## Troubleshooting

### "Builder.io API key not configured"

**Solution**: Make sure `.env.local` includes your API key:

```bash
REACT_APP_BUILDER_PUBLIC_KEY=your_key_here
```

Restart the dev server after updating.

### Components not appearing in Builder editor

1. **Clear builder cache**: Hard refresh (Ctrl+Shift+R)
2. **Verify import**: Check `client/main.tsx` imports the registry
3. **Check API key**: Ensure it's valid in Builder.io settings
4. **Rebuild**: Stop and restart dev server

### Data not loading

1. Check browser console for API errors
2. Verify `REACT_APP_API_URL` matches your backend
3. Check network tab in DevTools for failed requests
4. Ensure sample data is available if using default

### Network graph not rendering

1. Ensure `showNetworkGraph` is enabled
2. Check for browser console errors
3. Verify data has classifiers with co-occurrences
4. Try a different project/classifier

---

## Advanced Configuration

### Custom Data Source

To use a backend API instead of sample data:

1. Update `client/lib/sampleData.ts` to fetch from API:

```typescript
export async function fetchTokenData() {
  const response = await fetch('/api/tokens')
  return response.json()
}
```

2. Update components to use the API:

```typescript
useEffect(() => {
  fetchTokenData().then(setTokens)
}, [])
```

### Custom Components

Add your own components to the registry:

```typescript
Builder.registerComponent(MyComponent, {
  name: 'My Custom Component',
  inputs: [
    { name: 'title', type: 'string' },
    { name: 'data', type: 'array' }
  ]
})
```

### Styling Customization

Builder.io supports styling through custom CSS:

1. In Builder editor, select component
2. Go to **Styles** panel
3. Add custom CSS classes
4. Define in your global CSS

---

## Next Steps

1. ✅ Set up Builder.io account and get API key
2. ✅ Add API key to `.env.local`
3. ✅ Import registry in app entry point
4. ✅ Start dev server
5. 📖 Visit Builder.io editor and create first page
6. 🚀 Publish and see it live in your app!

For more help, see:
- [Builder.io Documentation](https://builder.io/c/docs)
- [Component Registration](https://builder.io/c/docs/custom-components)
- [API Reference](https://builder.io/c/docs/apis)
