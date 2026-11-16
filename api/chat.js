export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : null;
  
  if (!apiKey) {
    return res.status(200).json({ reply: "Configuration Error: GROQ_API_KEY is not set in Vercel Environment Variables." });
  }

  try {
    const { message, history, action } = req.body;

    let systemPrompt = "";
    if (action === "generate_scenario") {
      systemPrompt = "You are a customer service simulator for a bank. Generate a random frustrated customer issue and your opening line in 2 sentences. Do NOT use JSON.";
    } else {
      systemPrompt = "You are a banking customer roleplaying with an associate. Keep replies short (1-2 sentences). If the associate ends the call or asks for a score, output ONLY JSON: {\"Plan\": \"8/10\", \"Engage\": \"7/10\", \"Transition\": \"9/10\", \"Recommend\": \"8/10\", \"Feedback\": \"Good greeting.\"}";
    }

    // Currently active Groq model names
    const modelsToTry = [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant"
    ];

    let lastErrorDetails = "";

    for (const model of modelsToTry) {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            ...(Array.isArray(history) ? history : []),
            { role: "user", content: message || "Hello" }
          ],
          temperature: 0.7
        })
      });

      const data = await response.json();

      if (response.ok && data.choices && data.choices[0] && data.choices[0].message) {
        return res.status(200).json({ reply: data.choices[0].message.content });
      }

      lastErrorDetails = `Status ${response.status}: ${data.error?.message || JSON.stringify(data)}`;
    }

    // If all models failed, return the exact error from Groq
    return res.status(200).json({ reply: `Groq Connection Error -> ${lastErrorDetails}` });

  } catch (error) {
    return res.status(200).json({ reply: "Server Exception: " + error.message });
  }
}
