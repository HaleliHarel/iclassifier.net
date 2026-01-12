import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

console.log('Building the application...');
execSync('pnpm build', { stdio: 'inherit' });

console.log('\nCreating standalone HTML exports...');

// Read the built HTML
const htmlTemplate = readFileSync('dist/spa/index.html', 'utf-8');

// Create homepage export
const homepageHtml = htmlTemplate.replace(
  '<title>',
  '<title>iClassifier - Home | '
);

writeFileSync('dist/homepage.html', homepageHtml);
console.log('✓ Created dist/homepage.html');

// Create lemma report export
const lemmaReportHtml = htmlTemplate.replace(
  '<title>',
  '<title>iClassifier - Lemma Report | '
);

writeFileSync('dist/lemma-report.html', lemmaReportHtml);
console.log('✓ Created dist/lemma-report.html');

console.log('\n✅ HTML export complete!');
console.log('\nYou can find the exported files at:');
console.log('  - dist/homepage.html');
console.log('  - dist/lemma-report.html');
console.log('\nNote: These files work with client-side routing.');
console.log('Open homepage.html and use the navigation to access both pages.');
