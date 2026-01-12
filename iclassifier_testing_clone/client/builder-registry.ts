/**
 * Builder.io Integration Registry
 * 
 * This file registers iClassifier components with Builder.io for visual page building.
 * Builder.io is optional - the app works fine without it.
 * 
 * To enable Builder.io integration:
 * 1. Install the package: npm install @builder.io/react
 * 2. Get your API key from https://builder.io/account/settings
 * 3. Add to .env.local: REACT_APP_BUILDER_PUBLIC_KEY=your_key_here
 */

import { projects } from "@/lib/sampleData";

// Try to load Builder.io (optional dependency)
let Builder: any = null

try {
  const builderModule = require('@builder.io/react')
  Builder = builderModule.Builder
} catch (e) {
  // Builder.io not installed - that's okay, the app still works
  console.log('💡 Tip: Install Builder.io to enable visual page building: npm install @builder.io/react')
}

// Only initialize if Builder is available
if (Builder) {
  const BUILDER_API_KEY = process.env.REACT_APP_BUILDER_PUBLIC_KEY || 'YOUR_BUILDER_PUBLIC_KEY'
  const projectOptions = projects.map((project) => ({
    label: project.name,
    value: project.id
  }));
  const defaultProjectId = projects[0]?.id || "ancient-egyptian";

  if (BUILDER_API_KEY && BUILDER_API_KEY !== 'YOUR_BUILDER_PUBLIC_KEY') {
    Builder.init(BUILDER_API_KEY)
    console.log('✅ Builder.io initialized successfully')
  } else {
    console.warn('⚠️  Builder.io API key not configured. Set REACT_APP_BUILDER_PUBLIC_KEY environment variable to enable.')
  }

  // Import components only if Builder is loaded
  import('./pages/ClassifierReport').then((module) => {
    Builder.registerComponent(module.default, {
      name: 'IClassifier Report - Classifier Analysis',
      description: 'Display detailed classifier statistics, co-occurrence patterns, and token analysis',
      image: 'https://cdn.builder.io/api/v1/image/assets/TEMP/classifier-icon',
      inputs: [
        {
          name: 'projectId',
          type: 'string',
          defaultValue: defaultProjectId,
          enum: projectOptions,
          helperText: 'Select the project/corpus to analyze'
        },
        {
          name: 'classifierId',
          type: 'string',
          defaultValue: '',
          helperText: 'Optional: Pre-select a classifier to display'
        },
        {
          name: 'showFilters',
          type: 'boolean',
          defaultValue: true,
          helperText: 'Show/hide filter controls'
        },
        {
          name: 'showNetworkGraph',
          type: 'boolean',
          defaultValue: true,
          helperText: 'Show/hide co-occurrence network visualization'
        },
        {
          name: 'showStatistics',
          type: 'boolean',
          defaultValue: true,
          helperText: 'Show/hide statistics tables'
        }
      ]
    })
  })

  import('./pages/LemmaReport').then((module) => {
    Builder.registerComponent(module.default, {
      name: 'IClassifier Report - Lemma Analysis',
      description: 'Display lemma frequencies, classifier combinations, and linguistic patterns',
      image: 'https://cdn.builder.io/api/v1/image/assets/TEMP/lemma-icon',
      inputs: [
        {
          name: 'projectId',
          type: 'string',
          defaultValue: defaultProjectId,
          enum: projectOptions,
          helperText: 'Select the project/corpus to analyze'
        },
        {
          name: 'lemmaId',
          type: 'string',
          defaultValue: '',
          helperText: 'Optional: Pre-select a lemma to display'
        },
        {
          name: 'tokenDisplayType',
          type: 'enum',
          defaultValue: 'all',
          enum: [
            { label: 'All tokens', value: 'all' },
            { label: 'Standalone tokens only', value: 'standalone' },
            { label: 'Compound tokens only', value: 'compound' },
            { label: 'Compound parts only', value: 'compound-part' }
          ],
          helperText: 'Filter tokens by type'
        },
        {
          name: 'showFilters',
          type: 'boolean',
          defaultValue: true,
          helperText: 'Show/hide filter controls'
        },
        {
          name: 'showNetworkGraph',
          type: 'boolean',
          defaultValue: true,
          helperText: 'Show/hide classifier co-occurrence network'
        }
      ]
    })
  })

  import('./components/TokenViewer').then((module) => {
    Builder.registerComponent(module.default, {
      name: 'IClassifier - Token Viewer',
      description: 'Display tokens with classifiers, lemma information, and linguistic annotations',
      image: 'https://cdn.builder.io/api/v1/image/assets/TEMP/token-icon',
      inputs: [
        {
          name: 'tokens',
          type: 'array',
          defaultValue: [],
          helperText: 'Array of tokens to display'
        },
        {
          name: 'showLemma',
          type: 'boolean',
          defaultValue: true,
          helperText: 'Display lemma information'
        },
        {
          name: 'showWitness',
          type: 'boolean',
          defaultValue: true,
          helperText: 'Display witness/source information'
        },
        {
          name: 'showClassifiers',
          type: 'boolean',
          defaultValue: true,
          helperText: 'Highlight classifiers in token display'
        },
        {
          name: 'rowsPerPage',
          type: 'number',
          defaultValue: 20,
          helperText: 'Number of tokens to display per page'
        },
        {
          name: 'exportable',
          type: 'boolean',
          defaultValue: true,
          helperText: 'Allow users to export token data as CSV'
        }
      ]
    })
  })

  import('./components/StatisticsTable').then((module) => {
    Builder.registerComponent(module.default, {
      name: 'IClassifier - Statistics Table',
      description: 'Display statistical data with sorting, filtering, and export options',
      image: 'https://cdn.builder.io/api/v1/image/assets/TEMP/stats-icon',
      inputs: [
        {
          name: 'title',
          type: 'string',
          defaultValue: 'Statistics',
          helperText: 'Table title/header'
        },
        {
          name: 'data',
          type: 'array',
          defaultValue: [],
          helperText: 'Array of data objects to display'
        },
        {
          name: 'columns',
          type: 'array',
          defaultValue: [
            { key: 'name', label: 'Name' },
            { key: 'count', label: 'Count' }
          ],
          helperText: 'Column definitions'
        },
        {
          name: 'sortable',
          type: 'boolean',
          defaultValue: true,
          helperText: 'Allow column sorting'
        },
        {
          name: 'filterable',
          type: 'boolean',
          defaultValue: true,
          helperText: 'Show filter input'
        },
        {
          name: 'exportable',
          type: 'boolean',
          defaultValue: true,
          helperText: 'Allow CSV export'
        },
        {
          name: 'pageSize',
          type: 'number',
          defaultValue: 25,
          helperText: 'Rows per page'
        }
      ]
    })
  })

  // Legacy components
  import('./pages/ClassifierReport').then((module) => {
    Builder.registerComponent(module.default, {
      name: 'IClassifier Tokens (Legacy)',
      description: 'Legacy component - use Classifier Analysis instead',
      inputs: [
        {
          name: 'projectName',
          type: 'string',
          defaultValue: 'guodian',
          helperText: 'Project name (legacy)'
        },
        {
          name: 'limit',
          type: 'number',
          defaultValue: 50,
          helperText: 'Maximum tokens to display'
        },
        {
          name: 'showTranslation',
          type: 'boolean',
          defaultValue: true,
          helperText: 'Display translations'
        }
      ]
    })
  })

  import('./pages/LemmaReport').then((module) => {
    Builder.registerComponent(module.default, {
      name: 'IClassifier Lemmas (Legacy)',
      description: 'Legacy component - use Lemma Analysis instead',
      inputs: [
        {
          name: 'projectName',
          type: 'string',
          defaultValue: '',
          helperText: 'Project name (legacy)'
        },
        {
          name: 'lexicalField',
          type: 'string',
          defaultValue: '',
          helperText: 'Lexical field filter (legacy)'
        }
      ]
    })
  })
}

export { Builder }
