import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const ROOTS = [path.resolve(REPO_ROOT, 'internal'), path.resolve(REPO_ROOT, 'cmd'), path.resolve(REPO_ROOT, 'main.go')];

const EVENT_CONSTANTS_FILE = path.resolve(REPO_ROOT, 'internal', 'constant', 'events.go');
const ALLOWED_RUNTIME_FILES = new Set([
  path.resolve(REPO_ROOT, 'internal', 'app', 'app.go'),
  path.resolve(REPO_ROOT, 'internal', 'app', 'connection_service.go'),
  path.resolve(REPO_ROOT, 'internal', 'app', 'event_emitter.go'),
  path.resolve(REPO_ROOT, 'internal', 'app', 'helpers.go'),
]);
const APP_DYNAMIC_WHITELIST = new Set([
  path.resolve(REPO_ROOT, 'internal', 'app', 'event_emitter.go'),
  path.resolve(REPO_ROOT, 'internal', 'app', 'helpers.go'),
  path.resolve(REPO_ROOT, 'internal', 'app', 'query_service.go'),
]);

const EVENT_LITERALS = [
  'connection:changed',
  'query:started',
  'query:chunk',
  'query:done',
  'transaction:status',
  'schema:databases',
  'schema:error',
  'schema:loaded',
  'app:before-close',
];

function walkFiles(target) {
  const stat = statSync(target);
  if (stat.isFile()) {
    return path.extname(target) === '.go' ? [target] : [];
  }
  const files = [];
  for (const entry of readdirSync(target)) {
    const full = path.join(target, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      files.push(...walkFiles(full));
      continue;
    }
    if (path.extname(full) === '.go') {
      files.push(full);
    }
  }
  return files;
}

function isTestFile(filePath) {
  return filePath.endsWith('_test.go');
}

function collectLineViolations(filePath, regex, rule) {
  const lines = readFileSync(filePath, 'utf8').split('\n');
  const violations = [];
  lines.forEach((line, index) => {
    if (regex.test(line)) {
      violations.push({
        rule,
        file: filePath,
        line: index + 1,
        snippet: line.trim(),
      });
    }
    regex.lastIndex = 0;
  });
  return violations;
}

const files = ROOTS.flatMap(walkFiles);
const violations = [];

for (const file of files) {
  const inApp = file.includes(`${path.sep}internal${path.sep}app${path.sep}`);
  const prodFile = !isTestFile(file);

  if (inApp && prodFile && !APP_DYNAMIC_WHITELIST.has(file)) {
    violations.push(
      ...collectLineViolations(file, /\bmap\[string\](any|interface\{\})\b/, 'no-dynamic-map-in-app-core'),
      ...collectLineViolations(file, /\binterface\{\}\b/, 'no-interface-empty-in-app-core'),
    );
  }

  if (file !== EVENT_CONSTANTS_FILE && prodFile) {
    for (const eventName of EVENT_LITERALS) {
      violations.push(
        ...collectLineViolations(
          file,
          new RegExp(eventName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
          'no-hardcoded-event-literal-outside-constants',
        ),
      );
    }
  }

  if (prodFile && !ALLOWED_RUNTIME_FILES.has(file)) {
    violations.push(
      ...collectLineViolations(file, /\bruntime\./, 'runtime-calls-outside-managed-context-files'),
    );
  }
}

if (violations.length > 0) {
  console.error('BE guardrails failed:');
  for (const violation of violations) {
    const displayPath = path.relative(REPO_ROOT, violation.file).replace(/\\/g, '/');
    console.error(`- [${violation.rule}] ${displayPath}:${violation.line} -> ${violation.snippet}`);
  }
  process.exit(1);
}

console.log('BE guardrails passed.');
