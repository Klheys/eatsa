exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST" }, body: "" };
  }
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  const API_KEY = process.env.GROQ_API_KEY;
  if (!API_KEY) return { statusCode: 500, body: JSON.stringify({ error: "GROQ_API_KEY non configurée" }) };
  try {
    const body = JSON.parse(event.body);
    const messages = [];
    if (body.system) messages.push({ role: "system", content: body.system });
    for (const msg of (body.messages || [])) {
      if (Array.isArray(msg.content)) {
        const parts = [];
        for (const part of msg.content) {
          if (part.type === "text") parts.push({ type: "text", text: part.text });
          else if (part.type === "image") parts.push({ type: "image_url", image_url: { url: "data:" + part.source.media_type + ";base64," + part.source.data } });
        }
        messages.push({ role: msg.role, content: parts });
      } else messages.push({ role: msg.role, content: msg.content });
    }
    const hasImage = JSON.stringify(messages).includes("image_url");
    const model = hasImage ? "llama-3.2-90b-vision-preview" : "llama-3.3-70b-versatile";
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + API_KEY },
      body: JSON.stringify({ model, max_tokens: body.max_tokens || 500, messages, temperature: 0.7 })
    });
    const data = await res.json();
    if (data.error) return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: data.error.message }) };
    const reply = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ content: [{ type: "text", text: reply }] }) };
  } catch (err) { return { statusCode: 500, body: JSON.stringify({ error: err.message }) }; }
};
