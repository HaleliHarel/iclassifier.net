#!/usr/bin/env node

/**
 * Database Diagnostic Script
 * Checks what tables and data are in the database files
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATABASES_DIR = path.join(__dirname, 'databases');

const EXPECTED_TABLES = ['lemmas', 'tokens', 'witnesses', 'classifier_metadata'];

function diagnoseDatabase(dbFile) {
  console.log(`\n📊 Diagnosing: ${dbFile}`);
  console.log('─'.repeat(60));

  const dbPath = path.join(DATABASES_DIR, dbFile);

  if (!fs.existsSync(dbPath)) {
    console.log(`❌ File not found: ${dbPath}`);
    return;
  }

  const stats = fs.statSync(dbPath);
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Last modified: ${stats.mtime.toLocaleString()}`);

  try {
    const db = new Database(dbPath, { readonly: true });

    // Get all tables
    const tablesQuery = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);
    const tables = tablesQuery.all();

    if (tables.length === 0) {
      console.log(`\n❌ No tables found in database!`);
      db.close();
      return;
    }

    console.log(`\n✓ Found ${tables.length} tables:`);

    const results = {
      complete: true,
      tables: {}
    };

    tables.forEach((table) => {
      const tableName = table.name;
      const countQuery = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`);
      const countResult = countQuery.get();
      const count = countResult.count;

      console.log(`  • ${tableName} (${count} rows)`);

      // Get column info
      const columnQuery = db.prepare(`PRAGMA table_info(${tableName})`);
      const columns = columnQuery.all();

      console.log(`    Columns: ${columns.map(c => c.name).join(', ')}`);

      results.tables[tableName] = {
        rowCount: count,
        columns: columns.map(c => c.name)
      };

      // Show sample data
      if (count > 0) {
        const sampleQuery = db.prepare(`SELECT * FROM ${tableName} LIMIT 1`);
        const sample = sampleQuery.get();
        console.log(`    Sample: ${JSON.stringify(sample).substring(0, 100)}...`);
      }
    });

    // Check if all expected tables exist
    console.log(`\n📋 Expected Tables Check:`);
    EXPECTED_TABLES.forEach((expectedTable) => {
      const exists = tables.some(t => t.name === expectedTable);
      const status = exists ? '✓' : '❌';
      console.log(`  ${status} ${expectedTable}`);
      if (!exists) {
        results.complete = false;
      }
    });

    // Overall status
    console.log(`\n${results.complete ? '✅' : '⚠️ '} Database Status:`);
    if (results.complete) {
      console.log('  All required tables found!');
      console.log('  The database should work with the app.');
    } else {
      console.log('  Missing some required tables.');
      console.log('  Tables needed:');
      EXPECTED_TABLES.forEach(table => {
        const missing = !tables.some(t => t.name === table);
        if (missing) {
          console.log(`    • ${table}`);
        }
      });
    }

    db.close();
  } catch (error) {
    console.log(`\n❌ Error reading database: ${error.message}`);
    console.log('\nThis might mean:');
    console.log('  • The file is not a valid SQLite database');
    console.log('  • The file is corrupted');
    console.log('  • The file is encrypted or has a password');
  }
}

// Main
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║            iClassifier Database Diagnostic                ║');
console.log('╚════════════════════════════════════════════════════════════╝');

console.log(`\nChecking databases in: ${DATABASES_DIR}\n`);

const files = fs.readdirSync(DATABASES_DIR).filter(f => f.endsWith('.db'));

if (files.length === 0) {
  console.log('❌ No database files found!');
  console.log(`   Expected location: ${DATABASES_DIR}`);
  process.exit(1);
}

console.log(`Found ${files.length} database file(s)\n`);

files.forEach(file => {
  diagnoseDatabase(file);
});

console.log('\n' + '═'.repeat(60));
console.log('Diagnostic complete!');
console.log('═'.repeat(60) + '\n');
