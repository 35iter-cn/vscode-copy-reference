import * as vscode from 'vscode';
import { readClipboardImage } from '../clipboard/reader';

export async function pasteImage(): Promise<void> {
  // Only supported in WSL Remote
  if (vscode.env.remoteName !== 'wsl') {
    vscode.window.setStatusBarMessage('Paste image is only supported in WSL Remote', 3000);
    return;
  }

  const activeTerminal = vscode.window.activeTerminal;
  if (!activeTerminal) {
    vscode.window.setStatusBarMessage('No active terminal', 3000);
    return;
  }

  try {
    const result = await readClipboardImage();
    const reference = `@${result.path}`;
    activeTerminal.sendText(reference);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('No image in clipboard')) {
      vscode.window.setStatusBarMessage('No image in clipboard', 3000);
    } else if (message.includes('powershell.exe')) {
      vscode.window.setStatusBarMessage('powershell.exe not available', 3000);
    } else {
      vscode.window.setStatusBarMessage(`Image paste failed: ${message}`, 3000);
    }
  }
}
