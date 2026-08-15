import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await copyFile('index.html', 'dist/index.html');
await copyFile('netlify/_redirects', 'dist/_redirects');
console.log('Static site built in dist/');
