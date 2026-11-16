export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
  if (!apiKey) return res.status(200).json({ reply: "Error: GEMINI_API_KEY missing in Vercel settings." });

  try {
    const { message, history, action } = req.body;

    let systemPrompt = "You are a bank customer calling customer service. Keep answers brief (1-2 sentences).";
    if (action === "generate_scenario") {
      systemPrompt = "State a random bank customer issue in 2 sentences. Do NOT output JSON.";
    } else if (action === "grade" || message.includes("PETR scorecard")) {
      systemPrompt = "Output ONLY JSON: {\"Plan\": \"8/10\", \"Engage\": \"7/10\", \"Transition\": \"9/10\", \"Recommend\": \"8/10\", \"Feedback\": \"Good job.\"}";
    }

    const contents = [
      { role: "user", parts: [{ text: `System Instruction: ${systemPrompt}` }] },
      ...(Array.isArray(history) ? history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })) : []),
      { role: "user", parts: [{ text: message || "Hello" }] }
    ];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents })
    });

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (replyText) return res.status(200).json({ reply: replyText });
    return res.status(200).json({ reply: "Gemini Error: " + JSON.stringify(data) });

  } catch (err) {
    return res.status(200).json({ reply: "Server Error: " + err.message });
  }
}
