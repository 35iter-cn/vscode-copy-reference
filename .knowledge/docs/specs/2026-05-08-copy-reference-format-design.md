# Copy Reference Format Update

## Current Behavior

The extension copies references in the format:
- Single line: `@file.ts:10`
- Multiple lines: `@file.ts:10-15`

## Proposed Change

Update the format to match GitHub/GitLab line reference style:
- Single line: `@file.ts#L10`
- Multiple lines: `@file.ts#L10-15`

## Design

Modify the format string in `src/extension.ts`:

- Remove the `:` separator before line numbers
- Add `#L` prefix before the start line number
- Multi-line range keeps `#L` only on the start line: `#L10-15`

## Rationale

`#L` prefix is the standard convention in GitHub, GitLab, and other code hosting platforms for referencing specific lines in a file. This makes the copied references more directly useful when pasted into PR comments, issues, or commit messages.

## Scope

This is a purely mechanical format change. No new features, no UI changes, no configuration options. The `@` prefix is retained (per design decision) to maintain compatibility with tools that expect it.
