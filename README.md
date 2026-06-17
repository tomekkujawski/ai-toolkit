# @tomekkujawski/ai-toolkit

A set of Claude Code skills and rules for PHP/Symfony teams. Installs a code review skill (7 security and architecture criteria), an architectural audit skill (3-phase legacy codebase audit), and a CLAUDE.md rules template — automatically wired into your project on `npm install`.

## Quick start

**1. Configure npm to use GitHub Packages for this scope:**

```bash
echo "@tomekkujawski:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> .npmrc
```

**2. Install:**

```bash
npm install @tomekkujawski/ai-toolkit
```

**3. Verify installation:**

```bash
ls .claude/skills/
# code-review-php-symfony/  architect-audit/

grep -c "ai-toolkit" CLAUDE.md
# 2  (begin + end sentinels)
```

## Skills in this package

- **code-review-php-symfony** — Reviews PHP/Symfony diffs for SQL injection, missing Voter authorization, JMS Serializer data leaks, N+1 queries, missing Doctrine migrations, controller layer violations, and missing tests. Returns structured Critical/Warning/Suggestion findings with a final APPROVE / REQUEST CHANGES verdict.

- **architect-audit** — Guides a 3-phase legacy codebase audit: Inventory (map bounded contexts), Diagnosis (locate architectural leaks), Roadmap (prioritized refactor backlog with P0/P1/P2 scoring).

## Rules

Installs a `CLAUDE.md` block with PHP/Symfony coding standards (strict types, Voter pattern, DTO/serialization rules, testing strategy) injected between sentinel comments. Safe to re-run — subsequent installs replace only the sentinel block, leaving the rest of your `CLAUDE.md` intact.

## Requirements

- Node.js 20+
- npm
- GitHub Personal Access Token with `read:packages` scope (for installation)

## License

MIT

## Uninstall

> **Note:** Due to npm hook limitations, uninstall requires two manual steps.
> Tracked in [KNOWN_ISSUES.md](./KNOWN_ISSUES.md), planned fix in 0.2.0.

```bash
# Step 1: cleanup files installed by ai-toolkit
node node_modules/@tomekkujawski/ai-toolkit/uninstall.js

# Step 2: remove package from dependencies
npm uninstall @tomekkujawski/ai-toolkit
```
