import { exec } from 'child_process';
import * as vscode from 'vscode';

function execPromise(command: string): Promise<{ stdout: Buffer; stderr: Buffer; error?: Error }> {
  return new Promise((resolve) => {
    exec(command, { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ stdout, stderr, error: error || undefined });
    });
  });
}

export class MacOSClipboardReader {
  async read(outputChannel: vscode.OutputChannel): Promise<string> {
    outputChannel.appendLine('[pasteImage] Starting clipboard image read (macOS)...');

    const jxaScript = `var pb = $.NSPasteboard.generalPasteboard;
var imgData = pb.dataForType($.NSPasteboardTypePNG);
if (!imgData) {
  imgData = pb.dataForType($.NSPasteboardTypeTIFF);
}
if (imgData) {
  var base64 = imgData.base64EncodedStringWithOptions(0).js;
  console.log('OK:' + base64);
} else {
  console.log('NO_IMAGE');
}`;

    const { stdout, stderr, error } = await execPromise(
      `osascript -l JavaScript -e '${jxaScript.replace(/'/g, "'\\''")}'`
    );
    if (error) {
      outputChannel.appendLine(`[pasteImage] exec error: ${error.message}`);
    }

    const output = stdout.toString('utf8');
    outputChannel.appendLine(`[pasteImage] stdout length: ${stdout.length}, stderr length: ${stderr.length}`);
    if (stderr.length > 0) {
      outputChannel.appendLine(`[pasteImage] stderr: ${stderr.toString('utf8').slice(0, 500)}`);
    }

    const okMatch = output.match(/OK:([A-Za-z0-9+/=]+)/);
    const noImage = output.includes('NO_IMAGE');

    if (noImage) {
      throw new Error('No image in clipboard');
    }

    if (!okMatch) {
      outputChannel.appendLine(`[pasteImage] stdout text: ${output.slice(0, 300)}`);
      throw new Error('Unexpected osascript output (see Output panel for full details)');
    }

    return okMatch[1];
  }
}
