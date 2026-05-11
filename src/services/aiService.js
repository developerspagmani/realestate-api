const axios = require('axios');

/**
 * Generate AI response using Google Gemini API
 * @param {Array} messages - Chat history
 * @param {String} context - Property/Tenant context
 */
const generateAIResponse = async (messages, context = "", aiConfig = {}) => {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey.includes('your-')) {
        throw new Error('AI Service not configured. Please add GOOGLE_API_KEY to .env');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // Format messages for Gemini (Llama style to Gemini style)
    // Gemini roles: 'user' and 'model'
    const contents = messages.map(m => ({
        role: m.role === 'bot' || m.role === 'system' ? 'model' : 'user',
        parts: [{ text: m.text }]
    }));

    const botName = aiConfig.aiName || "Virpa";
    const personality = aiConfig.aiPersonality || "Professional, helpful, and slightly enthusiastic.";
    const guidelines = aiConfig.aiGuidelines || "Only provide information based on property context. If details are missing, ask them to book a viewing.";

    const systemPrompt = `You are "${botName}", a premium real estate AI assistant.
Current Platform Context: ${context}
    
IMPORTANT RULES:
1. Tone: ${personality}
2. Rules: ${guidelines}
3. Conversion: Help users find the right property and capture their interest.

FORMATTING (always follow):
- Use **bold** for property names, prices, and key highlights.
- Use bullet points (- item) for features or amenities.
- Keep responses concise and mobile-friendly.
- When listing a property, use this format exactly:
  [Property 1] Property Title
    Location: City, Area
    Price: Amount
    Rooms: X Bedrooms, Y Bathrooms
    Size: Area sqft
    Amenities: Amenity1, Amenity2

REAL ACTIONS (critical):
When a user wants to perform a real action, append ONE action tag at the END of your response:
- User says "send to my email / send details to email@example.com":
  Append: [ACTION:SEND_EMAIL|email=user@example.com|propertyTitle=Property Name]
- User says "book a visit / schedule a viewing":
  Append: [ACTION:BOOK_VISIT|propertyTitle=Property Name]
- User says "compare [Property A] and [Property B]":
  Append: [ACTION:COMPARE_PROPERTIES|property1=Title 1|property2=Title 2]

Never fabricate actions. Only add an action tag if the user clearly requested that specific action.
Never say you've sent an email or created a booking without the action tag — the system handles that.`;

    const payload = {
        contents: contents,
        systemInstruction: {
            role: 'user',
            parts: [{ text: systemPrompt }]
        },
        generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 256,
        }
    };

    try {
        const response = await axios.post(url, payload);
        const botText = response.data.candidates[0].content.parts[0].text;
        return botText;
    } catch (error) {
        console.error('Gemini API Error:', error.response?.data || error.message);
        if (error.response?.status === 401 || error.response?.status === 403) {
            throw new Error('Invalid API Key for AI service.');
        }
        throw new Error('The AI assistant is having trouble thinking right now. Please try again in a moment.');
    }
};

module.exports = { generateAIResponse };
