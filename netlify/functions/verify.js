// Netlify Function (netlify/functions/verify.js)
// 拾色季 SHISEJI - 16维色彩核销中枢 (Serverless) - 商业版6次授权

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// 🛡️ 主理人高定后门 (无限次核销白名单)
const MASTER_KEYS = ["VIP888", "MY666", "SHISEJI2026"];

exports.handler = async (event, context) => {
    // 强制限制仅接受 POST 请求，拦截非法探针
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ valid: false, msg: '非法调用' }) };
    }

    try {
        const body = JSON.parse(event.body);
        const inputKey = body.key ? body.key.toUpperCase() : null;

        if (!inputKey) {
            return { statusCode: 400, body: JSON.stringify({ valid: false, msg: '无密钥输入' }) };
        }

        // ==========================================
        // 1. 最高优先级：主理人后门，无限畅通
        // ==========================================
        if (MASTER_KEYS.includes(inputKey)) {
            return {
                statusCode: 200,
                body: JSON.stringify({ valid: true, msg: '主理人最高权限，授权解除', remaining: '无限' })
            };
        }

        // ==========================================
        // 2. 查询 Upstash 金库
        // ==========================================
        const getUrl = `${UPSTASH_REDIS_REST_URL}/get/${inputKey}`;
        const getResponse = await fetch(getUrl, {
            headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` }
        });
        const getData = await getResponse.json();
        const status = getData.result;

        // 密钥不存在于白名单中
        if (status === null) {
             return { statusCode: 401, body: JSON.stringify({ valid: false, msg: '非法拦截：未授权的高定密钥' }) };
        }
        
        // 密钥已被彻底核销
        if (status === 'USED') {
            return { statusCode: 403, body: JSON.stringify({ valid: false, msg: '该密钥使用次数已耗尽，请联系主理人' }) };
        }

        // ==========================================
        // 3. 商业级阶梯衰减算法 (6次授权)
        // ==========================================
        let newValue;
        let remaining;

        if (status === 'VALID') {
            newValue = '5'; // 第1次使用，剩5次
            remaining = 5;
        } else if (status === '1') {
            newValue = 'USED'; // 第6次使用，彻底锁死
            remaining = 0;
        } else {
            let currentCount = parseInt(status);
            if (isNaN(currentCount) || currentCount <= 0) {
                newValue = 'USED';
                remaining = 0;
            } else {
                newValue = String(currentCount - 1); // 递减
                remaining = currentCount - 1;
            }
        }

        // 4. 执行状态覆写
        const setUrl = `${UPSTASH_REDIS_REST_URL}/set/${inputKey}/${newValue}`;
        const setResponse = await fetch(setUrl, {
             headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` }
        });
        const setData = await setResponse.json();
        
        if (setData.result === 'OK') {
            return {
                statusCode: 200,
                body: JSON.stringify({ valid: true, msg: `高定密钥验证通过`, remaining: remaining })
            };
        }
        
        return { statusCode: 500, body: JSON.stringify({ valid: false, msg: '中枢状态异常' }) };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ valid: false, msg: '数据读取异常' }) };
    }
};
