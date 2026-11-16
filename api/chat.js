export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ reply: "Error: GROQ_API_KEY is missing in Vercel settings." });
  }

  try {
    const { message, history, action } = req.body;

    let systemPrompt = "";
    if (action === "generate_scenario") {
      systemPrompt = "You are a customer service training system for a bank. Generate a random frustrated customer issue and opening line in 2 short sentences. Do NOT output JSON.";
    } else {
      systemPrompt = "You are a banking customer roleplaying with a customer care associate. Keep your answers brief (1-2 sentences). If the associate ends the call or requests scores, reply ONLY with JSON: {\"Plan\": \"8/10\", \"Engage\": \"7/10\", \"Transition\": \"9/10\", \"Recommend\": \"8/10\", \"Feedback\": \"Good greeting and empathy.\"}";
    }

    // List of free Groq models to try in order if one fails
    const modelsToTry = [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "gemma2-9b-it",
      "mixtral-8x7b-32768"
    ];

    let responseData = null;
    let lastError = "";

    // Try each model until one succeeds
    for (const model of modelsToTry) {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            ...(history || []),
            { role: "user", content: message }
          ],
          temperature: 0.7
        })
      });

      const data = await response.json();

      if (response.ok && data.choices?.[0]?.message?.content) {
        responseData = data.choices[0].message.content;
        break; // Success! Exit loop.
      } else {
        lastError = data.error?.message || response.statusText;
      }
    }

    if (responseData) {
      return res.status(200).json({ reply: responseData });
    } else {
      return res.status(500).json({ reply: `API Error: ${lastError}` });
    }

  } catch (error) {
    return res.status(500).json({ reply: "Server Error: " + error.message });
  }
}
