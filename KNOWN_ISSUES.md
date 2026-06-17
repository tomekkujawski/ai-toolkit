# Known Issues — @tomekkujawski/ai-toolkit

## 0.1.0

### Uninstall hook does not auto-execute

**Problem:** Running `npm uninstall @tomekkujawski/ai-toolkit` does NOT trigger
the `preuninstall` script. Files copied by `install.js` (skills, manifest, CLAUDE.md
sentinel block) remain in the consumer project.

**Root cause:** Since npm 7+, the `preuninstall` and `postuninstall` lifecycle
hooks defined in a package's own `package.json` are not executed during
`npm uninstall` of that package. They only run for the root project, not for
dependencies being removed. This is intentional in npm — uninstalled packages
cannot run arbitrary code on the consumer machine.

**Workaround until 0.2.0:** Run the cleanup script manually before uninstalling:

```bash
# Step 1: cleanup files installed by ai-toolkit
node node_modules/@tomekkujawski/ai-toolkit/uninstall.js

# Step 2: remove package from dependencies
npm uninstall @tomekkujawski/ai-toolkit
```

**Planned fix in 0.2.0:** Replace `preuninstall` hook with a CLI command
(`npx @tomekkujawski/ai-toolkit-cleanup`) so users have an explicit, scriptable
way to trigger cleanup.

### Other minor items
- `install.js` produces no progress indicator for large skill sets (acceptable
  for current 2-skill scope).
- `README.md` lacks a `code-review-agent` consumer test scenario walkthrough.
