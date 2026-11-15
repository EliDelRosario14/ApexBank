import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const { message, history, action } = req.body;

    let systemPrompt = "";

    // SCENARIO 1: Generate a random banking problem for the customer
    if (action === "generate_scenario") {
        systemPrompt = `You are a scenario generator for bank customer service training. 
        Generate a random banking customer persona and problem. 
        Include: Customer Name, Emotion (e.g., angry, panicked, confused), and their Issue (e.g., locked out of mobile app, suspicious overseas transaction, forgot PIN while traveling).
        Output ONLY the opening line the customer says when they call in. Keep it to 2 sentences.`;
    } 
    // SCENARIO 2: Normal conversation or PETR grading
    else {
        systemPrompt = `You are a bank customer roleplaying with a customer service associate. 
        Stay in character based on the scenario established in the conversation. Keep responses under 3 sentences.
        If the associate ends the call or asks for a grade, evaluate them using the PETR framework (Plan, Engage, Transition, Recommend).
        Output ONLY a valid JSON object in this exact format:
        {"Plan": "X/10", "Engage": "X/10", "Transition": "X/10", "Recommend": "X/10", "Feedback": "Short summary of agent performance."}`;
    }

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                ...history,
                { role: "user", content: message }
            ],
            model: "llama3-8b-8192",
        });

        res.status(200).json({ reply: completion.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ reply: "Error connecting to AI brain." });
    }
}
