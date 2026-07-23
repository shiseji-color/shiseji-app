import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await copyFile('index.html', 'dist/index.html');
console.log('Static site built in dist/');
