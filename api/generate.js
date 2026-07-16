import { applyCors, requireTeacher, rateLimit } from "./_lib.js";

// The three models the front-end picker offers. The client sends the chosen name;
// anything else is rejected so a tampered request can't select an arbitrary (or
// pricier) model. Keep this list in sync with the <select> in index.html.
const ALLOWED_MODELS = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"];

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!requireTeacher(req, res)) return;
  if (!rateLimit(req, res, { max: 20, windowMs: 60000, name: "generate" })) return;

  const { model, messages, response_format, max_completion_tokens, temperature } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "No messages provided" });
  }
  // The app only ever sends 2 messages (system + one user message; vision images ride
  // as content-parts inside that user message), so 20 is generous headroom, not a real
  // limit -- it just bounds per-request blast radius for a tampered caller.
  if (messages.length > 20) {
    return res.status(400).json({ error: "Too many messages" });
  }
  if (!ALLOWED_MODELS.includes(model)) {
    return res.status(400).json({ error: "Unsupported model" });
  }

  const payload = { model, messages };
  if (response_format) payload.response_format = response_format;
  // 8000 = 2x the app's largest legit request (4000 tokens); anything bigger is abuse.
  // Non-numeric input is dropped rather than forwarded. Temperature is coerced into
  // OpenAI's valid [0,2] range.
  if (max_completion_tokens !== undefined) {
    const n = Number(max_completion_tokens);
    if (Number.isFinite(n)) payload.max_completion_tokens = Math.min(Math.max(Math.trunc(n), 1), 8000);
  }
  if (temperature !== undefined) {
    const t = Number(temperature);
    if (Number.isFinite(t)) payload.temperature = Math.min(Math.max(t, 0), 2);
  }

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (data.error) return res.status(502).json({ error: data.error.message });
    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
