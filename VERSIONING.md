# Versioning Workflow

This project uses [Changesets](https://github.com/changesets/changesets) for version management and publishing.

## Creating a Changeset

Before committing your changes, create a changeset to specify the version bump type:

```bash
npm run changeset
```

You'll be prompted to:
1. **Select version bump type**:
   - **Patch** (1.2.3 → 1.2.4): Bug fixes, minor updates
   - **Minor** (1.2.3 → 1.3.0): New features, backward-compatible changes
   - **Major** (1.2.3 → 2.0.0): Breaking changes

2. **Provide a description**: Explain what changed

This creates a new file in `.changeset/` directory. Commit this file with your changes.

## Publishing Workflow

### 1. Push Changes to Main

When you push commits with changesets to the `main` branch:

```bash
git add .
git commit -m "feat: your feature description"
git push origin main
```

### 2. Version Packages PR

The GitHub Action will automatically:
- Detect the changesets
- Create a "Version Packages" pull request
- Update `package.json` with the new version
- Update `CHANGELOG.md` with your changeset descriptions

### 3. Publish to Marketplaces

When you merge the "Version Packages" PR:
- The workflow automatically publishes to:
  - **VS Code Marketplace** (publisher: `abdullahmia`)
  - **Open VSX** (namespace: `vinto`)

## Manual Version Bump (Optional)

If you need to manually bump versions:

```bash
npm run version
```

This applies all pending changesets and updates `package.json` and `CHANGELOG.md`.

## Example Workflow

```bash
# 1. Make your changes
# ... edit files ...

# 2. Create a changeset
npm run changeset
# Select: Minor
# Description: "Add new todo filtering feature"

# 3. Commit everything
git add .
git commit -m "feat: add todo filtering feature"

# 4. Push to main
git push origin main

# 5. Wait for "Version Packages" PR to be created
# 6. Review and merge the PR
# 7. Extension is automatically published! 🚀
```

## Important Notes

- **Always create a changeset** before committing feature changes or bug fixes
- **Don't manually edit** `package.json` version - let Changesets handle it
- **Publishing only happens** when merging to `main` branch
- **PRs to development** will NOT trigger publishing
