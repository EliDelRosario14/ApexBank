import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { message, history, action } = req.body;

    let systemPrompt = "";
    if (action === "generate_scenario") {
      systemPrompt = "You are a customer service scenario generator for banking. Generate a random frustrated customer issue and opening line in 2 short sentences. Do not use JSON.";
    } else {
      systemPrompt = "You are a banking customer roleplaying with an associate. Keep replies short (1-2 sentences). If the associate asks for a grade or ends the call, respond ONLY with a valid JSON object: {\"Plan\": \"8/10\", \"Engage\": \"7/10\", \"Transition\": \"9/10\", \"Recommend\": \"8/10\", \"Feedback\": \"Good job overall.\"}";
    }

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        ...(history || []),
        { role: "user", content: message }
      ],
      model: "llama-3.1-8b-instant",
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });
  } catch (error) {
    return res.status(500).json({ reply: "Error: " + error.message });
  }
}
