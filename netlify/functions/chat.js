exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée dans Netlify" }) };
  }

  try {
    const body = JSON.parse(event.body);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: body.model || "claude-sonnet-4-6",
        max_tokens: body.max_tokens || 500,
        system: body.system || "",
        messages: body.messages || []
      })
    });
    const data = await res.json();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
