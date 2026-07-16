import { applyCors, requireTeacher, rateLimit } from "./_lib.js";

// Raw passthrough. The browser already builds the multipart body (file + model +
// response_format:"text"); we forward those bytes verbatim to OpenAI, only adding the
// key server-side and returning OpenAI's reply untouched. bodyParser off so the
// multipart stream (with its boundary) reaches us intact.
export const config = { api: { bodyParser: false } };

async function readRaw(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!requireTeacher(req, res)) return;
  if (!rateLimit(req, res, { max: 20, windowMs: 60000, name: "transcribe" })) return;

  try {
    const raw = await readRaw(req);
    if (!raw.length) return res.status(400).json({ error: "No audio received" });
    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": req.headers["content-type"] || "application/octet-stream",
      },
      body: raw,
    });
    // response_format:"text" -> OpenAI replies with the plain transcript. Forward the
    // body verbatim so the browser's resp.text() parses it exactly as it did before.
    const bodyText = await r.text();
    if (!r.ok) {
      let msg = bodyText;
      try { msg = JSON.parse(bodyText).error?.message || bodyText; } catch (_) {}
      return res.status(502).json({ error: msg });
    }
    res.setHeader("Content-Type", r.headers.get("content-type") || "text/plain");
    return res.status(200).send(bodyText);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
