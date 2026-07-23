import { readFile } from 'node:fs/promises';
import {
  getActivationStatus,
  hashActivationCode,
  isActivationCodeFormatValid,
  normalizeActivationCode,
} from '../lib/activation-store.js';

const sourceFile = process.argv[2];
const expectedUses = Number(process.argv[3] ?? 6);

if (!sourceFile) {
  throw new Error('请提供本地原始激活码文件路径');
}

const content = await readFile(sourceFile, 'utf8');
const code = content
  .split(/\r?\n/)
  .map(normalizeActivationCode)
  .find(isActivationCodeFormatValid);

if (!code) {
  throw new Error('文件中没有找到符合格式的激活码');
}

const status = await getActivationStatus(hashActivationCode(code));

if (!status.valid || status.remainingUses !== expectedUses) {
  throw new Error(
    `数据库响应异常：valid=${status.valid}, remainingUses=${status.remainingUses}`,
  );
}

console.log('Supabase connection OK');
console.log(`Activation lookup OK; remaining uses: ${status.remainingUses}`);
