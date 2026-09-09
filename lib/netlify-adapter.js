export function adaptVercelHandler(vercelHandler) {
  const resolvedHandler = resolveHandler(vercelHandler);

  return async function netlifyHandler(event) {
    if (!resolvedHandler) {
      console.error('Netlify function adapter could not resolve a request handler');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: '服务器函数配置错误，请联系管理员' }),
      };
    }

    let body = {};

    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: '请求内容不是有效JSON' }),
      };
    }

    return new Promise((resolve) => {
      let statusCode = 200;
      const headers = {};
      let completed = false;

      const finish = (payload) => {
        if (completed) return;
        completed = true;
        resolve({
          statusCode,
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      };

      const response = {
        setHeader(name, value) {
          headers[name] = value;
        },
        status(code) {
          statusCode = code;
          return response;
        },
        json(payload) {
          finish(payload);
          return response;
        },
      };

      const request = {
        method: event.httpMethod,
        headers: event.headers ?? {},
        body,
      };

      Promise.resolve(resolvedHandler(request, response)).catch(() => {
        console.error('Netlify function adapter failed:', 'handler_rejected');
        statusCode = 500;
        finish({ error: '服务器暂时不可用，请稍后重试' });
      });
    });
  };
}

function resolveHandler(candidate) {
  let current = candidate;
  const visited = new Set();

  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current);
    current = current.default;
  }

  return typeof current === 'function' ? current : null;
}
