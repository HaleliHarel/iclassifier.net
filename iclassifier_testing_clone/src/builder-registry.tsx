import { Builder } from '@builder.io/react'
import ClassifierReport from '../client/pages/ClassifierReport'
import LemmaReport from '../client/pages/LemmaReport'
import TokenViewer from '../client/components/TokenViewer'
import StatisticsTable from '../client/components/StatisticsTable'

// Initialize with your Builder.io API key from environment variables
const BUILDER_API_KEY = process.env.REACT_APP_BUILDER_PUBLIC_KEY || 'YOUR_BUILDER_PUBLIC_KEY'

if (BUILDER_API_KEY && BUILDER_API_KEY !== 'YOUR_BUILDER_PUBLIC_KEY') {
  Builder.init(BUILDER_API_KEY)
} else {
  console.warn('Builder.io API key not configured. Set REACT_APP_BUILDER_PUBLIC_KEY environment variable.')
}

/**
 * Register ClassifierReport Component
 * Allows content editors to display classifier analysis reports
 */
Builder.registerComponent(ClassifierReport, {
  name: 'IClassifier Report - Classifier Analysis',
  description: 'Display detailed classifier statistics, co-occurrence patterns, and token analysis',
  image: 'https://cdn.builder.io/api/v1/image/assets/TEMP/classifier-icon',
  inputs: [
    {
      name: 'projectId',
      type: 'string',
      defaultValue: 'egyptian-texts',
      enum: [
        { label: 'Ancient Egyptian Scripts', value: 'egyptian-texts' },
        { label: 'Sumerian iClassifier', value: 'cuneiform-corpus' },
        { label: 'Ancient Chinese', value: 'chinese-oracle' },
        { label: 'Anatolian Hieroglyphs', value: 'anatolian-hieroglyphs' }
      ],
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
  ],
  hideFromInsertMenu: false,
  canHaveChildren: false
})

/**
 * Register LemmaReport Component
 * Allows content editors to display lemma analysis reports
 */
Builder.registerComponent(LemmaReport, {
  name: 'IClassifier Report - Lemma Analysis',
  description: 'Display lemma frequencies, classifier combinations, and linguistic patterns',
  image: 'https://cdn.builder.io/api/v1/image/assets/TEMP/lemma-icon',
  inputs: [
    {
      name: 'projectId',
      type: 'string',
      defaultValue: 'egyptian-texts',
      enum: [
        { label: 'Ancient Egyptian Scripts', value: 'egyptian-texts' },
        { label: 'Sumerian iClassifier', value: 'cuneiform-corpus' },
        { label: 'Ancient Chinese', value: 'chinese-oracle' },
        { label: 'Anatolian Hieroglyphs', value: 'anatolian-hieroglyphs' }
      ],
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
  ],
  hideFromInsertMenu: false,
  canHaveChildren: false
})

/**
 * Register TokenViewer Component
 * Allows content editors to display token lists with detailed information
 */
Builder.registerComponent(TokenViewer, {
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
  ],
  hideFromInsertMenu: false,
  canHaveChildren: false
})

/**
 * Register StatisticsTable Component
 * Allows content editors to display statistics in various formats
 */
Builder.registerComponent(StatisticsTable, {
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
  ],
  hideFromInsertMenu: false,
  canHaveChildren: false
})

/**
 * Register IClassifier Tokens Block
 * Original component for legacy compatibility
 */
Builder.registerComponent({
  component: ClassifierReport,
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

/**
 * Register IClassifier Lemmas Block
 * Original component for legacy compatibility
 */
Builder.registerComponent({
  component: LemmaReport,
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

export default Builder
