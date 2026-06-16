#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const PACKAGE_NAME = '@tomekkujawski/ai-toolkit';
const SENTINEL_BEGIN = `<!-- BEGIN ${PACKAGE_NAME} -->`;
const SENTINEL_END = `<!-- END ${PACKAGE_NAME} -->`;
const MANIFEST_FILENAME = '.ai-toolkit-manifest.json';

function removeInstalledFiles(projectRoot, files) {
  for (const relPath of files) {
    const fullPath = path.join(projectRoot, relPath);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { force: true });
    }

    // Remove parent directory if empty
    const dir = path.dirname(fullPath);
    if (fs.existsSync(dir)) {
      const remaining = fs.readdirSync(dir);
      if (remaining.length === 0) {
        fs.rmdirSync(dir);
      }
    }
  }
}

function removeSentinelBlock(projectRoot) {
  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
  if (!fs.existsSync(claudeMdPath)) return;

  let content = fs.readFileSync(claudeMdPath, 'utf8');

  const beginIdx = content.indexOf(SENTINEL_BEGIN);
  const endIdx = content.indexOf(SENTINEL_END);

  if (beginIdx === -1 || endIdx === -1 || endIdx <= beginIdx) return;

  content = content.slice(0, beginIdx) + content.slice(endIdx + SENTINEL_END.length);

  // Normalize excessive blank lines left behind
  content = content.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';

  fs.writeFileSync(claudeMdPath, content, 'utf8');
}

function main() {
  const projectRoot = process.env.PROJECT_ROOT || process.cwd();
  const manifestPath = path.join(projectRoot, '.claude', MANIFEST_FILENAME);

  if (!fs.existsSync(manifestPath)) {
    console.log(`[${PACKAGE_NAME}] No manifest found — nothing to uninstall.`);
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const files = manifest.files || [];

  removeInstalledFiles(projectRoot, files);
  removeSentinelBlock(projectRoot);

  fs.rmSync(manifestPath, { force: true });

  console.log(`[${PACKAGE_NAME}] Uninstalled ${files.length} file(s) from ${projectRoot}/.claude/`);
}

try {
  main();
} catch (err) {
  console.warn(`[${PACKAGE_NAME}] Uninstall warning: ${err.message}`);
}
