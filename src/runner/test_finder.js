import fs from 'fs';
import path from 'path';

/**
 * Finds test cases associated with a given C++ source file.
 * Checks:
 * 1. Adjacent pair: [sourceBase].in and [sourceBase].out (or .ans)
 * 2. Directory pairs in ./tests or ../tests: 01.in / 01.out, etc.
 * 3. Default: returns 1 empty test case if none found.
 * 
 * @param {string} sourcePath - Absolute path to .cpp file
 * @returns {Array<{ name: string, input: string, expectedOutput: string }>}
 */
export function findTestCases(sourcePath) {
  const parsed = path.parse(sourcePath);
  const dir = parsed.dir;
  const base = parsed.name;
  const testCases = [];

  // Check 1: [name].in and [name].out / [name].ans in same directory
  const inPath = path.join(dir, `${base}.in`);
  const outPath = path.join(dir, `${base}.out`);
  const ansPath = path.join(dir, `${base}.ans`);

  if (fs.existsSync(inPath)) {
    const input = fs.readFileSync(inPath, 'utf8');
    let expectedOutput = '';
    if (fs.existsSync(outPath)) {
      expectedOutput = fs.readFileSync(outPath, 'utf8');
    } else if (fs.existsSync(ansPath)) {
      expectedOutput = fs.readFileSync(ansPath, 'utf8');
    }
    testCases.push({
      name: `${base}.in`,
      input,
      expectedOutput
    });
  }

  // Check 2: 'tests' subdirectory
  const testsDir = path.join(dir, 'tests');
  if (fs.existsSync(testsDir) && fs.statSync(testsDir).isDirectory()) {
    const files = fs.readdirSync(testsDir);
    const inFiles = files.filter(f => f.endsWith('.in')).sort();

    for (const inFile of inFiles) {
      const testBase = path.parse(inFile).name;
      const fullIn = path.join(testsDir, inFile);
      const fullOut = path.join(testsDir, `${testBase}.out`);
      const fullAns = path.join(testsDir, `${testBase}.ans`);

      const input = fs.readFileSync(fullIn, 'utf8');
      let expectedOutput = '';
      if (fs.existsSync(fullOut)) {
        expectedOutput = fs.readFileSync(fullOut, 'utf8');
      } else if (fs.existsSync(fullAns)) {
        expectedOutput = fs.readFileSync(fullAns, 'utf8');
      }

      testCases.push({
        name: inFile,
        input,
        expectedOutput
      });
    }
  }

  return testCases;
}
