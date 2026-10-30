import chalk from 'chalk';

export const GHOST_ART = `
      .-.
     (o o)   R E V E N A N T
     | O \\   "The machine remembers every sin"
      \\   \\
       \`~~~'
`;

export const GHOST_SMALL = `  (o o) `;

export function printBanner() {
  console.log(chalk.magentaBright(GHOST_ART));
}

export function printWarning(category, line, evidence, explanation) {
  console.log('\n' + chalk.bgRed.black.bold(' 👻 GHOST DETECTED IN THE MACHINE '));
  console.log(chalk.redBright(`┌─ Category:    ${chalk.bold(category)}`));
  if (line) {
    console.log(chalk.redBright(`├─ Suspect Line: ${chalk.yellow(line)}`));
  }
  if (evidence) {
    console.log(chalk.redBright(`├─ Evidence:     ${chalk.italic(evidence)}`));
  }
  if (explanation) {
    console.log(chalk.redBright(`└─ Warning:      ${chalk.bold(explanation)}`));
  }
  console.log(chalk.gray('─────────────────────────────────────────────────\n'));
}

export function printVerdict(verdict, details = {}) {
  const { timeMs, errorOutput, testIndex, totalTests } = details;
  const testInfo = totalTests ? ` [Test ${testIndex || 1}/${totalTests}]` : '';

  switch (verdict) {
    case 'AC':
      console.log(chalk.greenBright.bold(`\n✔ ACCEPTED (AC)${testInfo} - ${timeMs || 0}ms`));
      console.log(chalk.gray('  The ghosts retreat into the shadows...\n'));
      break;
    case 'WA':
      console.log(chalk.redBright.bold(`\n✘ WRONG ANSWER (WA)${testInfo}`));
      if (details.expected && details.actual) {
        console.log(chalk.yellow(`  Expected: ${details.expected.trim()}`));
        console.log(chalk.red(`  Actual:   ${details.actual.trim()}`));
      }
      break;
    case 'TLE':
      console.log(chalk.yellowBright.bold(`\n⏳ TIME LIMIT EXCEEDED (TLE)${testInfo}`));
      console.log(chalk.gray(`  Execution killed after ${details.timeoutMs || 2000}ms limit.`));
      break;
    case 'RTE':
      console.log(chalk.red.bold(`\n💥 RUNTIME ERROR (RTE)${testInfo}`));
      if (errorOutput) {
        console.log(chalk.gray(`  ${errorOutput.trim()}`));
      }
      break;
    case 'CE':
      console.log(chalk.red.bold(`\n🔨 COMPILE ERROR (CE)`));
      if (errorOutput) {
        console.log(chalk.gray(`  ${errorOutput.trim()}`));
      }
      break;
    default:
      console.log(chalk.white(`\nVerdict: ${verdict}`));
  }
}
