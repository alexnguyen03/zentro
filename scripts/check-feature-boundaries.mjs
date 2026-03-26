import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const FEATURE_ROOT = path.resolve(REPO_ROOT, 'frontend', 'src', 'features');
const EXTS = new Set(['.ts', '.tsx']);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (EXTS.has(path.extname(full))) out.push(full);
  }
  return out;
}

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

const featureDirs = readdirSync(FEATURE_ROOT)
  .map((name) => path.resolve(FEATURE_ROOT, name))
  .filter((full) => statSync(full).isDirectory());

const violations = [];

for (const featurePath of featureDirs) {
  const featureName = path.basename(featurePath);
  const files = walk(featurePath);
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const relFile = toPosix(path.relative(REPO_ROOT, file));
    const matches = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
    for (const match of matches) {
      const rawImport = match[1];
      if (!rawImport.startsWith('../') && !rawImport.startsWith('./')) continue;
      const normalized = toPosix(path.normalize(rawImport));
      if (!normalized.includes('features/')) continue;
      const targetFeatureMatch = normalized.match(/features\/([^/]+)/);
      const targetFeature = targetFeatureMatch?.[1];
      if (!targetFeature || targetFeature === featureName) continue;
      violations.push({
        file: relFile,
        importPath: rawImport,
        reason: `cross-feature relative import (${featureName} -> ${targetFeature})`,
      });
    }
  }
}

if (violations.length > 0) {
  console.error('Feature boundary check failed:');
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.importPath} (${violation.reason})`);
  }
  process.exit(1);
}

console.log('Feature boundary check passed.');

