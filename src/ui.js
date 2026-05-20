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

export function formatAIResponse(text) {
  if (!text) return text;
  
  // Replace ```json { ... } ``` or ``` { ... } ``` with beautifully formatted JSON
  const jsonBlockRegex = /```(json)?\s*([\s\S]*?)\s*```/g;
  let formatted = text.replace(jsonBlockRegex, (match, lang, code) => {
    try {
      const parsed = JSON.parse(code.trim());
      const pretty = JSON.stringify(parsed, null, 2);
      
      const header = drawBoxHeader('JSON RESPONSE', chalk.cyan, 78);
      const rows = pretty.split('\n').flatMap(line => {
        const wrapped = wrapText(line, 74);
        return wrapped.map(wl => drawBoxRow(wl, chalk.cyan, 78));
      }).join('\n');
      const footer = drawBoxFooter(chalk.cyan, 78);
      
      return `\n${header}\n${rows}\n${footer}`;
    } catch (e) {
      return match;
    }
  });

  return formatted;
}

export const ui = {
  showBanner() {
    const l1 = chalk.hex('#FF007F').bold('  ███╗   ██╗███████╗██╗  ██╗     █████╗ ██╗');
    const l2 = chalk.hex('#D100F3').bold('  ████╗  ██║██╔════╝╚██╗██╔╝    ██╔══██╗██║');
    const l3 = chalk.hex('#A020F0').bold('  ██╔██╗ ██║█████╗   ╚███╔╝     ███████║██║');
    const l4 = chalk.hex('#6A0DAD').bold('  ██║╚██╗██║██╔══╝   ██╔██╗     ██╔══██║██║');
    const l5 = chalk.hex('#0080FF').bold('  ██║ ╚████║███████╗██╔╝ ██╗    ██║  ██║██║');
    const l6 = chalk.hex('#00FFFF').bold('  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝    ╚═╝  ╚═╝╚═╝');

    console.log(`\n${l1}\n${l2}\n${l3}\n${l4}\n${l5}\n${l6}`);
    console.log(chalk.hex('#00E5FF').bold('  ═══════════════════════════════════════════'));
    console.log(chalk.hex('#00FFCC').bold('   Terminal AI Coding Agent  |  Active & Ready'));
    console.log(chalk.gray('  ═══════════════════════════════════════════'));
    console.log(chalk.gray('   Type /help for commands, /exit to quit.\n'));
  },

  userPrompt() {
    return chalk.cyan.bold('\n> ');
  },

  printUser(message) {
    console.log(chalk.cyan.bold('[USER] ') + chalk.cyan(message));
  },

  printAI(message) {
    if (message) {
      const formatted = formatAIResponse(message);
      console.log(chalk.green.bold('[NEX AI] ') + chalk.green(formatted));
    }
  },

  printTokenUsage(usage) {
    if (!usage) return;
    const prompt = usage.promptTokens || usage.prompt_tokens || 0;
    const completion = usage.completionTokens || usage.completion_tokens || 0;
    const total = usage.totalTokens || usage.total_tokens || 0;
    console.log(
      chalk.gray(`\n  [Usage Token - Prompt: ${prompt} | Completion: ${completion} | Total: ${total}]`)
    );
  },

  printToolCall(toolName, args) {
    const rows = [];
    rows.push(chalk.yellow(`Tool:      `) + chalk.yellow.bold(toolName));
    
    if (toolName === 'run_command' && args.command) {
      rows.push(chalk.yellow(`Command:   `) + chalk.cyan(`$ ${args.command}`));
      if (args.timeoutMs) {
        rows.push(chalk.yellow(`Timeout:   `) + chalk.gray(`${args.timeoutMs}ms`));
      }
    } else if (['file_create', 'file_read', 'file_update', 'file_delete'].includes(toolName) && (args.filePath || args.path)) {
      rows.push(chalk.yellow(`File:      `) + chalk.cyan(args.filePath || args.path));
      if (args.mode) {
        rows.push(chalk.yellow(`Mode:      `) + chalk.cyan(args.mode));
      }
      if (args.content) {
        const lines = args.content.split('\n');
        rows.push(chalk.yellow(`Size:      `) + chalk.gray(`${lines.length} lines (${args.content.length} chars)`));
        rows.push(chalk.yellow(`Preview:   `));
        const previewLines = lines.slice(0, 5);
        previewLines.forEach(l => {
          rows.push(chalk.gray(`  ${l.substring(0, 70)}${l.length > 70 ? '...' : ''}`));
        });
        if (lines.length > 5) {
          rows.push(chalk.gray(`  ... and ${lines.length - 5} more lines`));
        }
      }
    } else if (toolName === 'list_directory') {
      rows.push(chalk.yellow(`Directory: `) + chalk.cyan(args.dirPath || args.path || '.'));
    } else if (toolName === 'search_files' && args.query) {
      rows.push(chalk.yellow(`Search:    `) + chalk.cyan(`"${args.query}"`));
      rows.push(chalk.yellow(`Directory: `) + chalk.cyan(args.dirPath || args.path || '.'));
      if (args.fileExtension) {
        rows.push(chalk.yellow(`Extension: `) + chalk.cyan(args.fileExtension));
      }
    } else if (toolName.startsWith('memory_')) {
      if (args.key) rows.push(chalk.yellow(`Key:       `) + chalk.cyan(args.key));
      if (args.value) rows.push(chalk.yellow(`Value:     `) + chalk.cyan(args.value));
      if (args.query) rows.push(chalk.yellow(`Query:     `) + chalk.cyan(args.query));
      if (args.insight) rows.push(chalk.yellow(`Insight:   `) + chalk.cyan(args.insight));
    } else {
      rows.push(chalk.yellow(`Arguments: `));
      for (const [key, value] of Object.entries(args || {})) {
        if (typeof value === 'string' && value.includes('\n')) {
          rows.push(chalk.cyan(`  ${key}: `) + chalk.gray(`(multi-line string, ${value.length} chars)`));
          const lines = value.split('\n');
          lines.slice(0, 5).forEach(l => {
            rows.push(chalk.gray(`    ${l.substring(0, 66)}${l.length > 66 ? '...' : ''}`));
          });
          if (lines.length > 5) {
            rows.push(chalk.gray(`    ... and ${lines.length - 5} more lines`));
          }
        } else if (typeof value === 'object' && value !== null) {
          rows.push(chalk.cyan(`  ${key}: `));
          JSON.stringify(value, null, 2).split('\n').forEach(l => {
            rows.push(chalk.gray(`    ${l}`));
          });
        } else {
          rows.push(chalk.cyan(`  ${key}: `) + chalk.white(value));
        }
      }
    }
    
    console.log('');
    console.log(drawBoxHeader('⚙️  TOOL CALL', chalk.yellow, 78));
    rows.forEach(r => {
      const wrapped = wrapText(r, 74);
      wrapped.forEach(wr => {
        console.log(drawBoxRow(wr, chalk.yellow, 78));
      });
    });
    console.log(drawBoxFooter(chalk.yellow, 78));
  },

  printToolResult(toolName, result) {
    const rows = [];
    rows.push(chalk.green(`Source:    `) + chalk.green.bold(toolName));

    try {
      const parsed = JSON.parse(result);
      
      if (toolName === 'run_command') {
        const status = parsed.success ? chalk.green.bold('SUCCESS') : chalk.red.bold('FAILED');
        rows.push(chalk.green(`Status:    `) + status);
        
        if (parsed.stdout && parsed.stdout.trim()) {
          rows.push(chalk.green(`Stdout:    `));
          const lines = parsed.stdout.split('\n');
          const previewLines = lines.slice(0, 10);
          previewLines.forEach(l => {
            rows.push(chalk.white(`  ${l.substring(0, 70)}${l.length > 70 ? '...' : ''}`));
          });
          if (lines.length > 10) {
            rows.push(chalk.gray(`  ... and ${lines.length - 10} more lines`));
          }
        }
        if (parsed.stderr && parsed.stderr.trim()) {
          rows.push(chalk.red(`Stderr:    `));
          const lines = parsed.stderr.split('\n');
          lines.forEach(l => {
            rows.push(chalk.red(`  ${l.substring(0, 70)}`));
          });
        }
        if (parsed.error) {
          rows.push(chalk.red(`Error:     `) + chalk.red.bold(parsed.error));
        }
      } else if (toolName === 'list_directory') {
        if (parsed.success && Array.isArray(parsed.files)) {
          rows.push(chalk.green(`Contents:  `));
          parsed.files.forEach(f => {
            const prefix = f.isDir ? chalk.blue('📁 ') : chalk.gray('📄 ');
            const details = f.size !== undefined ? chalk.gray(` (${f.size} bytes)`) : '';
            rows.push(`  ${prefix}${f.name}${details}`);
          });
        } else {
          rows.push(chalk.green(`Result:    `) + chalk.white(JSON.stringify(parsed)));
        }
      } else if (toolName === 'search_files') {
        if (parsed.success && Array.isArray(parsed.matches)) {
          rows.push(chalk.green(`Matches:   `) + chalk.white(`${parsed.matches.length} found`));
          parsed.matches.slice(0, 10).forEach(m => {
            rows.push(chalk.cyan(`${m.file}:${m.line} `) + chalk.white(m.content.trim()));
          });
          if (parsed.matches.length > 10) {
            rows.push(chalk.gray(`  ... and ${parsed.matches.length - 10} more matches`));
          }
        } else {
          rows.push(chalk.green(`Result:    `) + chalk.white(JSON.stringify(parsed)));
        }
      } else {
        rows.push(chalk.green(`JSON:      `));
        const lines = JSON.stringify(parsed, null, 2).split('\n');
        lines.slice(0, 15).forEach(l => {
          rows.push(chalk.white(`  ${l}`));
        });
        if (lines.length > 15) {
          rows.push(chalk.gray(`  ... truncated (${lines.length - 15} more lines)`));
        }
      }
    } catch (e) {
      const lines = result.split('\n');
      const previewLines = lines.slice(0, 10);
      rows.push(chalk.green(`Output:    `));
      previewLines.forEach(l => {
        rows.push(chalk.white(`  ${l.substring(0, 70)}${l.length > 70 ? '...' : ''}`));
      });
      if (lines.length > 10) {
        rows.push(chalk.gray(`  ... and ${lines.length - 10} more lines`));
      }
    }

    console.log(drawBoxHeader('✓ TOOL RESULT', chalk.green, 78));
    rows.forEach(r => {
      const wrapped = wrapText(r, 74);
      wrapped.forEach(wr => {
        console.log(drawBoxRow(wr, chalk.green, 78));
      });
    });
    console.log(drawBoxFooter(chalk.green, 78));
  },

  printSafetyAlert(result, message) {
    const rows = [];
    rows.push(chalk.red.bold('SECURITY THREAT DETECTED AND BLOCKED'));
    rows.push(chalk.white(`Message:    `) + chalk.gray(`"${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`));
    rows.push(chalk.white(`Severity:   `) + chalk.red.bold(result.severity));
    rows.push(chalk.white(`Threat:     `) + chalk.yellow.bold(result.reasons.join(', ')));
    rows.push(chalk.white(`Action:     `) + chalk.red.bold(result.action.toUpperCase()));

    console.log('');
    console.log(drawBoxHeader('🚨 SAFETY SHIELD', chalk.red, 78));
    rows.forEach(r => {
      const wrapped = wrapText(r, 74);
      wrapped.forEach(wr => {
        console.log(drawBoxRow(wr, chalk.red, 78));
      });
    });
    console.log(drawBoxFooter(chalk.red, 78));
    console.log('');
  },

  printError(message) {
    console.log(chalk.red.bold('\n✗ [ERROR] ') + chalk.red(message));
  },

  printDebug(message) {
    if (currentLevel <= logLevel.DEBUG) {
      console.log(chalk.blue.bold('[DEBUG] ') + chalk.blue(message));
    }
  },

  printInfo(message) {
    if (currentLevel <= logLevel.INFO) {
      console.log(chalk.gray('[INFO] ') + message);
    }
  },

  printSuccess(message) {
    console.log(chalk.green.bold('✔ ') + chalk.green(message));
  },

  printWarning(message) {
    if (currentLevel <= logLevel.WARN) {
      console.log(chalk.yellow.bold('[WARN] ') + chalk.yellow(message));
    }
  },

  createSpinner(text) {
    const spinner = ora({ text, color: 'gray', discardStdin: false }).start();
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
