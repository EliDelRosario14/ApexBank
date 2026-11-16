export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
  if (!apiKey) {
    return res.status(200).json({ reply: "Configuration Error: GEMINI_API_KEY is missing in Vercel settings." });
  }

  try {
    const { message, history, action } = req.body;

    // STEP 1: Dynamically get all working models for your API key
    const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const modelsData = await modelsRes.json();

    if (!modelsRes.ok || !modelsData.models) {
      return res.status(200).json({ 
        reply: `Gemini Key Error: ${modelsData.error?.message || "Invalid GEMINI_API_KEY. Please verify in Vercel Settings."}` 
      });
    }

    // Filter models that support content generation
    const availableChatModels = modelsData.models
      .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
      .map(m => m.name); // e.g. "models/gemini-1.5-flash"

    // Pick the best active model dynamically
    const selectedModel = availableChatModels.find(m => m.includes("flash")) || 
                          availableChatModels.find(m => m.includes("pro")) || 
                          availableChatModels[0];

    if (!selectedModel) {
      return res.status(200).json({ reply: "Error: No active Gemini chat models found for this API key." });
    }

    // STEP 2: Strict System Prompts
    let systemPrompt = "";
    if (action === "generate_scenario") {
      systemPrompt = "You are a customer service scenario generator for a bank. Generate a random frustrated customer issue and opening line in 2 short sentences. Do NOT output JSON.";
    } else if (action === "grade" || (message && message.includes("PETR scorecard"))) {
      systemPrompt = "You are a BPO Quality Assurance Auditor. Evaluate the associate on Plan, Engage, Transition, Recommend. Return ONLY a single raw JSON object: {\"Plan\": \"8/10\", \"Engage\": \"7/10\", \"Transition\": \"9/10\", \"Recommend\": \"8/10\", \"Feedback\": \"Good greeting and empathy.\"}";
    } else {
      systemPrompt = "CRITICAL ROLEPLAY RULE: You are strictly the BANK CUSTOMER on the phone. The user is the bank associate. Keep replies short (1-2 sentences). NEVER give associate/support instructions or pretend to be the bank.";
    }

    // STEP 3: Sanitize history for Gemini's strict role rules (user <-> model alternation)
    const formattedHistory = [];
    if (Array.isArray(history)) {
      history.forEach(h => {
        if (!h || !h.content) return;
        const role = h.role === 'assistant' ? 'model' : 'user';
        // Avoid consecutive duplicate roles
        if (formattedHistory.length === 0 && role === 'model') return;
        if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === role) return;
        
        formattedHistory.push({
          role: role,
          parts: [{ text: h.content }]
        });
      });
    }

    // Append current user message
    if (formattedHistory.length === 0 || formattedHistory[formattedHistory.length - 1].role !== 'user') {
      formattedHistory.push({
        role: "user",
        parts: [{ text: message || "Hello" }]
      });
    }

    // STEP 4: Send request to the selected dynamic model
    const url = `https://generativelanguage.googleapis.com/v1beta/${selectedModel}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: formattedHistory,
        generationConfig: {
          temperature: action === "grade" ? 0.1 : 0.7
        }
      })
    });

    const data = await response.json();

    if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return res.status(200).json({ reply: data.candidates[0].content.parts[0].text });
    }

    return res.status(200).json({ reply: `Gemini Error (${selectedModel}): ${data.error?.message || JSON.stringify(data)}` });

  } catch (err) {
    return res.status(200).json({ reply: "Server Exception: " + err.message });
  }
}
