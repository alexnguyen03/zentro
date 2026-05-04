import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const frontendDir = resolve(repoRoot, 'frontend');

function runStep(label, command, args, options = {}) {
    console.log(`\n==> ${label}`);
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        stdio: 'inherit',
        shell: false,
        ...options,
    });

    if (result.error) {
        console.error(result.error);
        process.exit(1);
    }

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function runNpmStep(label, scriptName, cwd) {
    if (process.platform === 'win32') {
        runStep(label, 'cmd.exe', ['/d', '/s', '/c', `npm run ${scriptName}`], { cwd });
        return;
    }

    runStep(label, 'npm', ['run', scriptName], { cwd });
}

function ensureEmbeddedFrontendStub() {
    const distDir = resolve(frontendDir, 'dist');
    const indexFile = resolve(distDir, 'index.html');
    if (existsSync(indexFile)) return;
    mkdirSync(distDir, { recursive: true });
    writeFileSync(indexFile, '<!doctype html><html><body></body></html>\n', 'utf8');
}

ensureEmbeddedFrontendStub();

runStep('Backend guardrails', 'node', ['scripts/check-be-guardrails.mjs']);
runStep('Backend debt dashboard', 'node', ['scripts/be-debt-dashboard.mjs']);
runStep('Go vet', 'go', ['vet', './...']);
runStep('Backend tests', 'go', ['test', './...']);
runNpmStep('Frontend guardrails', 'check:guardrails', frontendDir);
runStep('Feature boundaries', 'node', ['scripts/check-feature-boundaries.mjs']);
runNpmStep('Frontend design-system contract', 'check:design-system-contract', frontendDir);
runNpmStep('Frontend debt dashboard', 'check:debt', frontendDir);
runNpmStep('Wails models presence', 'check:wails-models', frontendDir);
runNpmStep('Frontend build', 'build', frontendDir);
runNpmStep('Frontend tests', 'test', frontendDir);

console.log('\nAll pre-push checks passed.');
