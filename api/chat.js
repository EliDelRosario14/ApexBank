import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
  try {
    const { message, history, action } = req.body;
    const systemPrompt = action === "generate_scenario" 
      ? "You are a banking customer. Generate a random banking problem and your opening line. Keep it to 2 sentences."
      : "You are a bank customer. Keep responses short. If the user asks for a grade, output a JSON object with Plan, Engage, Transition, Recommend.";

    const completion = await groq.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: message }
        ],
        model: "llama-3.3-70b-versatile",
    });

    res.status(200).json({ reply: completion.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ reply: "Error: " + error.message });
  }
}
