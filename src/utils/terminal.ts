import * as vscode from 'vscode';

export interface SendToTerminalOptions {
  /** Append a trailing space after the text. Defaults to false. */
  appendSpace?: boolean;
}

/**
 * Send text to the active terminal and focus it.
 *
 * @param text - The text to send.
 * @param options - Optional behavior flags.
 */
export async function sendToTerminal(
  text: string,
  options: SendToTerminalOptions = {}
): Promise<void> {
  const terminal = vscode.window.activeTerminal;
  if (!terminal) {
    return;
  }

  const textToSend = options.appendSpace ? `${text} ` : text;
  terminal.sendText(textToSend, false);
  await vscode.commands.executeCommand('workbench.action.terminal.focus');
}
