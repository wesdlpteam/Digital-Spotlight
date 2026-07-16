import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/transcribe.js";

process.env.TS_PASSCODE = "test-pass";
process.env.OPENAI_API_KEY = "sk-test";

// req must be an async-iterable (stream) because bodyParser is disabled
function streamReq({ method = "POST", headers = {}, chunks = [] } = {}) {
  return {
    method, headers,
    async *[Symbol.asyncIterator]() { for (const c of chunks) yield Buffer.from(c); },
  };
}
function mockRes() {
  return {
    statusCode: 0, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
    send(o) { this.body = o; return this; },
    end() { return this; },
  };
}

test("rejects a wrong passcode", async () => {
  const res = mockRes();
  await handler(streamReq({ headers: { "x-ts-passcode": "wrong" } }), res);
  assert.equal(res.statusCode, 401);
});

test("forwards the multipart body to OpenAI and returns its transcript text", async () => {
  const origFetch = globalThis.fetch;
  let sent = null;
  globalThis.fetch = async (url, opts) => {
    sent = { url, ct: opts.headers["Content-Type"], auth: opts.headers.Authorization };
    return { ok: true, headers: { get: () => "text/plain" }, text: async () => "hello world" };
  };
  try {
    const res = mockRes();
    await handler(streamReq({
      headers: { "x-ts-passcode": "test-pass", "content-type": "multipart/form-data; boundary=xyz" },
      chunks: ["--xyz\r\nfake-audio-bytes\r\n--xyz--"],
    }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(sent.url, "https://api.openai.com/v1/audio/transcriptions");
    assert.equal(sent.auth, "Bearer sk-test");
    assert.equal(sent.ct, "multipart/form-data; boundary=xyz"); // browser's multipart forwarded verbatim
    assert.equal(res.body, "hello world");
  } finally {
    globalThis.fetch = origFetch;
  }
});
