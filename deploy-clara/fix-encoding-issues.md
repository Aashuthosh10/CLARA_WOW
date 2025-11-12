# Permanent Fix for Encoding/BOM Issues

## Problem
Files are being saved with UTF-16 BOM or other encodings that cause "Unexpected character" errors in Vite/Babel.

## Root Cause
- Files edited in certain editors (especially on Windows) get saved with BOM
- OneDrive sync can sometimes corrupt file encodings
- Copy-paste operations can introduce invisible characters

## Permanent Solution Plan

### Step 1: Fix Current Affected Files
- Detect and fix all files with BOM/invalid encoding
- Convert to UTF-8 without BOM

### Step 2: Add Editor Configuration
- Create `.editorconfig` to enforce UTF-8 encoding
- Add VSCode settings to prevent BOM

### Step 3: Add Build-Time Validation
- Create script to check for BOM before build
- Add to package.json scripts

### Step 4: Add Pre-commit Hook (Optional)
- Git hook to check encoding before commit

## Implementation

### Files to Fix Immediately
1. `apps/staff/components/VideoCallView.tsx` - Has BOM
2. Check all `.tsx`, `.ts`, `.jsx`, `.js` files in project

### Prevention
1. `.editorconfig` - Enforce UTF-8
2. `.vscode/settings.json` - Editor settings
3. `scripts/check-encoding.js` - Build-time check
4. Update `package.json` - Add encoding check script

