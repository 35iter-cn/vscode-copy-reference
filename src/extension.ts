import * as vscode from 'vscode';
import { copyReference } from './commands/copyReference';

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('copyCodeReference.copy', copyReference);
  context.subscriptions.push(disposable);
}

export function deactivate(): void {}
