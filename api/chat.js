// api/chat.js
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  try {
    const { message, history, action } = req.body;
    
    // ... rest of your logic ...
    
    const completion = await groq.chat.completions.create({
        messages: [
            { role: "system", content: "You are a banking customer." },
            ...history,
            { role: "user", content: message }
        ],
        model: "llama3-8b-8192",
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });
  } catch (error) {
    return res.status(500).json({ reply: "Error: " + error.message });
  }
}
