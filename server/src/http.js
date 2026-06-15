export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers,
    },
  });
}

export function methodNotAllowed() {
  return json({ error: { message: "Method not allowed" } }, { status: 405 });
}

export function notFound() {
  return json({ error: { message: "Not found" } }, { status: 404 });
}

export function unauthorized(message) {
  return json({ error: { message } }, { status: 401 });
}

export function tooManyRequests(message) {
  return json({ error: { message } }, {
    status: 429,
    headers: {
      "retry-after": "60",
    },
  });
}
