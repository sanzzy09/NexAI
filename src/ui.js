// This Code Modified By NexAI
import chalk from 'chalk';
import ora from 'ora';

const logLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

let currentLevel = logLevel.INFO;

const themes = {
  classic: {
    primary: chalk.cyan,
    secondary: chalk.gray,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
    border: chalk.cyan,
    text: chalk.white
  },
  dracula: {
    primary: chalk.hex('#BD93F9'), // Orchid Purple
    secondary: chalk.hex('#6272A4'), // Slate Gray
    success: chalk.hex('#50FA7B'), // Lime Green
    warning: chalk.hex('#F1FA8C'), // Light Yellow
    error: chalk.hex('#FF5555'), // Red
    border: chalk.hex('#FF79C6'), // Bright Pink
    text: chalk.hex('#F8F8F2') // Light Gray
  },
  cyberpunk: {
    primary: chalk.hex('#FFE300'), // Neon Yellow
    secondary: chalk.hex('#6272A4'),
    success: chalk.hex('#00FFFF'), // Cyan
    warning: chalk.hex('#FF007F'), // Deep Pink
    error: chalk.hex('#FF3333'),
    border: chalk.hex('#FF007F'),
    text: chalk.hex('#00FFFF')
  },
  nord: {
    primary: chalk.hex('#81A1C1'), // Glacier Blue
    secondary: chalk.hex('#4C566A'), // Charcoal
    success: chalk.hex('#A3BE8C'), // Sage Green
    warning: chalk.hex('#EBCB8B'), // Amber
    error: chalk.hex('#BF616A'), // Red
    border: chalk.hex('#8FBCBB'), // Frost Blue
    text: chalk.hex('#D8DEE9') // Polar Storm
  },
  matrix: {
    primary: chalk.hex('#00FF00'), // Matrix Green
    secondary: chalk.hex('#005500'), // Dark Moss
    success: chalk.hex('#00FF00'),
    warning: chalk.hex('#008F11'), // Forest Green
    error: chalk.hex('#990000'),
    border: chalk.hex('#008F11'),
    text: chalk.hex('#00FF00')
  },
  sunset: {
    primary: chalk.hex('#FF5E36'), // Orange Sunset
    secondary: chalk.hex('#7209B7'), // Purple Orchid
    success: chalk.hex('#4D908E'),
    warning: chalk.hex('#F9C74F'), // Yellow
    error: chalk.hex('#F94144'), // Red
    border: chalk.hex('#FF4D6D'), // Coral
    text: chalk.hex('#FFF2F2')
  }
};

let activeThemeName = 'classic';

// ── Visual Layout Helpers ─────────────────────────────────────

