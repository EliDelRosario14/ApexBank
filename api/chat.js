export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : null;
  
  if (!apiKey) {
    return res.status(200).json({ reply: "Configuration Error: GROQ_API_KEY is missing in Vercel settings." });
  }

  try {
    const { message, history, action } = req.body;

    // STEP 1: Strict System Prompts
    let systemPrompt = "";

    if (action === "generate_scenario") {
      systemPrompt = `You are a bank CUSTOMER calling support. State your problem (e.g. missing deposit, locked card, suspicious fee) in 1-2 natural sentences. 
      Do NOT act as the associate. Do NOT offer help. State your complaint directly.`;
    } 
    else if (action === "grade" || (message && message.includes("Provide the final PETR scorecard"))) {
      systemPrompt = `You are a BPO Quality Assurance Auditor evaluating a bank associate call.
      Grade the transcript on the PETR framework (Plan, Engage, Transition, Recommend).
      Output ONLY a single valid raw JSON object in this exact format with NO markdown wrapping:
      {"Plan": "8/10", "Engage": "7/10", "Transition": "9/10", "Recommend": "8/10", "Feedback": "Good customer greeting and professional handling."}`;
    } 
    else {
      systemPrompt = `CRITICAL ROLEPLAY RULE: You are strictly the BANK CUSTOMER. 
      The user is the BANK ASSOCIATE trying to help you.
      Stay in character as the customer. Keep your responses short (1-2 sentences). 
      NEVER pretend to be the bank representative. NEVER give support instructions.`;
    }

    // STEP 2: Sanitize history so only valid role/content objects pass through
    const cleanHistory = Array.isArray(history)
      ? history
          .filter(item => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
          .map(item => ({ role: item.role, content: item.content }))
      : [];

    // STEP 3: Currently active 2025 Groq Production Chat Models
    const modelsToTry = [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "deepseek-r1-distill-llama-70b"
    ];

    let errorLogs = [];

    // STEP 4: Try models in sequence
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
            ...cleanHistory,
            { role: "user", content: message || "Hello" }
          ],
          temperature: action === "grade" ? 0.1 : 0.7
        })
      });

      const data = await response.json();

      if (response.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({ reply: data.choices[0].message.content });
      }

      errorLogs.push(`[${model}: ${data.error?.message || response.statusText}]`);
    }

    return res.status(200).json({ reply: `Groq Error: ${errorLogs.join(" | ")}` });

  } catch (error) {
    return res.status(200).json({ reply: "Server Exception: " + error.message });
  }
}
