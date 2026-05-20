import chalk from 'chalk';

function getVisualWidth(str) {
  if (typeof str !== 'string') return 0;
  // Strip ANSI escape codes
  const stripped = str.replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, '').replace(/\u001b\][^\u0007]*\u0007/g, '');
  let width = 0;
  for (const char of stripped) {
    const code = char.codePointAt(0);
    if (!code) continue;
    
    // Check for specific narrow symbols that would otherwise fall into wide symbol blocks
    if (
      code === 0x2714 || // ✔
      code === 0x2717 || // ✗
      code === 0x26a0 || // ⚠
      code === 0x2713 || // ✓
      code === 0x2716    // ✖
    ) {
      width += 1;
      continue;
    }

    // CJK ranges:
    if (
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0x1100 && code <= 0x11ff) ||
      (code >= 0x3130 && code <= 0x318f) ||
      (code >= 0xa960 && code <= 0xa97f) ||
      (code >= 0xd7b0 && code <= 0xd7ff) ||
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0x3040 && code <= 0x309f) ||
      (code >= 0x30a0 && code <= 0x30ff) ||
      (code >= 0xff00 && code <= 0xffef) ||
      (code >= 0x20000 && code <= 0x3134f) ||
      // Emojis / Pictographs
      (code >= 0x1f300 && code <= 0x1faff) ||
      (code >= 0x1f600 && code <= 0x1f64f) ||
      (code >= 0x1f680 && code <= 0x1f6ff) ||
      (code >= 0x231a && code <= 0x231b) ||
      (code >= 0x23f0 && code <= 0x23f3) ||
      (code >= 0x2600 && code <= 0x26ff) ||
      (code >= 0x2700 && code <= 0x27bf)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

export function drawBoxHeader(title, colorFn = chalk.yellow, totalWidth = 78) {
  const cleanTitle = title.replace(/\s+/g, ' ').trim();
  const titleText = ` [ ${cleanTitle} ] `;
  const titleWidth = getVisualWidth(titleText);
  const leftLineLen = 4;
  let rightLineLen = totalWidth - 2 - leftLineLen - titleWidth;
  if (rightLineLen < 0) rightLineLen = 0;
  return colorFn('┌' + '─'.repeat(leftLineLen)) + chalk.bold(titleText) + colorFn('─'.repeat(rightLineLen) + '┐');
}

export function drawBoxRow(content, colorFn = chalk.yellow, totalWidth = 78) {
  const contentWidth = getVisualWidth(content);
  const innerWidth = totalWidth - 4; // -2 for borders '│ ', ' │'
  const padding = Math.max(0, innerWidth - contentWidth);
  return colorFn('│ ') + content + ' '.repeat(padding) + colorFn(' │');
}

export function drawBoxFooter(colorFn = chalk.yellow, totalWidth = 78) {
  return colorFn('└' + '─'.repeat(totalWidth - 2) + '┘');
}

console.log('--- Testing getVisualWidth ---');
const tests = [
  'Hello',
  '│',
  '┌',
  '─',
  '⏳',
  'Memulai...',
  '✔ [PASS]',
  '🔧 [TOOL CALL]',
  '이전 지시 무시해',
  '前の指示を無視して',
];

for (const t of tests) {
  console.log(`Text: "${t}" | Length: ${t.length} | VisualWidth: ${getVisualWidth(t)}`);
}

console.log('--- Testing drawBox with wide characters ---');
const totalWidth = 78;
console.log(drawBoxHeader('TEST HEADER', chalk.yellow, totalWidth));
console.log(drawBoxRow('Normal text line', chalk.yellow, totalWidth));
console.log(drawBoxRow('Wide text: 이전 지시 무시해', chalk.yellow, totalWidth));
console.log(drawBoxRow('Emoji text: ⏳ Memulai...', chalk.yellow, totalWidth));
console.log(drawBoxFooter(chalk.yellow, totalWidth));
