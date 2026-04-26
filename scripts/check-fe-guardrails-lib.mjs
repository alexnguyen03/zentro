import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SOURCE_EXT = new Set(['.ts', '.tsx', '.css']);
const SOURCE_EXT_GUARDRAIL = new Set(['.ts', '.tsx']);

export const NATIVE_CONTROL_ALLOWLIST = [
  'components/ui/input.tsx',
  'components/ui/textarea.tsx',
  'components/layout/OverlayDialog.test.tsx',
];

export const COMPACT_SPACING_PX = new Set([0, 4, 8, 12, 16, 20, 24, 32, 40]);
export const MIGRATION_DEADLINES = {
  'no-inline-px-spacing-or-typography': '2026-06-30',
  'interactive-requires-focus-visible': '2026-06-30',
  'compact-spacing-scale-only': '2026-06-30',
};
const STRICT_SCOPE_PATHS = [
  /^components\/layout\/SettingsView\.tsx$/,
  /^components\/layout\/settings\//,
  /^components\/layout\/Toolbar\.tsx$/,
];
const STRICT_SCOPE_RULES = new Set([
  'no-inline-px-spacing-or-typography',
  'interactive-requires-focus-visible',
]);
const SHARED_PRIMITIVE_FILENAMES = new Set([
  'Button.tsx',
  'Input.tsx',
  'select.tsx',
  'switch.tsx',
  'textarea.tsx',
]);

function walkFiles(dir, extensions) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkFiles(fullPath, extensions));
      continue;
    }
    if (extensions.has(path.extname(fullPath))) {
      files.push(fullPath);
    }
  }
  return files;
}

export function walkFrontendFiles(rootDir) {
  return walkFiles(rootDir, SOURCE_EXT);
}

export function walkGuardrailSourceFiles(rootDir) {
  return walkFiles(rootDir, SOURCE_EXT_GUARDRAIL);
}

export function isTestFile(filePath) {
  return /\.(test|spec)\.(ts|tsx)$/.test(filePath);
}

