# Commit Message Guidelines

This project uses [Conventional Commits](https://www.conventionalcommits.org/) to ensure consistent and meaningful commit messages.

## Format

```
<type>(<scope>): <subject>
```

### Examples

```bash
feat(auth): implement google signin
fix(ui): resolve button alignment issue
docs(readme): update installation instructions
refactor(storage): simplify todo retrieval logic
```

## Commit Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring without changing functionality
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **build**: Changes to build system or dependencies
- **ci**: CI/CD configuration changes
- **chore**: Other changes (maintenance, tooling, etc.)
- **revert**: Revert a previous commit

## Scope (Optional)

The scope should be the name of the affected module or feature:
- `auth`
- `ui`
- `storage`
- `commands`
- `webviews`
- etc.

## Subject

- Use imperative, present tense: "add" not "added" nor "adds"
- Don't capitalize the first letter
- No period (.) at the end
- Keep it concise (50 characters or less)

## Validation

Commits are automatically validated using Husky and Commitlint. Invalid commit messages will be rejected.

### Valid Examples ✅
```bash
git commit -m "feat(auth): add oauth2 support"
git commit -m "fix: resolve memory leak in provider"
git commit -m "docs: update api documentation"
```

### Invalid Examples ❌
```bash
git commit -m "Added new feature"           # Missing type
git commit -m "Feat(auth): Add feature"     # Type should be lowercase
git commit -m "feat(auth): Added feature."  # Should use imperative mood, no period
```

## Breaking Changes

For breaking changes, add `BREAKING CHANGE:` in the commit body or append `!` after the type/scope:

```bash
git commit -m "feat(api)!: change authentication endpoint"
```
