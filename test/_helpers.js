// Minimal stand-ins for Vercel's (req, res). res records what the handler set so a
// test can assert on statusCode / body / headers.
export function mockReqRes({ method = "POST", headers = {}, body = {} } = {}) {
  const req = { method, headers, body };
  const res = {
    statusCode: 0, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
    send(o) { this.body = o; return this; },
    end() { return this; },
  };
  return { req, res };
}
