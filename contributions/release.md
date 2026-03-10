# Release Guide

This monorepo uses [Changesets](https://github.com/changesets/changesets) for version management and automated publishing to npm.

## Publishable Packages

| Package | npm |
|---|---|
| `@deltakit/core` | [npmjs.com/package/@deltakit/core](https://www.npmjs.com/package/@deltakit/core) |
| `@deltakit/react` | [npmjs.com/package/@deltakit/react](https://www.npmjs.com/package/@deltakit/react) |
| `@deltakit/markdown` | [npmjs.com/package/@deltakit/markdown](https://www.npmjs.com/package/@deltakit/markdown) |

## How It Works

```
Developer creates changeset
        |
        v
Push / merge to main
        |
        v
Release workflow detects changeset
        |
        v
Creates "Version Packages" PR
  (bumps versions, updates changelogs)
        |
        v
Merge the PR
        |
        v
Release workflow publishes to npm
```

## Step-by-Step

### 1. Create a Changeset

After making changes to any package, run:

```bash
pnpm changeset
```

This will prompt you to:
- Select which packages changed (`@deltakit/core`, `@deltakit/react`, `@deltakit/markdown`)
- Choose the semver bump type for each (`patch`, `minor`, `major`)
- Write a summary of the changes

This creates a markdown file in `.changeset/` describing the change.

### 2. Commit and Push

```bash
git add .changeset/
git commit -m "chore: add changeset for <description>"
git push
```

### 3. Merge to Main

When your PR (or direct push) lands on `main`, the release workflow runs automatically and creates a **"chore(release): version packages"** PR.

This PR contains:
- Version bumps in `package.json` for each affected package
- Updated `CHANGELOG.md` for each package
- Removal of the consumed changeset files

### 4. Merge the Version PR

Review the version PR and merge it. This triggers the release workflow again, which:
- Builds `@deltakit/core`, `@deltakit/react`, and `@deltakit/markdown`
- Publishes all bumped packages to npm via `changeset publish`

## Bump Types

| Type | When to use | Example |
|---|---|---|
| `patch` | Bug fixes, minor tweaks, CI/config changes | 0.1.1 -> 0.1.2 |
| `minor` | New features, non-breaking additions | 0.1.2 -> 0.2.0 |
| `major` | Breaking changes | 0.2.0 -> 1.0.0 |

## Creating a Changeset Manually

If you prefer not to use the interactive prompt, create a file in `.changeset/` with any name ending in `.md`:

```markdown
---
"@deltakit/core": patch
"@deltakit/react": patch
---

Fix streaming parser edge case with nested code blocks
```

The frontmatter lists each package and its bump type. The body is the changelog entry.

## Multiple Changesets

You can have multiple changeset files at once. They are all consumed together when the version PR is created. This is useful when:
- Multiple PRs land before a release
- A single PR touches multiple packages with different bump reasons

## Pre-requisites

### NPM_TOKEN

The `NPM_TOKEN` secret must be configured in the GitHub repo:

**Settings -> Secrets and variables -> Actions -> New repository secret**

- Name: `NPM_TOKEN`
- Value: An npm access token with publish permissions for the `@deltakit` scope

### GitHub Actions Permissions

The following must be enabled in the GitHub repo:

**Settings -> Actions -> General -> Workflow permissions**

- "Read and write permissions" must be selected
- "Allow GitHub Actions to create and approve pull requests" must be checked

If the checkbox is disabled, enable it at the organization level first:

**github.com/organizations/deltakithq/settings/actions**

## Troubleshooting

### "No changesets found" in release workflow
The workflow found no `.changeset/*.md` files (excluding README.md). This is normal -- it means versions are already up to date and it will attempt to publish any unpublished versions.

### "GitHub Actions is not permitted to create pull requests"
Enable "Allow GitHub Actions to create and approve pull requests" in both org and repo settings (see Pre-requisites above).

### Build fails during release
The release script (`pnpm release`) only builds the three publishable packages: `core`, `react`, `markdown`. If the build fails, check the individual package's `tsup.config.ts` and source files.

### Package already published
If `changeset publish` says a version is already published, it means the version in `package.json` matches what's on npm. Create a new changeset to bump the version.