export function getVisualWidth(str) {
  if (typeof str !== 'string') return 0;
  // Strip ANSI escape codes
  const stripped = str.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');
  let width = 0;
  for (const char of stripped) {
    const code = char.codePointAt(0);
    if (!code) continue;
    // CJK Unified Ideographs, Hiragana, Katakana, Fullwidth Forms, Emojis
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0x3040 && code <= 0x309f) ||
      (code >= 0x30a0 && code <= 0x30ff) ||
      (code >= 0xff00 && code <= 0xffef) ||
      (code >= 0x20000 && code <= 0x2a6df) ||
      (code >= 0x1f300 && code <= 0x1f9ff) ||
      (code >= 0x1f600 && code <= 0x1f64f) ||
      (code >= 0x1f680 && code <= 0x1f6ff) ||
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

export function padLine(text, width, align = 'left', padChar = ' ') {
  const visWidth = getVisualWidth(text);
  const diff = width - visWidth;
  if (diff <= 0) return text;
  if (align === 'left') {
    return text + padChar.repeat(diff);
  } else if (align === 'right') {
    return padChar.repeat(diff) + text;
  } else if (align === 'center') {
    const leftPad = Math.floor(diff / 2);
    const rightPad = diff - leftPad;
    return padChar.repeat(leftPad) + text + padChar.repeat(rightPad);
  }
  return text;
}

export function wrapText(text, maxWidth) {
  if (typeof text !== 'string') return [];
  const lines = [];
  const rawLines = text.split('\n');
  for (const rawLine of rawLines) {
    let currentLine = '';
    const words = rawLine.split(' ');
    for (const word of words) {
      const lineWithWord = currentLine ? currentLine + ' ' + word : word;
      if (getVisualWidth(lineWithWord) <= maxWidth) {
        currentLine = lineWithWord;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        let tempWord = word;
        while (getVisualWidth(tempWord) > maxWidth) {
          let splitIdx = 0;
          let tempWidth = 0;
          for (let i = 0; i < tempWord.length; i++) {
            const charWidth = getVisualWidth(tempWord[i]);
            if (tempWidth + charWidth > maxWidth) break;
            tempWidth += charWidth;
            splitIdx++;
          }
          if (splitIdx === 0) splitIdx = 1;
          lines.push(tempWord.substring(0, splitIdx));
          tempWord = tempWord.substring(splitIdx);
        }
        currentLine = tempWord;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    } else if (rawLine === '') {
      lines.push('');
    }
  }
  return lines;
}

export function drawBoxHeader(title, colorFn, totalWidth = 78) {
  const finalColorFn = colorFn || ui.theme.border;
  const cleanTitle = title.replace(/\s+/g, ' ').trim();
  const titleText = ` [ ${cleanTitle} ] `;
  const titleWidth = getVisualWidth(titleText);
  const leftLineLen = 4;
  let rightLineLen = totalWidth - 2 - leftLineLen - titleWidth;
  if (rightLineLen < 0) rightLineLen = 0;
  return finalColorFn('┌' + '─'.repeat(leftLineLen)) + chalk.bold(titleText) + finalColorFn('─'.repeat(rightLineLen) + '┐');
}

export function drawBoxRow(content, colorFn, totalWidth = 78) {
  const finalColorFn = colorFn || ui.theme.border;
  const contentWidth = getVisualWidth(content);
  const innerWidth = totalWidth - 4; // -2 for borders '│ ', ' │'
  const padding = Math.max(0, innerWidth - contentWidth);
  return finalColorFn('│ ') + content + ' '.repeat(padding) + finalColorFn(' │');
}

export function drawBoxSeparator(colorFn, totalWidth = 78) {
  const finalColorFn = colorFn || ui.theme.border;
  return finalColorFn('├' + '─'.repeat(totalWidth - 2) + '┤');
}

export function drawBoxFooter(colorFn, totalWidth = 78) {
  const finalColorFn = colorFn || ui.theme.border;
  return finalColorFn('└' + '─'.repeat(totalWidth - 2) + '┘');
}

export function drawDoubleBoxHeader(title, colorFn, totalWidth = 78) {
  const finalColorFn = colorFn || ui.theme.border;
  const cleanTitle = title.replace(/\s+/g, ' ').trim();
  const titleText = ` [ ${cleanTitle} ] `;
  const titleWidth = getVisualWidth(titleText);
  const leftLineLen = 4;
  let rightLineLen = totalWidth - 2 - leftLineLen - titleWidth;
  if (rightLineLen < 0) rightLineLen = 0;
  return finalColorFn('╔' + '═'.repeat(leftLineLen)) + chalk.bold(titleText) + finalColorFn('═'.repeat(rightLineLen) + '╗');
}

export function drawDoubleBoxRow(content, colorFn, totalWidth = 78) {
  const finalColorFn = colorFn || ui.theme.border;
  const contentWidth = getVisualWidth(content);
  const innerWidth = totalWidth - 4; // -2 for borders '║ ', ' ║'
  const padding = Math.max(0, innerWidth - contentWidth);
  return finalColorFn('║ ') + content + ' '.repeat(padding) + finalColorFn(' ║');
}

export function drawDoubleBoxSeparator(colorFn, totalWidth = 78) {
  const finalColorFn = colorFn || ui.theme.border;
  return finalColorFn('╠' + '═'.repeat(totalWidth - 2) + '╣');
}

export function drawDoubleBoxFooter(colorFn, totalWidth = 78) {
  const finalColorFn = colorFn || ui.theme.border;
  return finalColorFn('╚' + '═'.repeat(totalWidth - 2) + '╝');
}

export function formatMarkdownTables(text) {
  if (!text) return text;
  const lines = text.split('\n');
  const resultLines = [];
  let tableLines = [];

  const processTable = () => {
    if (tableLines.length === 0) return;
    
    // Check if there is a valid delimiter row
    const delimiterIndex = tableLines.findIndex(l => {
      const stripped = l.replace(/[\s|:\-]/g, '');
      return stripped === '' && l.includes('|');
    });

    if (delimiterIndex === -1 || delimiterIndex === 0) {
      // Not a valid table
      resultLines.push(...tableLines);
      tableLines = [];
      return;
    }

    try {
      const parseRow = (line) => {
        let trimmed = line.trim();
        if (trimmed.startsWith('|')) trimmed = trimmed.substring(1);
        if (trimmed.endsWith('|')) trimmed = trimmed.substring(0, trimmed.length - 1);
        return trimmed.split('|').map(c => c.trim());
      };

      const headerCells = parseRow(tableLines[delimiterIndex - 1]);
      const delimiterCells = parseRow(tableLines[delimiterIndex]);
      
      const bodyRows = [];
      for (let i = 0; i < tableLines.length; i++) {
        if (i === delimiterIndex || i === delimiterIndex - 1) continue;
        bodyRows.push(parseRow(tableLines[i]));
      }

      const alignments = delimiterCells.map(cell => {
        const trimmed = cell.trim();
        const start = trimmed.startsWith(':');
        const end = trimmed.endsWith(':');
        if (start && end) return 'center';
        if (end) return 'right';
        return 'left';
      });

      const numCols = Math.max(headerCells.length, ...bodyRows.map(r => r.length));

      while (alignments.length < numCols) alignments.push('left');
      while (headerCells.length < numCols) headerCells.push('');
      bodyRows.forEach(row => {
        while (row.length < numCols) row.push('');
      });

      const colWidths = [];
      for (let c = 0; c < numCols; c++) {
        let maxWidth = getVisualWidth(headerCells[c]);
        for (const row of bodyRows) {
          maxWidth = Math.max(maxWidth, getVisualWidth(row[c]));
        }
        colWidths.push(Math.max(maxWidth, 3));
      }

      const borderCol = ui.theme.border;
      const primaryCol = ui.theme.primary;
      const textCol = ui.theme.text || chalk.white;

      const topBorder = borderCol('┌' + colWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐');
      const headerRow = borderCol('│') + headerCells.map((cell, idx) => ' ' + primaryCol.bold(padLine(cell, colWidths[idx], alignments[idx])) + ' ').join(borderCol('│')) + borderCol('│');
      const midBorder = borderCol('├' + colWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤');
      const bodyRowsStr = bodyRows.map(row => {
        return borderCol('│') + row.map((cell, idx) => ' ' + textCol(padLine(cell, colWidths[idx], alignments[idx])) + ' ').join(borderCol('│')) + borderCol('│');
      }).join('\n');
      const bottomBorder = borderCol('└' + colWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘');

      const formattedTable = [
        topBorder,
        headerRow,
        midBorder,
        bodyRowsStr,
        bottomBorder
      ].join('\n');

      resultLines.push(formattedTable);
    } catch (e) {
      resultLines.push(...tableLines);
    }
    tableLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTableRow = line.includes('|');

    if (isTableRow) {
      tableLines.push(line);
    } else {
      if (tableLines.length > 0) {
        processTable();
      }
      resultLines.push(line);
    }
  }

  if (tableLines.length > 0) {
    processTable();
  }

  return resultLines.join('\n');
}

export function formatAIResponse(text) {
  if (!text) return text;
  
  // Replace ```json { ... } ``` or ``` { ... } ``` with beautifully formatted JSON
  const jsonBlockRegex = /```(json)?\s*([\s\S]*?)\s*```/g;
  let formatted = text.replace(jsonBlockRegex, (match, lang, code) => {
    try {
      const parsed = JSON.parse(code.trim());
      const pretty = JSON.stringify(parsed, null, 2);
      
      const header = drawBoxHeader('JSON RESPONSE', ui.theme.primary, 78);
      const rows = pretty.split('\n').flatMap(line => {
        const wrapped = wrapText(line, 74);
        return wrapped.map(wl => drawBoxRow(wl, ui.theme.primary, 78));
      }).join('\n');
      const footer = drawBoxFooter(ui.theme.primary, 78);
      
      return `\n${header}\n${rows}\n${footer}`;
    } catch (e) {
      return match;
    }
  });

  return formatMarkdownTables(formatted);
}

export const ui = {
  setTheme(name) {
    if (themes[name]) {
      activeThemeName = name;
      return true;
    }
    return false;
  },

  getAvailableThemes() {
    return Object.keys(themes);
  },

  get theme() {
    return themes[activeThemeName];
  },

  get activeThemeName() {
    return activeThemeName;
  },

  getTheme(name) {
    return themes[name];
  },

  showBanner() {
    const border = ui.theme.border;
    const primary = ui.theme.primary;
    const success = ui.theme.success;
    const secondary = ui.theme.secondary;

    const logo = [
      '    _  _________  __   ___    ____',
      '   / |/ / __/ _ \\/ /  / _ |  /  _/',
      '  /    / _// , _/_/  / __ | _/ /  ',
      ' /_/|_/___/_/|_(_)  /_/ |_/ /___/  '
    ];

    console.log(border('╔' + '═'.repeat(76) + '╗'));
    
    // Logo block
    logo.forEach(line => {
      const padded = padLine(line, 72, 'center');
      console.log(border('║  ') + primary.bold(padded) + border('  ║'));
    });
    
    console.log(border('╠' + '═'.repeat(76) + '╣'));
    
    // Status block
    const statusText = '⚡ TERMINAL AI CODING AGENT  |  🟢 SYSTEM HEALTH: EXCELLENT';
    const paddedStatus = padLine(statusText, 72, 'center');
    console.log(border('║  ') + success.bold(paddedStatus) + border('  ║'));
    
    console.log(border('╠' + '═'.repeat(76) + '╣'));
    
    // Command tip block
    const tips = 'Type /help for command list  •  /exit to quit  •  /theme to customize';
    const paddedTips = padLine(tips, 72, 'center');
    console.log(border('║  ') + secondary(paddedTips) + border('  ║'));
    
    console.log(border('╚' + '═'.repeat(76) + '╝') + '\n');
  },

  userPrompt() {
    return ui.theme.primary.bold('\n> ');
  },

  printUser(message) {
    console.log(ui.theme.primary.bold('[USER] ') + ui.theme.text(message));
  },

  printAI(message, usage) {
    if (message) {
      const formatted = formatAIResponse(message);
      console.log(ui.theme.success.bold('[NEX AI] ') + ui.theme.text(formatted));
      if (usage) {
        const prompt = usage.promptTokens || usage.prompt_tokens || 0;
        const completion = usage.completionTokens || usage.completion_tokens || 0;
        const total = usage.totalTokens || usage.total_tokens || 0;
        console.log(
          '  ' + ui.theme.secondary('└─ ') + ui.theme.primary('⚡ Tokens:') + ui.theme.secondary(` Prompt: ${prompt} | Completion: ${completion} | Total: ${total}`)
        );
      }
    }
  },

  printToolCall(toolName, args) {
    const rows = [];
    rows.push(ui.theme.warning(`Tool:      `) + ui.theme.warning.bold(toolName));
    
    if (toolName === 'run_command' && args.command) {
      rows.push(ui.theme.warning(`Command:   `) + ui.theme.primary(`$ ${args.command}`));
      if (args.timeoutMs) {
        rows.push(ui.theme.warning(`Timeout:   `) + ui.theme.secondary(`${args.timeoutMs}ms`));
      }
    } else if (['file_create', 'file_read', 'file_update', 'file_delete'].includes(toolName) && (args.filePath || args.path)) {
      rows.push(ui.theme.warning(`File:      `) + ui.theme.primary(args.filePath || args.path));
      if (args.mode) {
        rows.push(ui.theme.warning(`Mode:      `) + ui.theme.primary(args.mode));
      }
      if (args.content) {
        const lines = args.content.split('\n');
        rows.push(ui.theme.warning(`Size:      `) + ui.theme.secondary(`${lines.length} lines (${args.content.length} chars)`));
        rows.push(ui.theme.warning(`Preview:   `));
        const previewLines = lines.slice(0, 5);
        previewLines.forEach(l => {
          rows.push(ui.theme.secondary(`  ${l.substring(0, 70)}${l.length > 70 ? '...' : ''}`));
        });
        if (lines.length > 5) {
          rows.push(ui.theme.secondary(`  ... and ${lines.length - 5} more lines`));
        }
      }
    } else if (toolName === 'list_directory') {
      rows.push(ui.theme.warning(`Directory: `) + ui.theme.primary(args.dirPath || args.path || '.'));
    } else if (toolName === 'search_files' && args.query) {
      rows.push(ui.theme.warning(`Search:    `) + ui.theme.primary(`"${args.query}"`));
      rows.push(ui.theme.warning(`Directory: `) + ui.theme.primary(args.dirPath || args.path || '.'));
      if (args.fileExtension) {
        rows.push(ui.theme.warning(`Extension: `) + ui.theme.primary(args.fileExtension));
      }
    } else if (toolName.startsWith('memory_')) {
      if (args.key) rows.push(ui.theme.warning(`Key:       `) + ui.theme.primary(args.key));
      if (args.value) rows.push(ui.theme.warning(`Value:     `) + ui.theme.primary(args.value));
      if (args.query) rows.push(ui.theme.warning(`Query:     `) + ui.theme.primary(args.query));
      if (args.insight) rows.push(ui.theme.warning(`Insight:   `) + ui.theme.primary(args.insight));
    } else {
      rows.push(ui.theme.warning(`Arguments: `));
      for (const [key, value] of Object.entries(args || {})) {
        if (typeof value === 'string' && value.includes('\n')) {
          rows.push(ui.theme.primary(`  ${key}: `) + ui.theme.secondary(`(multi-line string, ${value.length} chars)`));
          const lines = value.split('\n');
          lines.slice(0, 5).forEach(l => {
            rows.push(ui.theme.secondary(`    ${l.substring(0, 66)}${l.length > 66 ? '...' : ''}`));
          });
          if (lines.length > 5) {
            rows.push(ui.theme.secondary(`    ... and ${lines.length - 5} more lines`));
          }
        } else if (typeof value === 'object' && value !== null) {
          rows.push(ui.theme.primary(`  ${key}: `));
          JSON.stringify(value, null, 2).split('\n').forEach(l => {
            rows.push(ui.theme.secondary(`    ${l}`));
          });
        } else {
          rows.push(ui.theme.primary(`  ${key}: `) + ui.theme.text(value));
        }
      }
    }
    
    console.log('');
    console.log(drawBoxHeader('⚙️  TOOL CALL', ui.theme.warning, 78));
    rows.forEach(r => {
      const wrapped = wrapText(r, 74);
      wrapped.forEach(wr => {
        console.log(drawBoxRow(wr, ui.theme.warning, 78));
      });
    });
    console.log(drawBoxFooter(ui.theme.warning, 78));
  },

  printToolResult(toolName, result) {
    const rows = [];
    rows.push(ui.theme.success(`Source:    `) + ui.theme.success.bold(toolName));

    try {
      const parsed = JSON.parse(result);
      
      if (toolName === 'run_command') {
        const status = parsed.success ? ui.theme.success.bold('SUCCESS') : ui.theme.error.bold('FAILED');
        rows.push(ui.theme.success(`Status:    `) + status);
        
        if (parsed.stdout && parsed.stdout.trim()) {
          rows.push(ui.theme.success(`Stdout:    `));
          const lines = parsed.stdout.split('\n');
          const previewLines = lines.slice(0, 10);
          previewLines.forEach(l => {
            rows.push(ui.theme.text(`  ${l.substring(0, 70)}${l.length > 70 ? '...' : ''}`));
          });
          if (lines.length > 10) {
            rows.push(ui.theme.secondary(`  ... and ${lines.length - 10} more lines`));
          }
        }
        if (parsed.stderr && parsed.stderr.trim()) {
          rows.push(ui.theme.error(`Stderr:    `));
          const lines = parsed.stderr.split('\n');
          lines.forEach(l => {
            rows.push(ui.theme.error(`  ${l.substring(0, 70)}`));
          });
        }
        if (parsed.error) {
          rows.push(ui.theme.error(`Error:     `) + ui.theme.error.bold(parsed.error));
        }
      } else if (toolName === 'list_directory') {
        if (parsed.success && Array.isArray(parsed.files)) {
          rows.push(ui.theme.success(`Contents:  `));
          parsed.files.forEach(f => {
            const prefix = f.isDir ? ui.theme.primary('📁 ') : ui.theme.secondary('📄 ');
            const details = f.size !== undefined ? ui.theme.secondary(` (${f.size} bytes)`) : '';
            rows.push(`  ${prefix}${f.name}${details}`);
          });
        } else {
          rows.push(ui.theme.success(`Result:    `) + ui.theme.text(JSON.stringify(parsed)));
        }
      } else if (toolName === 'search_files') {
        if (parsed.success && Array.isArray(parsed.matches)) {
          rows.push(ui.theme.success(`Matches:   `) + ui.theme.text(`${parsed.matches.length} found`));
          parsed.matches.slice(0, 10).forEach(m => {
            rows.push(ui.theme.primary(`${m.file}:${m.line} `) + ui.theme.text(m.content.trim()));
          });
          if (parsed.matches.length > 10) {
            rows.push(ui.theme.secondary(`  ... and ${parsed.matches.length - 10} more matches`));
          }
        } else {
          rows.push(ui.theme.success(`Result:    `) + ui.theme.text(JSON.stringify(parsed)));
        }
      } else {
        rows.push(ui.theme.success(`JSON:      `));
        const lines = JSON.stringify(parsed, null, 2).split('\n');
        lines.slice(0, 15).forEach(l => {
          rows.push(ui.theme.text(`  ${l}`));
        });
        if (lines.length > 15) {
          rows.push(ui.theme.secondary(`  ... truncated (${lines.length - 15} more lines)`));
        }
      }
    } catch (e) {
      const lines = result.split('\n');
      const previewLines = lines.slice(0, 10);
      rows.push(ui.theme.success(`Output:    `));
      previewLines.forEach(l => {
        rows.push(ui.theme.text(`  ${l.substring(0, 70)}${l.length > 70 ? '...' : ''}`));
      });
      if (lines.length > 10) {
        rows.push(ui.theme.secondary(`  ... and ${lines.length - 10} more lines`));
      }
    }

    console.log(drawBoxHeader('✓ TOOL RESULT', ui.theme.success, 78));
    rows.forEach(r => {
      const wrapped = wrapText(r, 74);
      wrapped.forEach(wr => {
        console.log(drawBoxRow(wr, ui.theme.success, 78));
      });
    });
    console.log(drawBoxFooter(ui.theme.success, 78));
  },

  printSafetyAlert(result, message) {
    const rows = [];
    rows.push(ui.theme.error.bold('SECURITY THREAT DETECTED AND BLOCKED'));
    rows.push(ui.theme.text(`Message:    `) + ui.theme.secondary(`"${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`));
    rows.push(ui.theme.text(`Severity:   `) + ui.theme.error.bold(result.severity));
    rows.push(ui.theme.text(`Threat:     `) + ui.theme.warning.bold(result.reasons.join(', ')));
    rows.push(ui.theme.text(`Action:     `) + ui.theme.error.bold(result.action.toUpperCase()));

    console.log('');
    console.log(drawBoxHeader('🚨 SAFETY SHIELD', ui.theme.error, 78));
    rows.forEach(r => {
      const wrapped = wrapText(r, 74);
      wrapped.forEach(wr => {
        console.log(drawBoxRow(wr, ui.theme.error, 78));
      });
    });
    console.log(drawBoxFooter(ui.theme.error, 78));
    console.log('');
  },

  printError(message) {
    console.log(ui.theme.error.bold('\n✗ [ERROR] ') + ui.theme.error(message));
  },

  printDebug(message) {
    if (currentLevel <= logLevel.DEBUG) {
      console.log(ui.theme.secondary.bold('[DEBUG] ') + ui.theme.secondary(message));
    }
  },

  printInfo(message) {
    if (currentLevel <= logLevel.INFO) {
      console.log(ui.theme.secondary('[INFO] ') + message);
    }
  },

  printSuccess(message) {
    console.log(ui.theme.success.bold('✔ ') + ui.theme.success(message));
  },

  printWarning(message) {
    if (currentLevel <= logLevel.WARN) {
      console.log(ui.theme.warning.bold('[WARN] ') + ui.theme.warning(message));
    }
  },

  createSpinner(text) {
    const spinnerColors = {
      classic: 'cyan',
      dracula: 'magenta',
      cyberpunk: 'yellow',
      nord: 'blue',
      matrix: 'green',
      sunset: 'red'
    };
    const spinnerColor = spinnerColors[activeThemeName] || 'cyan';
    const spinner = ora({ text, color: spinnerColor, discardStdin: false }).start();
    return {
      start() { return this; },
      stop() { spinner.stop(); },
      succeed(text) { spinner.succeed(text); },
      fail(text) { spinner.fail(text); }
    };
  },

  logRequest(model, messagesCount) {
    this.printInfo(`[API] Sending request to model: ${model} | Messages: ${messagesCount}`);
  },

  logResponse(model, toolCalls) {
    this.printInfo(`[API] Response received from: ${model} | Tool calls: ${toolCalls ? toolCalls.length : 0}`);
  },

  logToolExecution(toolName, duration) {
    this.printDebug(`[EXEC] Tool '${toolName}' completed in ${duration}ms`);
  },

  logHistoryCleared() {
    this.printInfo('[HISTORY] Conversation history cleared');
  },

  logSessionStart() {
    this.printInfo('[SESSION] NEX AI session started');
    this.printInfo('[SESSION] Working directory: ' + process.cwd());
  },

  logSessionEnd() {
    this.printInfo('[SESSION] NEX AI session ended');
  },

  logMemoryAction(action, details) {
    this.printInfo(`[MEMORY] ${action}: ${details}`);
  }
};

export { currentLevel, logLevel };
