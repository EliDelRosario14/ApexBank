export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
  if (!apiKey) {
    return res.status(200).json({ reply: "Configuration Error: GEMINI_API_KEY is not set in Vercel settings." });
  }

  try {
    const { message, history, action } = req.body;

    // STEP 1: Set strict System Prompts
    let systemPrompt = "";
    if (action === "generate_scenario") {
      systemPrompt = "You are a customer service scenario generator for a bank. Generate a random frustrated customer issue and opening line in 2 short sentences. Do NOT output JSON.";
    } else if (action === "grade" || (message && message.includes("PETR scorecard"))) {
      systemPrompt = "You are a BPO Quality Assurance Auditor. Evaluate the associate on Plan, Engage, Transition, Recommend. Return ONLY a single raw JSON object: {\"Plan\": \"8/10\", \"Engage\": \"7/10\", \"Transition\": \"9/10\", \"Recommend\": \"8/10\", \"Feedback\": \"Good greeting and customer care.\"}";
    } else {
      systemPrompt = "CRITICAL ROLEPLAY RULE: You are strictly the BANK CUSTOMER on the phone. The user is the bank associate. Keep replies short (1-2 sentences). NEVER give associate/support instructions or pretend to be the bank.";
    }

    // STEP 2: Format history for Gemini API
    const cleanHistory = Array.isArray(history)
      ? history
          .filter(h => h && h.content)
          .map(h => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content }]
          }))
      : [];

    const contents = [
      ...cleanHistory,
      { role: "user", parts: [{ text: message || "Hello" }] }
    ];

    // STEP 3: Stable Google Gemini Models to try
    const modelsToTry = [
      "gemini-1.5-flash",
      "gemini-1.5-pro"
    ];

    let lastError = "";

    for (const model of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: contents,
          generationConfig: {
            temperature: action === "grade" ? 0.1 : 0.7
          }
        })
      });

      const data = await response.json();

      if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return res.status(200).json({ reply: data.candidates[0].content.parts[0].text });
      }

      lastError = `[${model}: ${data.error?.message || response.statusText}]`;
    }

    return res.status(200).json({ reply: `Gemini Error: ${lastError}` });

  } catch (err) {
    return res.status(200).json({ reply: "Server Exception: " + err.message });
  }
}
