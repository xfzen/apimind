import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const port = process.env.PLAYWRIGHT_CDP_PORT ?? '19222';
const executableCandidates = process.env.PLAYWRIGHT_CHROME_PATH
  ? [process.env.PLAYWRIGHT_CHROME_PATH]
  : process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];
const executable = executableCandidates.find(candidate => existsSync(candidate));

if (!executable) {
  throw new Error(
    `Local Google Chrome was not found. Checked: ${executableCandidates.join(', ')}. ` +
      'Set PLAYWRIGHT_CHROME_PATH to the publisher-installed executable.'
  );
}

const profileDir = join(tmpdir(), `apimind-playwright-chrome-${process.pid}`);
const chrome = spawn(
  executable,
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking'
  ],
  { stdio: 'inherit' }
);

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  chrome.kill(signal);
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
chrome.on('error', error => {
  throw error;
});
chrome.on('exit', code => {
  rmSync(profileDir, { recursive: true, force: true });
  process.exit(code ?? 0);
});
