#!/usr/bin/env node

/**
 * Database Setup Script
 * Downloads and places database files in the correct location
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Database configuration
const DATABASES = [
  {
    name: 'egyptian-texts.db',
    title: 'Late Egyptian Stories',
    url: 'https://cdn.builder.io/o/assets%2F9b85a9b7160046d8810aa65084b2d8be%2Fff0c8738ee3247308fa8c827c3f227ed?alt=media&token=bd17d361-55e7-456e-9b4c-6f39ad0fdd21&apiKey=9b85a9b7160046d8810aa65084b2d8be'
  },
  // Add more databases as needed
  // {
  //   name: 'anatolian-hieroglyphs.db',
  //   title: 'Luwian Text',
  //   url: 'https://...'
  // }
];

const DATABASES_DIR = path.join(__dirname, 'databases');

/**
 * Ensure databases directory exists
 */
function ensureDbDir() {
  if (!fs.existsSync(DATABASES_DIR)) {
    fs.mkdirSync(DATABASES_DIR, { recursive: true });
    console.log(`✓ Created databases directory: ${DATABASES_DIR}`);
  }
}

/**
 * Download a file from URL
 */
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(filepath);
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(filepath, () => {}); // Delete partial file
        reject(err);
      });
    });

    request.on('error', reject);
  });
}

/**
 * Verify database file
 */
function verifyDatabase(filepath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(filepath)) {
      resolve(false);
      return;
    }

    const stats = fs.statSync(filepath);
    const isValid = stats.size > 0;
    
    if (isValid) {
      console.log(`  File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    }

    resolve(isValid);
  });
}

/**
 * Main setup function
 */
async function setup() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          iClassifier Database Setup                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Ensure directory exists
    ensureDbDir();
    console.log(`Database directory: ${DATABASES_DIR}\n`);

    // Step 2: Download/setup each database
    console.log('Setting up databases...\n');
    
    for (const db of DATABASES) {
      const filepath = path.join(DATABASES_DIR, db.name);
      
      console.log(`📦 ${db.title}`);
      console.log(`   Name: ${db.name}`);
      
      if (fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath);
        console.log(`   ✓ Already exists (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      } else {
        console.log(`   Downloading...`);
        try {
          await downloadFile(db.url, filepath);
          const isValid = await verifyDatabase(filepath);
          
          if (isValid) {
            console.log(`   ✓ Downloaded successfully`);
          } else {
            console.log(`   ✗ Download failed - file is empty`);
            fs.unlinkSync(filepath);
          }
        } catch (error) {
          console.log(`   ✗ Download failed: ${error.message}`);
          console.log(`   Manual setup: Download from ${db.url}`);
          console.log(`   Then place at: ${filepath}`);
        }
      }
      console.log();
    }

    // Step 3: Summary
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    Setup Complete!                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('Next steps:');
    console.log('1. Verify files are in place:');
    console.log(`   ls -lh ${DATABASES_DIR}/\n`);

    console.log('2. Start the dev server:');
    console.log('   npm run dev\n');

    console.log('3. Visit the app:');
    console.log('   http://localhost:8080/lemma-report?projectId=egyptian-texts\n');

  } catch (error) {
    console.error('\n✗ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup
setup();
