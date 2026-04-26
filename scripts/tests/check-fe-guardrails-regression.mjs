import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { analyzeFeGuardrails } from '../check-fe-guardrails-lib.mjs';

function setupRepo(files) {
  const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'zentro-guardrails-'));
  const srcRoot = path.join(repoRoot, 'frontend', 'src');
  mkdirSync(srcRoot, { recursive: true });
  for (const [relPath, content] of Object.entries(files)) {
    const target = path.join(srcRoot, relPath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return { repoRoot, srcRoot };
}

function run() {
  {
    const { repoRoot, srcRoot } = setupRepo({
      'components/layout/Foo.tsx': `
        export function Foo() {
          return <div style={{ gap: '10px', fontSize: '15px' }}>X</div>;
        }
      `,
    });
    const result = analyzeFeGuardrails({ repoRoot, sourceRoot: srcRoot });
    assert.ok(result.migration.some((v) => v.rule === 'no-inline-px-spacing-or-typography'));
  }

  {
    const { repoRoot, srcRoot } = setupRepo({
      'components/ui/Input.tsx': `
        export function Input() {
          return <input className="focus-visible:ring-2" />;
        }
      `,
    });
    const result = analyzeFeGuardrails({ repoRoot, sourceRoot: srcRoot });
    assert.equal(
      result.critical.some((v) => v.rule === 'no-native-controls-outside-allowlist'),
      false,
    );
  }

  {
    const { repoRoot, srcRoot } = setupRepo({
      'components/feature/Bar.tsx': `
        export function Bar() {
          return <button className="hover:bg-muted">Open</button>;
        }
      `,
      'styles/bar.css': `
        .bar {
          padding: 10px;
        }
      `,
    });
    const result = analyzeFeGuardrails({ repoRoot, sourceRoot: srcRoot });
    assert.ok(result.migration.some((v) => v.rule === 'interactive-requires-focus-visible'));
    assert.ok(result.migration.some((v) => v.rule === 'compact-spacing-scale-only'));
  }

  {
    const { repoRoot, srcRoot } = setupRepo({
      'components/layout/Toolbar.tsx': `
        export function Toolbar() {
          return <button className="hover:bg-muted">Open</button>;
        }
      `,
    });
    const result = analyzeFeGuardrails({ repoRoot, sourceRoot: srcRoot });
    assert.ok(result.critical.some((v) => v.rule === 'interactive-requires-focus-visible::migration-deadline'));
  }

  {
    const { repoRoot, srcRoot } = setupRepo({
      'components/layout/Button.tsx': `
        export function Button() {
          return <div>bad fork</div>;
        }
      `,
    });
    const result = analyzeFeGuardrails({ repoRoot, sourceRoot: srcRoot });
    assert.ok(result.critical.some((v) => v.rule === 'no-shared-primitive-forks'));
  }

  console.log('Guardrail regression tests passed.');
}

try {
  run();
} catch (error) {
  console.error('Guardrail regression tests failed.');
  console.error(error);
  process.exit(1);
}
