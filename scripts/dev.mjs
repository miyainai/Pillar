// Start the demo frontend and API together without Replit's routing layer.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
const apiPort = process.env.PILLAR_API_PORT || '8080';
const webPort = process.env.PILLAR_WEB_PORT || '5173';
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}

function start(name, env) {
  const child = spawn('pnpm', ['--filter', name, 'run', 'dev'], {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: process.platform === 'win32',
  });
  children.push(child);
  child.on('error', (error) => { console.error(error.message); stop(1); });
  child.on('exit', (code) => { if (!stopping) stop(code ?? 1); });
}

start('@workspace/api-server', { PORT: apiPort, NODE_ENV: 'development' });
start('@workspace/pillar', {
  PORT: webPort,
  BASE_PATH: '/',
  PILLAR_API_URL: `http://127.0.0.1:${apiPort}`,
});
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
console.log(`Pillar demo: http://localhost:${webPort}`);
