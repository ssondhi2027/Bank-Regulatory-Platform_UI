import { config } from "./config.mjs";
import { HttpError } from "./http.mjs";

/**
 * A raw fetch call rather than the @google/generative-ai SDK — this is a
 * single REST call with no streaming or chat state, so a dependency for it
 * would outweigh what it buys.
 */
export async function generateText(prompt) {
  const { apiKey, model } = config.gemini;
  if (!apiKey) throw new HttpError(503, "AI insights are not configured.");

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      // This model spends a large, variable chunk of maxOutputTokens on
      // invisible "thinking" before the visible answer — thinkingBudget: 0
      // to disable that outright gets rejected as invalid for this model, so
      // the only lever left is a ceiling generous enough to survive it.
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Rate limits and quota errors land here too — surface as a 503 rather
    // than a 500, since the rest of the app doesn't depend on this working.
    console.error(JSON.stringify({ event: "gemini_error", status: res.status, body }));
    throw new HttpError(503, "AI insights are temporarily unavailable.");
  }

  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new HttpError(503, "AI insights are temporarily unavailable.");
  return text.trim();
}
