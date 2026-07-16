import test from "node:test";
import assert from "node:assert/strict";
import handler, { youtubeVideoId } from "../api/youtube-meta.js";
import { mockReqRes } from "./_helpers.js";

process.env.TS_PASSCODE = "test-pass";
const PASS = { "x-ts-passcode": "test-pass" };
const OEMBED_OK = { title: "Me at the zoo", author_name: "jawed", thumbnail_url: "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg" };

// swap fetch: first call = oEmbed, later calls = thumbnail bytes
function withYouTube({ oembedStatus = 200, oembed = OEMBED_OK, thumbStatus = 200 } = {}) {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/oembed")) {
      return { ok: oembedStatus === 200, status: oembedStatus, json: async () => oembed };
    }
    return {
      ok: thumbStatus === 200, status: thumbStatus,
      headers: { get: (h) => (h.toLowerCase() === "content-type" ? "image/jpeg" : null) },
      arrayBuffer: async () => new Uint8Array([255, 216, 255]).buffer, // jpeg magic
    };
  };
  return () => { globalThis.fetch = orig; };
}

test("youtubeVideoId handles every supported URL shape", () => {
  const id = "jNQXAC9IVRw";
  for (const u of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=42s`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?si=xyz`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}`,
    `https://www.youtube.com/embed/${id}`,
  ]) assert.equal(youtubeVideoId(u), id, u);
});

test("youtubeVideoId rejects non-YouTube and junk", () => {
  for (const u of [
    "https://vimeo.com/12345",
    "https://instagram.com/p/abc",
    "https://www.youtube.com/playlist?list=PL123",
    "https://www.youtube.com/@somechannel",
    "not a url", "", null,
    "https://youtube.com.evil.com/watch?v=jNQXAC9IVRw",
  ]) assert.equal(youtubeVideoId(u), "", String(u));
});

test("rejects non-POST", async () => {
  const { req, res } = mockReqRes({ method: "GET" });
  await handler(req, res);
  assert.equal(res.statusCode, 405);
});

test("400 on a non-YouTube link", async () => {
  const { req, res } = mockReqRes({ headers: PASS, body: { url: "https://vimeo.com/1" } });
  await handler(req, res);
  assert.equal(res.statusCode, 400);
});

test("happy path returns id, title, author, thumbnail data url", async () => {
  const restore = withYouTube();
  try {
    const { req, res } = mockReqRes({ headers: PASS, body: { url: "https://youtu.be/jNQXAC9IVRw" } });
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.videoId, "jNQXAC9IVRw");
    assert.equal(res.body.title, "Me at the zoo");
    assert.equal(res.body.author, "jawed");
    assert.match(res.body.thumbnailDataUrl, /^data:image\/jpeg;base64,/);
  } finally { restore(); }
});

test("422 when embedding is disabled (oEmbed 401/403)", async () => {
  const restore = withYouTube({ oembedStatus: 401 });
  try {
    const { req, res } = mockReqRes({ headers: PASS, body: { url: "https://youtu.be/jNQXAC9IVRw" } });
    await handler(req, res);
    assert.equal(res.statusCode, 422);
    assert.match(res.body.error, /embedding/i);
  } finally { restore(); }
});

test("404 when the video is missing or private", async () => {
  const restore = withYouTube({ oembedStatus: 404 });
  try {
    const { req, res } = mockReqRes({ headers: PASS, body: { url: "https://youtu.be/jNQXAC9IVRw" } });
    await handler(req, res);
    assert.equal(res.statusCode, 404);
  } finally { restore(); }
});

test("thumbnail failure still succeeds with empty thumbnailDataUrl", async () => {
  const restore = withYouTube({ thumbStatus: 500 });
  try {
    const { req, res } = mockReqRes({ headers: PASS, body: { url: "https://youtu.be/jNQXAC9IVRw" } });
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.thumbnailDataUrl, "");
  } finally { restore(); }
});
