// api/chat.js
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  try {
    const { message, history, action } = req.body;
    
    // ... rest of your logic ...
    
    const completion = await groq.chat.completions.create({
    messages: [ ... ],
    model: "llama-3.1-8b-instant", // Update this line
});

    return res.status(200).json({ reply: completion.choices[0].message.content });
  } catch (error) {
    return res.status(500).json({ reply: "Error: " + error.message });
  }
}