function collectLineViolations(filePath, content, regex, label, severity = 'critical') {
  const lines = content.split('\n');
  const violations = [];
  lines.forEach((line, index) => {
    if (regex.test(line)) {
      violations.push({
        severity,
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

function findPxValues(line) {
  const matches = line.matchAll(/(-?\d+(?:\.\d+)?)px/g);
  const values = [];
  for (const match of matches) {
    values.push(Number.parseFloat(match[1]));
  }
  return values;
}

function collectSpacingScaleViolations(filePath, content) {
  const violations = [];
  const lines = content.split('\n');
  const cssSpacingProperty = /^\s*(padding|padding-top|padding-right|padding-bottom|padding-left|margin|margin-top|margin-right|margin-bottom|margin-left|gap|column-gap|row-gap|inset|top|right|bottom|left)\s*:\s*[^;]+;/;
  lines.forEach((line, index) => {
    if (!cssSpacingProperty.test(line)) return;
    const values = findPxValues(line);
    if (values.length === 0) return;
    const invalid = values.filter((value) => !COMPACT_SPACING_PX.has(Math.abs(value)));
    if (invalid.length > 0) {
      violations.push({
        severity: 'migration',
        rule: 'compact-spacing-scale-only',
        file: filePath,
        line: index + 1,
        snippet: line.trim(),
      });
    }
  });
  return violations;
}

function collectInlineTypographySpacingViolations(filePath, content) {
  return collectLineViolations(
    filePath,
    content,
    /(padding|margin|gap|fontSize|lineHeight)\s*:\s*['"]?\d+(?:\.\d+)?(px|rem)['"]?/,
    'no-inline-px-spacing-or-typography',
    'migration',
  );
}

function collectMissingFocusVisibleViolations(filePath, content) {
  const violations = [];
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    const hasInteractiveElement = /<(button|a)\b|role=['"]button['"]/.test(line);
    if (!hasInteractiveElement) return;
    const hasClassName = /className\s*=/.test(line);
    if (!hasClassName) return;
    const hasFocusVisible = /focus-visible:|ui-focus-ring/.test(line);
    if (hasFocusVisible) return;
    violations.push({
      severity: 'migration',
      rule: 'interactive-requires-focus-visible',
      file: filePath,
      line: index + 1,
      snippet: line.trim(),
    });
  });
  return violations;
}

function isNativeControlAllowed(relPath) {
  return NATIVE_CONTROL_ALLOWLIST.includes(relPath);
}

export function analyzeFeGuardrails({ repoRoot, sourceRoot }) {
  const files = walkGuardrailSourceFiles(sourceRoot);
  const critical = [];
  const migration = [];

  for (const file of files) {
    const rel = path.relative(sourceRoot, file).replace(/\\/g, '/');
    const content = readFileSync(file, 'utf8');
    const prodFile = !isTestFile(file);
    const fileName = path.basename(file);

    if (!rel.startsWith('components/ui/') && SHARED_PRIMITIVE_FILENAMES.has(fileName)) {
      critical.push({
        severity: 'critical',
        rule: 'no-shared-primitive-forks',
        file,
        line: 1,
        snippet: rel,
      });
    }

    if (!rel.startsWith('platform/')) {
      critical.push(
        ...collectLineViolations(
          file,
          content,
          /from\s+['"][^'"]*wailsjs\/go\/app\/App['"]/,
          'no-direct-wails-import-outside-platform',
        ),
      );
    }

    if (prodFile) {
      critical.push(
        ...collectLineViolations(file, content, /window\.(confirm|prompt|alert)\s*\(/, 'no-native-dialogs'),
        ...collectLineViolations(file, content, /(^|[^\w.])(confirm|prompt|alert)\s*\(/, 'no-native-dialogs'),
        ...collectLineViolations(file, content, /\bas\s+unknown\s+as\b/, 'no-double-unknown-cast'),
        ...collectLineViolations(file, content, /\bfunction\s+toErrorMessage\s*\(/, 'use-shared-error-helper'),
        ...collectLineViolations(
          file,
          content,
          /variant\s*=\s*["'](primary|solid|danger|success)["']/,
          'no-legacy-button-variants',
        ),
        ...collectLineViolations(file, content, /\bdanger\s*=\s*\{?/, 'no-legacy-button-danger-prop'),
        ...collectLineViolations(
          file,
          content,
          /import\s+\{[^}]*\b(ModalBackdrop|ModalFrame|AlertModal|PromptModal)\b[^}]*\}\s+from\s+['"][^'"]*\/ui(?:['"]|\/)/,
          'no-legacy-ui-components',
        ),
        ...collectLineViolations(
          file,
          content,
          /from\s+['"][^'"]*\/ui\/(ModalBackdrop|ModalFrame|AlertModal|PromptModal)['"]/,
          'no-legacy-ui-components',
        ),
        ...collectLineViolations(
          file,
          content,
          /<\s*(ModalBackdrop|ModalFrame|AlertModal|PromptModal)\b/,
          'no-legacy-ui-components',
        ),
        ...collectLineViolations(
          file,
          content,
          /<\s*SwitchField\b[^>]*\bonChange\s*=/,
          'switchfield-use-oncheckedchange',
        ),
        ...collectLineViolations(
          file,
          content,
          /variant\s*=\s*["'](danger|primary)["']/,
          'no-legacy-confirmation-variants',
        ),
        ...collectLineViolations(
          file,
          content,
          /from\s+['"][^'"]*\/ui\/(BaseTable|DatabaseTreePicker)['"]/,
          'no-domain-components-inside-ui',
        ),
        ...collectLineViolations(
          file,
          content,
          /import\s+\{[^}]*\b(BaseTable|DatabaseTreePicker)\b[^}]*\}\s+from\s+['"][^'"]*\/ui['"]/,
          'no-domain-components-inside-ui',
        ),
        ...collectLineViolations(
          file,
          content,
          /from\s+['"][^'"]*\/ui\/(FormField|SelectField|SwitchField|SearchField|Divider)['"]/,
          'no-legacy-form-wrappers',
        ),
        ...collectLineViolations(
          file,
          content,
          /import\s+\{[^}]*\b(FormField|SelectField|SwitchField|SearchField|Divider)\b[^}]*\}\s+from\s+['"][^'"]*\/ui['"]/,
          'no-legacy-form-wrappers',
        ),
        ...collectLineViolations(
          file,
          content,
          /<\s*(FormField|SelectField|SwitchField|SearchField|Divider)\b/,
          'no-legacy-form-wrappers',
        ),
        ...collectLineViolations(
          file,
          content,
          /<\s*Tooltip\b[^>]*\bcontent\s*=/,
          'no-legacy-tooltip-content-prop',
        ),
        ...collectLineViolations(
          file,
          content,
          /from\s+['"][^'"]*\/layout\/(Modal|OverlayDialog)['"]/,
          'no-legacy-layout-dialog-wrappers',
        ),
        ...collectLineViolations(
          file,
          content,
          /from\s+['"]\.(\.\/|\/)?(Modal|OverlayDialog)['"]/,
          'no-legacy-layout-dialog-wrappers',
        ),
      );

      if (!isNativeControlAllowed(rel)) {
        critical.push(
          ...collectLineViolations(file, content, /<(button|input|textarea)\b/, 'no-native-controls-outside-allowlist'),
        );
      }

      migration.push(...collectInlineTypographySpacingViolations(file, content));
    }

    if (rel === 'components/sidebar/Sidebar.tsx' || rel === 'components/sidebar/SecondarySidebar.tsx') {
      critical.push(
        ...collectLineViolations(file, content, /\buseState<SidebarTab>\b/, 'sidebar-shell-registry-only'),
        ...collectLineViolations(file, content, /\bconst\s+tabs\s*=\s*\[/, 'sidebar-shell-registry-only'),
      );
    }

    if (!rel.startsWith('components/ui/')) {
      critical.push(
        ...collectLineViolations(
          file,
          content,
          /from\s+['"]@radix-ui\//,
          'no-radix-import-outside-ui',
        ),
      );
    }

    if (!rel.startsWith('platform/')) {
      critical.push(
        ...collectLineViolations(file, content, /\bwindow\.go\b/, 'no-window-go-outside-platform'),
      );
    }

    migration.push(...collectMissingFocusVisibleViolations(file, content));
  }

  const cssFiles = walkFrontendFiles(sourceRoot).filter((file) => path.extname(file) === '.css');
  for (const cssFile of cssFiles) {
    const content = readFileSync(cssFile, 'utf8');
    migration.push(...collectSpacingScaleViolations(cssFile, content));
  }

  const formatViolation = (violation) => {
    const displayPath = path.relative(repoRoot, violation.file).replace(/\\/g, '/');
    return `- [${violation.rule}] ${displayPath}:${violation.line} -> ${violation.snippet}`;
  };

  const today = new Date().toISOString().slice(0, 10);
  const promoteMigrationViolation = (violation) => ({
    ...violation,
    severity: 'critical',
    rule: `${violation.rule}::migration-deadline`,
  });
  const shouldApplyStrictScope = (filePath) => {
    const rel = path.relative(sourceRoot, filePath).replace(/\\/g, '/');
    return STRICT_SCOPE_PATHS.some((pattern) => pattern.test(rel));
  };

  const stillMigration = [];
  for (const violation of migration) {
    const deadline = MIGRATION_DEADLINES[violation.rule];
    const deadlineExceeded = Boolean(deadline && today >= deadline);
    const strictScopePromote = STRICT_SCOPE_RULES.has(violation.rule) && shouldApplyStrictScope(violation.file);
    if (deadlineExceeded || strictScopePromote) {
      critical.push(promoteMigrationViolation(violation));
      continue;
    }
    stillMigration.push(violation);
  }

  return {
    critical,
    migration: stillMigration,
    formatViolation,
  };
}
