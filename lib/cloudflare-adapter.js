export function adaptVercelHandlerForCloudflare(vercelHandler) {
  return async function cloudflareHandler(request) {
    let body = {};

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const text = await request.text();
        body = text ? JSON.parse(text) : {};
      } catch {
        return Response.json(
          { error: '请求内容不是有效 JSON' },
          { status: 400 },
        );
      }
    }

    return new Promise((resolve) => {
      let statusCode = 200;
      const headers = new Headers();
      let completed = false;

      const finish = (payload) => {
        if (completed) return;
        completed = true;
        headers.set('Content-Type', 'application/json; charset=utf-8');
        resolve(
          new Response(JSON.stringify(payload), {
            status: statusCode,
            headers,
          }),
        );
      };

      const response = {
        setHeader(name, value) {
          headers.set(name, String(value));
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

      const url = new URL(request.url);
      const cloudflareRequest = {
        method: request.method,
        headers: Object.fromEntries(request.headers),
        body,
        query: Object.fromEntries(url.searchParams),
      };

      Promise.resolve(vercelHandler(cloudflareRequest, response)).catch(
        (error) => {
          console.error('Cloudflare Pages adapter failed:', error);
          statusCode = 500;
          finish({ error: '服务器暂时不可用，请稍后重试' });
        },
      );
    });
  };
}
