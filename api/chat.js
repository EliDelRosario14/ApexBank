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

    if (!modelsResponse.ok || !modelsData.data || modelsData.data.length === 0) {
      return res.status(200).json({ 
        reply: `Groq Key Error (${modelsResponse.status}): ${modelsData.error?.message || "Invalid or revoked API key."}` 
      });
    }

    // STEP 2: Filter OUT security guardrails, audio, and vision models
    const validChatModels = modelsData.data
      .map(m => m.id)
      .filter(id => {
        const lower = id.toLowerCase();
        return !lower.includes("guard") && 
               !lower.includes("whisper") && 
               !lower.includes("embed") &&
               !lower.includes("vision") &&
               !lower.includes("safetensors");
      });

    // Prioritize standard conversational models
    const preferredModels = [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "gemma2-9b-it"
    ];

    let selectedModel = preferredModels.find(p => validChatModels.includes(p)) || validChatModels[0];

    if (!selectedModel) {
      return res.status(200).json({ reply: "Error: No valid conversational models found for your key." });
    }

    // STEP 3: Setup System Prompt
    let systemPrompt = "";
    if (action === "generate_scenario") {
      systemPrompt = "You are a customer service simulator for a bank. Generate a random frustrated customer issue and opening line in 2 short sentences. Do NOT output JSON.";
    } else {
      systemPrompt = "You are a banking customer roleplaying with an associate. Keep replies short (1-2 sentences). If the associate ends the call or asks for a score, output ONLY JSON: {\"Plan\": \"8/10\", \"Engage\": \"7/10\", \"Transition\": \"9/10\", \"Recommend\": \"8/10\", \"Feedback\": \"Good greeting.\"}";
    }

    // STEP 4: Request Completion from selected Chat Model
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
        temperature: 0.7
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
