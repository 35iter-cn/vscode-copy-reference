import * as vscode from 'vscode';
import { copyReference } from './commands/copyReference';
import { pasteImage } from './commands/pasteImage';

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Copy Reference');
  context.subscriptions.push(outputChannel);

  const copyDisposable = vscode.commands.registerCommand('copyCodeReference.copy', copyReference);
  const pasteDisposable = vscode.commands.registerCommand('copyCodeReference.pasteImage', () => pasteImage(outputChannel));

  context.subscriptions.push(copyDisposable, pasteDisposable);
}

export function deactivate(): void {}
