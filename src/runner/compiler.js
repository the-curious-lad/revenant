import { exec } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';

/**
 * Compiles a C++ source file using g++.
 * @param {string} sourcePath - Absolute path to the .cpp source file.
 * @returns {Promise<{ success: boolean, binaryPath?: string, error?: string }>}
 */
export async function compileCpp(sourcePath) {
  const parsed = path.parse(sourcePath);
  const isWindows = os.platform() === 'win32';
  const outBinaryName = `${parsed.name}_rev_${Date.now()}${isWindows ? '.exe' : '.out'}`;
  const outBinaryPath = path.join(parsed.dir, outBinaryName);

  const command = `g++ -O2 -std=c++17 "${sourcePath}" -o "${outBinaryPath}"`;

  return new Promise((resolve) => {
    exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          error: stderr || stdout || error.message
        });
      } else {
        resolve({
          success: true,
          binaryPath: outBinaryPath
        });
      }
    });
  });
}

/**
 * Cleans up temporary compiled binary.
 * @param {string} binaryPath
 */
export function cleanupBinary(binaryPath) {
  try {
    if (binaryPath && fs.existsSync(binaryPath)) {
      fs.unlinkSync(binaryPath);
    }
  } catch (err) {
    // Ignore cleanup errors
  }
}
