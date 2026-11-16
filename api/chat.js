export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : null;
  
  if (!apiKey) {
    return res.status(200).json({ reply: "Configuration Error: GROQ_API_KEY is not set in Vercel Environment Variables." });
  }

  try {
    const { message, history, action } = req.body;

    // STEP 1: Fetch active models dynamically
    const modelsResponse = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });

    const modelsData = await modelsResponse.json();

    if (!modelsResponse.ok || !modelsData.data) {
      return res.status(200).json({ 
        reply: `Groq Key Error: ${modelsData.error?.message || "Invalid API Key."}` 
      });
    }

    // Filter ONLY standard Meta Llama / Gemma text chat models
    const validChatModels = modelsData.data
      .map(m => m.id)
      .filter(id => {
        const lower = id.toLowerCase();
        return (lower.includes("llama") || lower.includes("gemma") || lower.includes("mixtral")) &&
               !lower.includes("guard") && 
               !lower.includes("whisper") && 
               !lower.includes("vision") &&
               !lower.includes("orpheus") &&
               !lower.includes("canopylabs");
      });

    const preferredModels = [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "gemma2-9b-it"
    ];

    let selectedModel = preferredModels.find(p => validChatModels.includes(p)) || validChatModels[0] || "llama-3.1-8b-instant";

    // STEP 2: Strict Prompts for Roleplay & Grading
    let systemPrompt = "";

    if (action === "generate_scenario") {
      systemPrompt = `You are a bank CUSTOMER calling support. State your issue in 1-2 natural sentences. 
      Do NOT act as the bank associate. Do NOT give advice. State a problem like a missing payment, unknown fee, or locked app.`;
    } 
    else if (action === "grade" || message.includes("Provide the final PETR scorecard")) {
      systemPrompt = `You are a BPO Quality Assurance Manager evaluating the Bank Associate.
      Evaluate their call based on the PETR framework (Plan, Engage, Transition, Recommend).
      Output ONLY a valid JSON object in this exact structure with no extra text:
      {"Plan": "8/10", "Engage": "7/10", "Transition": "9/10", "Recommend": "8/10", "Feedback": "Constructive feedback here."}`;
    } 
    else {
      systemPrompt = `CRITICAL INSTRUCTION: You are ONLY the BANK CUSTOMER on the phone.
      The human user is the BANK ASSOCIATE helping you. 
      Remain in character as the customer. Keep replies short (1-2 sentences).
      NEVER give customer support advice. NEVER pretend to be the agent. Answer their questions or state your concerns as a customer.`;
    }

    // STEP 3: Request AI Response
    const chatResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...(Array.isArray(history) ? history : []),
          { role: "user", content: message || "Hello" }
        ],
        temperature: action === "grade" ? 0.2 : 0.7
      })
    });

    const chatData = await chatResponse.json();

    if (chatResponse.ok && chatData.choices?.[0]?.message?.content) {
      return res.status(200).json({ reply: chatData.choices[0].message.content });
    }

    return res.status(200).json({ reply: `Groq Error (${selectedModel}): ${chatData.error?.message || "Failed to generate response."}` });

  } catch (error) {
    return res.status(200).json({ reply: "Server Exception: " + error.message });
  }
}
