import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { cp, copyFile, mkdir } from 'node:fs/promises';

const execFileAsync = promisify(execFile);

await execFileAsync(process.execPath, [
  'node_modules/tailwindcss/lib/cli.js',
  '-c', 'tailwind.config.cjs',
  '-i', 'web/app.source.css',
  '-o', 'web/app.css',
  '--minify',
]);

await mkdir('web/vendor', { recursive: true });
await copyFile('node_modules/html2canvas/dist/html2canvas.min.js', 'web/vendor/html2canvas.min.js');
await copyFile('node_modules/chart.js/dist/chart.umd.js', 'web/vendor/chart.umd.js');

await mkdir('dist', { recursive: true });
await copyFile('index.html', 'dist/index.html');
await copyFile('netlify/_redirects', 'dist/_redirects');
await cp('web', 'dist/web', { recursive: true, force: true });
console.log('Static site built in dist/');
