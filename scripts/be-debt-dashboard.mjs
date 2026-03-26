import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const ROOTS = [path.resolve(REPO_ROOT, 'internal'), path.resolve(REPO_ROOT, 'cmd'), path.resolve(REPO_ROOT, 'main.go')];

const SOURCE_EXT = new Set(['.go']);
const EVENT_CONSTANTS_FILE = path.resolve(REPO_ROOT, 'internal', 'constant', 'events.go');
const ALLOWED_RUNTIME_FILES = new Set([
  path.resolve(REPO_ROOT, 'internal', 'app', 'app.go'),
  path.resolve(REPO_ROOT, 'internal', 'app', 'connection_service.go'),
  path.resolve(REPO_ROOT, 'internal', 'app', 'event_emitter.go'),
  path.resolve(REPO_ROOT, 'internal', 'app', 'helpers.go'),
]);

const APP_WHITELIST_FOR_DYNAMIC_TYPES = new Set([
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
  const files = [];
  const stat = statSync(target);
  if (stat.isFile()) {
    if (path.extname(target) === '.go') {
      files.push(target);
    }
    return files;
  }
  for (const entry of readdirSync(target)) {
    const full = path.join(target, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      files.push(...walkFiles(full));
      continue;
    }
    if (SOURCE_EXT.has(path.extname(full))) {
      files.push(full);
    }
  }
  return files;
}

function isTestFile(filePath) {
  return filePath.endsWith('_test.go');
}

function countMatches(content, regex) {
  return [...content.matchAll(regex)].length;
}

const files = ROOTS.flatMap(walkFiles);
let appDynamicMapAny = 0;
let appDynamicInterface = 0;
let hardcodedEventsOutsideConstants = 0;
let runtimeCallsOutsideAllowedFiles = 0;
let largeGoFilesOver500Lines = 0;

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n').length;
  const inApp = file.includes(`${path.sep}internal${path.sep}app${path.sep}`);
  const prodFile = !isTestFile(file);

  if (lines > 500 && prodFile) {
    largeGoFilesOver500Lines += 1;
  }

  if (inApp && prodFile && !APP_WHITELIST_FOR_DYNAMIC_TYPES.has(file)) {
    appDynamicMapAny += countMatches(content, /\bmap\[string\](any|interface\{\})\b/g);
    appDynamicInterface += countMatches(content, /\binterface\{\}\b/g);
  }

  if (prodFile && file !== EVENT_CONSTANTS_FILE) {
    for (const name of EVENT_LITERALS) {
      hardcodedEventsOutsideConstants += countMatches(content, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
    }
  }

  if (prodFile && !ALLOWED_RUNTIME_FILES.has(file)) {
    runtimeCallsOutsideAllowedFiles += countMatches(content, /\bruntime\./g);
  }
}

const report = {
  appDynamicMapAny,
  appDynamicInterface,
  hardcodedEventsOutsideConstants,
  runtimeCallsOutsideAllowedFiles,
  largeGoFilesOver500Lines,
};

console.log('BE Debt Dashboard');
console.table(report);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
}
