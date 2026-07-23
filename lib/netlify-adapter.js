export function adaptVercelHandler(vercelHandler) {
  return async function netlifyHandler(event) {
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

      Promise.resolve(vercelHandler(request, response)).catch((error) => {
        console.error('Netlify function adapter failed:', error);
        statusCode = 500;
        finish({ error: '服务器暂时不可用，请稍后重试' });
      });
    });
  };
}
