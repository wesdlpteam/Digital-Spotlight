import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/fetch-post-media.js";
import { mockReqRes } from "./_helpers.js";

process.env.TS_PASSCODE = "test-pass";
process.env.COBALT_API_URL = "https://cobalt.test";

const PASS = { "x-ts-passcode": "test-pass" };

function withCobalt(reply, capture) {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (capture) capture({ url, opts, body: JSON.parse(opts.body) });
    return { json: async () => reply };
  };
  return () => { globalThis.fetch = orig; };
}

test("rejects non-POST", async () => {
  const { req, res } = mockReqRes({ method: "GET" });
  await handler(req, res);
  assert.equal(res.statusCode, 405);
});

test("rejects a missing passcode when locked", async () => {
  const { req, res } = mockReqRes({ body: { url: "https://youtu.be/x" } });
  await handler(req, res);
  assert.equal(res.statusCode, 401);
});

test("rejects a non-http url", async () => {
  const { req, res } = mockReqRes({ headers: PASS, body: { url: "not-a-link" } });
  await handler(req, res);
  assert.equal(res.statusCode, 400);
});

test("503 when the engine isn't configured", async () => {
  const saved = process.env.COBALT_API_URL;
  process.env.COBALT_API_URL = "";
  try {
    const { req, res } = mockReqRes({ headers: PASS, body: { url: "https://youtu.be/x" } });
    await handler(req, res);
    assert.equal(res.statusCode, 503);
  } finally { process.env.COBALT_API_URL = saved; }
});

test("tunnel response -> one video item, and forwards url + api key", async () => {
  process.env.COBALT_API_KEY = "key-123";
  const restore = withCobalt(
    { status: "tunnel", url: "https://cobalt.test/tunnel/abc", filename: "reel.mp4" },
    (c) => { globalThis.__sent = c; }
  );
  try {
    const { req, res } = mockReqRes({ headers: PASS, body: { url: "https://instagram.com/reel/abc" } });
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.items.length, 1);
    assert.deepEqual(res.body.items[0], { type: "video", url: "https://cobalt.test/tunnel/abc", filename: "reel.mp4" });
    // proxied correctly: hit "<base>/", forwarded the post url, attached the Api-Key
    assert.equal(globalThis.__sent.url, "https://cobalt.test/");
    assert.equal(globalThis.__sent.body.url, "https://instagram.com/reel/abc");
    assert.equal(globalThis.__sent.opts.headers.Authorization, "Api-Key key-123");
  } finally { restore(); delete process.env.COBALT_API_KEY; delete globalThis.__sent; }
});

test("picker response -> photos and videos, mapped by type", async () => {
  const restore = withCobalt({
    status: "picker",
    picker: [
      { type: "photo", url: "https://cobalt.test/1.jpg" },
      { type: "video", url: "https://cobalt.test/2.mp4" },
      { type: "gif", url: "https://cobalt.test/3.gif" },
    ],
  });
  try {
    const { req, res } = mockReqRes({ headers: PASS, body: { url: "https://instagram.com/p/carousel" } });
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.items.length, 3);
    assert.deepEqual(res.body.items.map((i) => i.type), ["image", "video", "image"]);
  } finally { restore(); }
});

test("classifies a tunnel image by its filename extension", async () => {
  const restore = withCobalt({ status: "redirect", url: "https://cobalt.test/pic", filename: "shot.jpg" });
  try {
    const { req, res } = mockReqRes({ headers: PASS, body: { url: "https://x.com/i/status/1" } });
    await handler(req, res);
    assert.equal(res.body.items[0].type, "image");
  } finally { restore(); }
});

test("cobalt error -> 502 with a friendly private-post message", async () => {
  const restore = withCobalt({ status: "error", error: { code: "error.api.content.post.private" } });
  try {
    const { req, res } = mockReqRes({ headers: PASS, body: { url: "https://instagram.com/p/private" } });
    await handler(req, res);
    assert.equal(res.statusCode, 502);
    assert.match(res.body.error, /private or login-only/i);
  } finally { restore(); }
});

test("local-processing -> no items, explains it was skipped", async () => {
  const restore = withCobalt({ status: "local-processing", type: "merge", tunnel: ["a", "b"] });
  try {
    const { req, res } = mockReqRes({ headers: PASS, body: { url: "https://youtu.be/highres" } });
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.items.length, 0);
    assert.match(res.body.error, /extra processing/i);
  } finally { restore(); }
});

test("caps runaway pickers at 20 items", async () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ type: "photo", url: `https://cobalt.test/${i}.jpg` }));
  const restore = withCobalt({ status: "picker", picker: many });
  try {
    const { req, res } = mockReqRes({ headers: PASS, body: { url: "https://instagram.com/p/big" } });
    await handler(req, res);
    assert.equal(res.body.items.length, 20);
  } finally { restore(); }
});

test("youtube bot-block -> honest YouTube message, not 'private'", async () => {
  const restore = withCobalt({ status: "error", error: { code: "error.api.youtube.login" } });
  try {
    const { req, res } = mockReqRes({ headers: PASS, body: { url: "https://youtu.be/x" } });
    await handler(req, res);
    assert.equal(res.statusCode, 502);
    assert.match(res.body.error, /YouTube is blocking/i);
    assert.doesNotMatch(res.body.error, /private/i);
  } finally { restore(); }
});
