import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/generate.js";
import { mockReqRes } from "./_helpers.js";

process.env.TS_PASSCODE = "test-pass";
process.env.OPENAI_API_KEY = "sk-test";

test("rejects non-POST", async () => {
  const { req, res } = mockReqRes({ method: "GET" });
  await handler(req, res);
  assert.equal(res.statusCode, 405);
});

test("rejects a missing passcode", async () => {
  const { req, res } = mockReqRes({ body: { model: "gpt-5.6-sol", messages: [{ role: "user", content: "hi" }] } });
  await handler(req, res);
  assert.equal(res.statusCode, 401);
});

test("rejects a wrong passcode", async () => {
  const { req, res } = mockReqRes({ headers: { "x-ts-passcode": "wrong" }, body: { model: "gpt-5.6-sol", messages: [{ role: "user", content: "hi" }] } });
  await handler(req, res);
  assert.equal(res.statusCode, 401);
});

test("rejects missing messages", async () => {
  const { req, res } = mockReqRes({ headers: { "x-ts-passcode": "test-pass" }, body: { model: "gpt-5.6-sol" } });
  await handler(req, res);
  assert.equal(res.statusCode, 400);
});

test("rejects a disallowed model", async () => {
  const { req, res } = mockReqRes({
    headers: { "x-ts-passcode": "test-pass" },
    body: { model: "gpt-99-hax", messages: [{ role: "user", content: "hi" }] },
  });
  await handler(req, res);
  assert.equal(res.statusCode, 400);
});

test("forwards an allowed model to OpenAI and returns the raw JSON", async () => {
  const origFetch = globalThis.fetch;
  let sent = null;
  globalThis.fetch = async (url, opts) => {
    sent = { url, body: JSON.parse(opts.body), auth: opts.headers.Authorization };
    return { json: async () => ({ choices: [{ message: { content: "ok" } }] }) };
  };
  try {
    const { req, res } = mockReqRes({
      headers: { "x-ts-passcode": "test-pass" },
      body: {
        model: "gpt-5.6-terra",
        messages: [{ role: "user", content: "hi" }],
        response_format: { type: "json_object" },
        max_completion_tokens: 4000,
      },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(sent.url, "https://api.openai.com/v1/chat/completions");
    assert.equal(sent.auth, "Bearer sk-test");
    assert.equal(sent.body.model, "gpt-5.6-terra");            // allowed model forwarded as-is
    assert.equal(sent.body.max_completion_tokens, 4000);
    assert.deepEqual(sent.body.response_format, { type: "json_object" });
    assert.equal(res.body.choices[0].message.content, "ok");   // returns OpenAI's shape untouched
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("clamps an over-large max_completion_tokens", async () => {
  const origFetch = globalThis.fetch;
  let sent = null;
  globalThis.fetch = async (url, opts) => { sent = JSON.parse(opts.body); return { json: async () => ({ ok: true }) }; };
  try {
    const { req, res } = mockReqRes({
      headers: { "x-ts-passcode": "test-pass" },
      body: { model: "gpt-5.6-sol", messages: [{ role: "user", content: "hi" }], max_completion_tokens: 100000 },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(sent.max_completion_tokens, 8000); // clamped down from 100000
  } finally {
    globalThis.fetch = origFetch;
  }
});
