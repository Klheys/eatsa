exports.handler = async (event) => {
  const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST", "Content-Type": "application/json" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  const API_KEY = process.env.GROQ_API_KEY;
  if (!API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: "GROQ_API_KEY manquante. Va dans Netlify > Site settings > Environment variables." }) };

  try {
    const body = JSON.parse(event.body);
    const messages = [];
    if (body.system) messages.push({ role: "system", content: body.system });

    let hasImage = false;
    for (const msg of (body.messages || [])) {
      if (Array.isArray(msg.content)) {
        const parts = [];
        for (const part of msg.content) {
          if (part.type === "text") { parts.push({ type: "text", text: part.text }); }
          else if (part.type === "image") { hasImage = true; parts.push({ type: "image_url", image_url: { url: "data:" + part.source.media_type + ";base64," + part.source.data } }); }
        }
        messages.push({ role: msg.role, content: parts });
      } else {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // gpt-oss-120b pour le texte (remplace llama-3.3-70b deprecated), vision model pour les images
    const model = hasImage ? "meta-llama/llama-4-scout-17b-16e-instruct" : "openai/gpt-oss-120b";

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + API_KEY },
      body: JSON.stringify({ model, max_tokens: body.max_tokens || 600, messages, temperature: 0.7 })
    });

    const data = await res.json();
    if (data.error) {
      // Fallback: si le modèle principal échoue, essayer un modèle alternatif
      if (!hasImage) {
        const res2 = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + API_KEY },
          body: JSON.stringify({ model: "qwen/qwen3.6-27b", max_tokens: body.max_tokens || 600, messages, temperature: 0.7 })
        });
        const data2 = await res2.json();
        if (!data2.error && data2.choices && data2.choices[0]) {
          return { statusCode: 200, headers, body: JSON.stringify({ content: [{ type: "text", text: data2.choices[0].message.content }] }) };
        }
      }
      return { statusCode: 400, headers, body: JSON.stringify({ error: data.error.message || "Erreur Groq: " + JSON.stringify(data.error) }) };
    }

    const reply = (data.choices && data.choices[0] && data.choices[0].message) ? data.choices[0].message.content : "";
    return { statusCode: 200, headers, body: JSON.stringify({ content: [{ type: "text", text: reply }] }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur serveur: " + err.message }) };
  }
};
