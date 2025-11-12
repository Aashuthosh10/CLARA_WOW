#!/usr/bin/env node

/**
 * Encoding Check Script
 * Checks all TypeScript/JavaScript files for BOM and invalid encodings
 * Exits with error code 1 if issues found
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
const UTF16_LE_BOM = Buffer.from([0xFF, 0xFE]);
const UTF16_BE_BOM = Buffer.from([0xFE, 0xFF]);

const extensions = ['.ts', '.tsx', '.js', '.jsx'];
const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next'];

function hasBOM(filePath) {
  const buffer = fs.readFileSync(filePath);
  return (
    buffer.slice(0, 3).equals(BOM) ||
    buffer.slice(0, 2).equals(UTF16_LE_BOM) ||
    buffer.slice(0, 2).equals(UTF16_BE_BOM)
  );
}

function fixFile(filePath) {
  console.log(`Fixing: ${filePath}`);
  // Read file as buffer to detect BOM
  const buffer = fs.readFileSync(filePath);
  let content;
  
  // Remove BOM if present
  if (buffer.slice(0, 3).equals(BOM)) {
    content = buffer.slice(3).toString('utf8');
  } else if (buffer.slice(0, 2).equals(UTF16_LE_BOM) || buffer.slice(0, 2).equals(UTF16_BE_BOM)) {
    // UTF-16 files need conversion
    content = buffer.slice(2).toString('utf16le');
  } else {
    content = buffer.toString('utf8');
  }
  
  // Write as UTF-8 without BOM
  fs.writeFileSync(filePath, content, { encoding: 'utf8', flag: 'w' });
}

function checkDirectory(dir, issues = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!ignoreDirs.includes(entry.name)) {
        checkDirectory(fullPath, issues);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (extensions.includes(ext)) {
        if (hasBOM(fullPath)) {
          issues.push(fullPath);
        }
      }
    }
  }

  return issues;
}

function main() {
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');
  const rootDir = process.cwd();

  console.log('Checking for encoding issues...\n');

  const issues = checkDirectory(rootDir);

  if (issues.length > 0) {
    console.error(`\n❌ Found ${issues.length} file(s) with encoding issues:\n`);
    issues.forEach(file => console.error(`  - ${file}`));

    if (fix) {
      console.log('\n🔧 Fixing files...\n');
      issues.forEach(fixFile);
      console.log(`\n✅ Fixed ${issues.length} file(s)\n`);
      return 0;
    } else {
      console.error('\n💡 Run with --fix to automatically fix these files');
      console.error('   Example: node scripts/check-encoding.js --fix\n');
      return 1;
    }
  } else {
    console.log('✅ No encoding issues found!\n');
    return 0;
  }
}

process.exit(main());

