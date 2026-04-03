import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const ROOT = path.resolve(REPO_ROOT, 'frontend', 'src');
const SOURCE_EXT = new Set(['.ts', '.tsx']);

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

function isTestFile(filePath) {
  return /\.(test|spec)\.(ts|tsx)$/.test(filePath);
}

function collectViolations(filePath, regex, label) {
  const lines = readFileSync(filePath, 'utf8').split('\n');
  const violations = [];
  lines.forEach((line, index) => {
    if (regex.test(line)) {
      violations.push({
        rule: label,
        file: filePath,
        line: index + 1,
        snippet: line.trim(),
      });
    }
    regex.lastIndex = 0;
  });
  return violations;
}

const files = walkFiles(ROOT);
const violations = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const prodFile = !isTestFile(file);

  if (!rel.startsWith('platform/')) {
    violations.push(
      ...collectViolations(
        file,
        /from\s+['"][^'"]*wailsjs\/go\/app\/App['"]/,
        'no-direct-wails-import-outside-platform',
      ),
    );
  }

  if (prodFile) {
    violations.push(
      ...collectViolations(file, /window\.(confirm|prompt|alert)\s*\(/, 'no-native-dialogs'),
      ...collectViolations(file, /(^|[^\w.])(confirm|prompt|alert)\s*\(/, 'no-native-dialogs'),
      ...collectViolations(file, /\bas\s+unknown\s+as\b/, 'no-double-unknown-cast'),
      ...collectViolations(file, /\bfunction\s+toErrorMessage\s*\(/, 'use-shared-error-helper'),
      ...collectViolations(
        file,
        /variant\s*=\s*["'](primary|solid|danger|success)["']/,
        'no-legacy-button-variants',
      ),
      ...collectViolations(file, /\bdanger\s*=\s*\{?/, 'no-legacy-button-danger-prop'),
      ...collectViolations(
        file,
        /import\s+\{[^}]*\b(ModalBackdrop|ModalFrame|AlertModal|PromptModal)\b[^}]*\}\s+from\s+['"][^'"]*\/ui(?:['"]|\/)/,
        'no-legacy-ui-components',
      ),
      ...collectViolations(
        file,
        /from\s+['"][^'"]*\/ui\/(ModalBackdrop|ModalFrame|AlertModal|PromptModal)['"]/,
        'no-legacy-ui-components',
      ),
      ...collectViolations(
        file,
        /<\s*(ModalBackdrop|ModalFrame|AlertModal|PromptModal)\b/,
        'no-legacy-ui-components',
      ),
    );
  }

  if (!rel.startsWith('platform/')) {
    violations.push(
      ...collectViolations(file, /\bwindow\.go\b/, 'no-window-go-outside-platform'),
    );
  }
}

if (violations.length > 0) {
  console.error('FE guardrails failed:');
  for (const violation of violations) {
    const displayPath = path.relative(REPO_ROOT, violation.file).replace(/\\/g, '/');
    console.error(
      `- [${violation.rule}] ${displayPath}:${violation.line} -> ${violation.snippet}`,
    );
  }
  process.exit(1);
}

console.log('FE guardrails passed.');
