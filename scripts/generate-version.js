const { execSync } = require('child_process');
const { mkdirSync, readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const rootDir = join(__dirname, '..');
const packageJsonPath = join(rootDir, 'package.json');
const outputDir = join(rootDir, 'app', 'generated');
const outputPath = join(outputDir, 'version.ts');

function readPackageVersion() {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version || '0.0.0';
}

function runGitCommand(command) {
  try {
    return execSync(command, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

const appVersion = readPackageVersion();
const commit = runGitCommand('git rev-parse --short HEAD') || 'unknown';
const branch = runGitCommand('git rev-parse --abbrev-ref HEAD') || 'unknown';
const statusOutput = runGitCommand('git status --porcelain') || '';
const dirty = statusOutput.length > 0;
const buildDate = new Date().toISOString();

const versionInfo = {
  appVersion,
  commit,
  branch,
  dirty,
  buildDate,
};

function toSingleQuotedLiteral(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  outputPath,
  [
    'export const versionInfo = Object.freeze({',
    `  appVersion: ${toSingleQuotedLiteral(versionInfo.appVersion)},`,
    `  commit: ${toSingleQuotedLiteral(versionInfo.commit)},`,
    `  branch: ${toSingleQuotedLiteral(versionInfo.branch)},`,
    `  dirty: ${versionInfo.dirty},`,
    `  buildDate: ${toSingleQuotedLiteral(versionInfo.buildDate)},`,
    '});',
    '',
    'export default versionInfo;',
    '',
  ].join('\n'),
  'utf8',
);

console.log(`Generated version metadata at ${outputPath}`);
