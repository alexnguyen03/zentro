import { spawnSync } from 'node:child_process';

const result = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
    stdio: 'inherit',
    shell: false,
});

if (result.status !== 0) {
    process.exit(result.status ?? 1);
}

console.log('Configured git hooks path to .githooks');
