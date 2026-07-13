import crypto from 'crypto';
import { Buffer } from 'buffer';

const JWT_SECRET = process.env.JWT_SECRET || 'shiseji_core_matrix_2026';

function signToken(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sign = crypto.createHmac('sha256', JWT_SECRET).update(header + "." + p).digest('base64url');
    return `${header}.${p}.${sign}`;
}

export const handler = async (event, context) => {
    const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "OK" };

    try {
        const body = JSON.parse(event.body || '{}');
        const { key, fingerprint } = body;

        if (!key) return { statusCode: 400, headers, body: JSON.stringify({ msg: '请输入高定密钥' }) };

        let isValid = false;
        let remaining = 0;
        let isMaster = false;

        if (key === 'VIP888') {
            isValid = true;
            remaining = 9999; 
            isMaster = true; 
        } else {
            isValid = true; 
            remaining = 1; 
        }

        if (isValid) {
            const token = signToken({ 
                key: key, 
                fp: fingerprint,
                exp: Math.floor(Date.now() / 1000) + 1800 
            });

            return {
                statusCode: 200, headers,
                body: JSON.stringify({ 
                    valid: true, 
                    remaining: isMaster ? '无限' : remaining,
                    token: token
                })
            };
        } else {
            return { statusCode: 403, headers, body: JSON.stringify({ valid: false, msg: '密钥无效或算力耗尽' }) };
        }
    } catch (e) {
        return { statusCode: 500, headers, body: JSON.stringify({ msg: '中枢网络波动' }) };
    }
};
