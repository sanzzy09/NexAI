import readline from 'readline';
import ora from 'ora';

console.log('[TEST4] Starting REPL test...');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

rl.prompt();

rl.on('line', async (line) => {
  const input = line.trim();
  console.log('[TEST4] Received input:', input);
  
  if (input === 'quit') {
    console.log('[TEST4] Exiting...');
    process.exit(0);
  }
  
  const spinner = ora('Thinking...').start();
  await new Promise(r => setTimeout(r, 1000));
  spinner.stop();
  
  console.log("[TEST4] AI: Hey!");
  rl.prompt();
}).on('close', () => {
  console.log('[TEST4] Session closed');
  process.exit(0);
});
