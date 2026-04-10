import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeFeGuardrails, MIGRATION_DEADLINES } from './check-fe-guardrails-lib.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const SOURCE_ROOT = path.resolve(REPO_ROOT, 'frontend', 'src');

const { critical, migration, formatViolation } = analyzeFeGuardrails({
  repoRoot: REPO_ROOT,
  sourceRoot: SOURCE_ROOT,
});

if (migration.length > 0) {
  console.warn('FE guardrails migration warnings:');
  for (const violation of migration) {
    console.warn(formatViolation(violation));
  }
  const listedRules = new Set(migration.map((v) => v.rule));
  for (const [rule, deadline] of Object.entries(MIGRATION_DEADLINES)) {
    if (listedRules.has(rule)) {
      console.warn(`- [migration-deadline] ${rule} promotes to critical on ${deadline}`);
    }
  }
}

if (critical.length > 0) {
  console.error('FE guardrails failed:');
  for (const violation of critical) {
    console.error(formatViolation(violation));
  }
  process.exit(1);
}

console.log('FE guardrails passed.');
