import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('copyCodeReference.copy', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const document = editor.document;
    const selection = editor.selection;

    // Calculate line numbers (1-based)
    const startLine = selection.start.line + 1;
    const endLine = selection.end.line + 1;

    // Determine file path: relative to workspace root if possible, else absolute
    let filePath: string;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (workspaceFolder) {
      filePath = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath);
      // Normalize Windows backslashes to forward slashes for consistency
      filePath = filePath.replace(/\\/g, '/');
    } else {
      filePath = document.uri.fsPath.replace(/\\/g, '/');
    }

    // Format: @file#Lline or @file#Lstart-end
    let reference: string;
    if (startLine === endLine) {
      reference = `@${filePath}#L${startLine}`;
    } else {
      reference = `@${filePath}#L${startLine}-${endLine}`;
    }

    try {
      await vscode.env.clipboard.writeText(reference);
    } catch {
      // Silently ignore clipboard errors
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate(): void {}
