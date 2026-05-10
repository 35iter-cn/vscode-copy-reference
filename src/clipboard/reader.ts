import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function execPromise(command: string): Promise<{ stdout: Buffer; stderr: Buffer }> {
  return new Promise((resolve, reject) => {
    exec(command, { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject({ error, stdout, stderr });
      else resolve({ stdout, stderr });
    });
  });
}

export interface ClipboardImageResult {
  buffer: Buffer;
  path: string;
}

export async function readClipboardImage(): Promise<ClipboardImageResult> {
  const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
  $img = [System.Windows.Forms.Clipboard]::GetImage()
  $stream = New-Object System.IO.MemoryStream
  $img.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $stream.ToArray()
  Write-Output "OK:$([Convert]::ToBase64String($bytes))"
} else {
  Write-Output "NO_IMAGE"
}`;

  const psFile = path.join(os.tmpdir(), 'read-clipboard.ps1');
  fs.writeFileSync(psFile, psScript, 'utf8');

  let stdout: Buffer;
  try {
    const result = await execPromise(
      `powershell.exe -ExecutionPolicy Bypass -File "${psFile}"`
    );
    stdout = result.stdout;
  } finally {
    // Always clean up the temp script, even on error
    try {
      fs.unlinkSync(psFile);
    } catch {
      // Ignore cleanup errors
    }
  }

  const result = stdout.toString('utf8').trim();

  if (result === 'NO_IMAGE') {
    throw new Error('No image in clipboard');
  }

  if (!result.startsWith('OK:')) {
    throw new Error('Unexpected PowerShell output: ' + result.slice(0, 100));
  }

  const base64 = result.substring(3); // Strip "OK:" prefix
  const buffer = Buffer.from(base64, 'base64');

  const wslTempFile = path.join(os.tmpdir(), `screenshot-${Date.now()}.png`);
  fs.writeFileSync(wslTempFile, buffer);

  return { buffer, path: wslTempFile };
}
