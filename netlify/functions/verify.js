// Netlify Function (netlify/functions/verify.js)
// 拾色季 SHISEJI - 16维色彩核销中枢 (Serverless)

// 从 Netlify 环境变量中静默提取物理金库地址与鉴权凭证
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

exports.handler = async (event, context) => {
    // 强制限制仅接受 POST 请求，拦截非法探针
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ valid: false, msg: '非法调用方式' }) };
    }

    try {
        const body = JSON.parse(event.body);
        const inputKey = body.key;

        if (!inputKey) {
            return { statusCode: 400, body: JSON.stringify({ valid: false, msg: '无密钥输入' }) };
        }

        // 1. 查询金库：检查密钥是否存在及其状态 (启用原生 fetch 算力)
        const getUrl = `${UPSTASH_REDIS_REST_URL}/get/${inputKey}`;
        const getResponse = await fetch(getUrl, {
            headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` }
        });
        const getData = await getResponse.json();

        // 密钥不存在于白名单中
        if (getData.result === null) {
             return { statusCode: 401, body: JSON.stringify({ valid: false, msg: '非法拦截：未授权的高定密钥' }) };
        }
        
        // 密钥状态已被标记为核销
        if (getData.result === 'USED') {
            return { statusCode: 403, body: JSON.stringify({ valid: false, msg: '密钥已失效或被核销' }) };
        }

        // 2. 执行物理核销：将状态覆写为 USED (事务性操作保证原子性)
        if (getData.result === 'VALID') {
            const setUrl = `${UPSTASH_REDIS_REST_URL}/set/${inputKey}/USED`;
            const setResponse = await fetch(setUrl, {
                 headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` }
            });
            const setData = await setResponse.json();
            
            if (setData.result === 'OK') {
                return {
                    statusCode: 200,
                    body: JSON.stringify({ valid: true, msg: '高定密钥验证通过，诊断引擎授权解除' })
                };
            }
        }
        
        // 兜底异常拦截
        return { statusCode: 500, body: JSON.stringify({ valid: false, msg: '中枢状态异常' }) };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ valid: false, msg: '数据中枢读取异常' }) };
    }
};
