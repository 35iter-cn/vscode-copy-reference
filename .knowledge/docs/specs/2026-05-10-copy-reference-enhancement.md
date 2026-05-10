# Copy Reference Enhancement

## Requirements

### REQ-1: Absolute Path
The `copyReference` command must always use the absolute file path in the generated reference, regardless of whether the file is inside a workspace folder or not.

**Current behavior:** Uses relative path when inside a workspace, absolute path otherwise.
**Desired behavior:** Always use absolute path.

### REQ-2: No Line Number on Empty Selection
When the user has no text selected (i.e., the selection is empty / cursor-only), the generated reference must not include any line number suffix.

**Current behavior:** Always includes `#Lline` or `#Lstart-end` based on the selection range.
**Desired behavior:**
- Empty selection: `@/absolute/path/to/file.ts`
- Single-line selection: `@/absolute/path/to/file.ts#L42`
- Multi-line selection: `@/absolute/path/to/file.ts#L10-20`

## Scope

Only `src/commands/copyReference.ts` is affected. No changes to `package.json`, `src/extension.ts`, or keybindings.
