#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const PACKAGE_NAME = '@tomekkujawski/ai-toolkit';
const PACKAGE_VERSION = '0.1.0';
const SENTINEL_BEGIN = `<!-- BEGIN ${PACKAGE_NAME} -->`;
const SENTINEL_END = `<!-- END ${PACKAGE_NAME} -->`;
const MANIFEST_FILENAME = '.ai-toolkit-manifest.json';

function findProjectRoot() {
  if (process.env.PROJECT_ROOT) {
    return process.env.PROJECT_ROOT;
  }

  // Walk up from cwd looking for a directory that has node_modules/
  let dir = process.cwd();
  const { root } = path.parse(dir);

  while (dir !== root) {
    if (fs.existsSync(path.join(dir, 'node_modules'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return process.cwd();
}

function copySkills(packageRoot, projectRoot, installedFiles) {
  const skillsSrc = path.join(packageRoot, 'skills');
  const skillsDst = path.join(projectRoot, '.claude', 'skills');

  if (!fs.existsSync(skillsSrc)) return;

  const skillDirs = fs.readdirSync(skillsSrc, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const skillDir of skillDirs) {
    const src = path.join(skillsSrc, skillDir);
    const dst = path.join(skillsDst, skillDir);

    if (fs.existsSync(dst)) {
      fs.rmSync(dst, { recursive: true, force: true });
    }
    fs.mkdirSync(dst, { recursive: true });

    const files = fs.readdirSync(src);
    for (const file of files) {
      const srcFile = path.join(src, file);
      const dstFile = path.join(dst, file);
      fs.copyFileSync(srcFile, dstFile);
      installedFiles.push(path.relative(projectRoot, dstFile));
    }
  }
}

function injectRules(packageRoot, projectRoot) {
  const rulesPath = path.join(packageRoot, 'rules', 'CLAUDE.md');
  if (!fs.existsSync(rulesPath)) return;

  const rulesContent = fs.readFileSync(rulesPath, 'utf8');
  const block = `${SENTINEL_BEGIN}\n${rulesContent}\n${SENTINEL_END}`;

  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');

  if (!fs.existsSync(claudeMdPath)) {
    fs.writeFileSync(claudeMdPath, block + '\n', 'utf8');
    return;
  }

  let existing = fs.readFileSync(claudeMdPath, 'utf8');

  const beginIdx = existing.indexOf(SENTINEL_BEGIN);
  const endIdx = existing.indexOf(SENTINEL_END);

  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    existing = existing.slice(0, beginIdx) + block + existing.slice(endIdx + SENTINEL_END.length);
  } else {
    const separator = existing.endsWith('\n') ? '\n' : '\n\n';
    existing = existing + separator + block + '\n';
  }

  fs.writeFileSync(claudeMdPath, existing, 'utf8');
}

function writeManifest(projectRoot, installedFiles) {
  const manifestDir = path.join(projectRoot, '.claude');
  fs.mkdirSync(manifestDir, { recursive: true });

  const manifest = {
    package: PACKAGE_NAME,
    version: PACKAGE_VERSION,
    installedAt: new Date().toISOString(),
    files: installedFiles,
  };

  const manifestPath = path.join(manifestDir, MANIFEST_FILENAME);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

function main() {
  const packageRoot = path.join(__dirname);
  const projectRoot = findProjectRoot();

  const installedFiles = [];

  copySkills(packageRoot, projectRoot, installedFiles);
  injectRules(packageRoot, projectRoot);
  writeManifest(projectRoot, installedFiles);

  console.log(`[${PACKAGE_NAME}] Installed ${installedFiles.length} skill file(s) to ${projectRoot}/.claude/`);
}

try {
  main();
} catch (err) {
  console.warn(`[${PACKAGE_NAME}] Installation warning: ${err.message}`);
}
