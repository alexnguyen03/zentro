import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const ROOT = path.resolve(REPO_ROOT, 'frontend', 'src');
const SOURCE_EXT = new Set(['.ts', '.tsx', '.css']);

const LEGACY_TOKEN_NAMES = [
  '--bg-primary',
  '--bg-secondary',
  '--bg-tertiary',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--accent-color',
  '--accent-hover',
  '--border-color',
  '--error-color',
  '--success-color',
  '--warning-color',
];

function walkFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    if (SOURCE_EXT.has(path.extname(fullPath))) {
      files.push(fullPath);
    }
  }
  return files;
}

function countMatches(content, regex) {
  return [...content.matchAll(regex)].length;
}

function isTestFile(filePath) {
  return /\.(test|spec)\.(ts|tsx)$/.test(filePath);
}

function hasWailsImport(content) {
  return /from\s+['"][^'"]*wailsjs\/go\/app\/App['"]/.test(content);
}

function hasNativeDialog(content) {
  const explicitWindowCall = /window\.(confirm|prompt|alert)\s*\(/g;
  const bareCall = /(^|[^\w.])(confirm|prompt|alert)\s*\(/gm;
  return countMatches(content, explicitWindowCall) + countMatches(content, bareCall);
}

const files = walkFiles(ROOT);

let directWailsImportsOutsidePlatform = 0;
let nativeDialogsInProduction = 0;
let explicitAnyInProduction = 0;
let doubleUnknownCastsInProduction = 0;
let windowGoOutsidePlatform = 0;
let legacyTokenVarUsagesOutsideTokens = 0;
let hardcodedZIndexPatterns = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const content = readFileSync(file, 'utf8');
  const prodFile = !isTestFile(file);

  if (hasWailsImport(content) && !rel.startsWith('platform/')) {
    directWailsImportsOutsidePlatform += countMatches(content, /from\s+['"][^'"]*wailsjs\/go\/app\/App['"]/g);
  }

  if (prodFile) {
    nativeDialogsInProduction += hasNativeDialog(content);
    explicitAnyInProduction += countMatches(content, /\bas\s+any\b|:\s*any\b|<\s*any\s*>|\bany\[\]/g);
    doubleUnknownCastsInProduction += countMatches(content, /\bas\s+unknown\s+as\b/g);
  }

  if (!rel.startsWith('platform/')) {
    windowGoOutsidePlatform += countMatches(content, /\bwindow\.go\b/g);
  }

  if (rel !== 'styles/tokens.css') {
    for (const tokenName of LEGACY_TOKEN_NAMES) {
      legacyTokenVarUsagesOutsideTokens += countMatches(content, new RegExp(tokenName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
    }
  }

  hardcodedZIndexPatterns += countMatches(content, /z-\[[^\]]+\]|zIndex\s*:\s*['"]?-?\d+['"]?/g);
}

const report = {
  directWailsImportsOutsidePlatform,
  nativeDialogsInProduction,
  explicitAnyInProduction,
  doubleUnknownCastsInProduction,
  windowGoOutsidePlatform,
  legacyTokenVarUsagesOutsideTokens,
  hardcodedZIndexPatterns,
};

console.log('FE Debt Dashboard');
console.table(report);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
}
