const axios = require('axios');

class AIService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    }

    async processMessage(userMessage, conversationHistory = [], businessData = {}) {
        if (!this.apiKey || this.apiKey === 'your-openai-api-key-here') {
            return this.getIntelligentResponse(userMessage, businessData);
        }

        try {
            const businessName = businessData.businessName || 'Virpanix Real Estate';
            const systemPrompt = `You are a friendly and professional Real Estate assistant for "${businessName}". 
            
Your personality:
- Warm, helpful, and conversational
- Use emojis to make conversations friendly
- Keep responses concise (2-3 sentences max)
- Never mention technical things like "login" or "manual setup"
- Focus on helping customers find their dream property
- Use Indian context (Lakhs, Crores) when discussing money

Your role:
- Welcome new customers warmly and introduce ${businessName}
- Help customers find properties based on their needs
- Ask about: budget, location, bedrooms, property type
- Be understanding when properties don't match their criteria`;

            const messages = [
                { role: 'system', content: systemPrompt },
                ...conversationHistory,
                { role: 'user', content: userMessage }
            ];

            const response = await axios.post(this.apiUrl, {
                model: 'gpt-3.5-turbo',
                messages: messages,
                temperature: 0.7,
                max_tokens: 150
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI Error:', error.response?.data || error.message);
            return this.getIntelligentResponse(userMessage, businessData);
        }
    }

    getIntelligentResponse(message, businessData = {}) {
        const msg = message.toLowerCase().trim();
        const businessName = businessData.businessName || 'Virpanix Real Estate';

        // Greeting detection
        const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'namaste'];
        const isGreeting = greetings.some(g => msg === g || msg.startsWith(g + ' ') || msg.startsWith(g + ','));

        if (isGreeting) {
            return `👋 Hello! Welcome to *${businessName}*! 🏠✨

I'm here to help you find your dream property. To get started, could you please tell me:

📍 Your preferred *Location*?
💰 Your *Budget* (e.g., 50 Lakhs, 2 Crore)?

Just reply with these details and I'll show you the best options! 😊`;
        }

        // Property request detection
        const propertyKeywords = ['property', 'properties', 'house', 'home', 'apartment', 'villa', 'flat', 'show', 'looking', 'need', 'want', 'search'];
        const isPropertyRequest = propertyKeywords.some(k => msg.includes(k));

        if (isPropertyRequest) {
            // This is handled by the main webhook logic
            return `Great! Let me find the best properties for you... 🔍`;
        }

        // Budget/Price inquiry
        if (msg.includes('price') || msg.includes('budget') || msg.includes('cost') || msg.includes('lakh') || msg.includes('crore')) {
            return `💰 I can help you find properties within your budget! 

What's your preferred price range? For example:
• "Properties under 50 lakhs"
• "Between 80 lakhs to 1 crore"
• "Budget is 2 crore"`;
        }

        // Location inquiry
        if (msg.includes('where') || msg.includes('location') || msg.includes('area') || msg.includes('place')) {
            return `📍 We have properties in prime locations across Bangalore!

Which area are you interested in? For example:
• Electronic City
• Whitefield  
• Koramangala
• HSR Layout
• Jayanagar

Just let me know your preferred location! 🗺️`;
        }

        // BHK/Bedrooms inquiry
        if (msg.includes('bhk') || msg.includes('bedroom') || msg.includes('bed ')) {
            return `🛏️ How many bedrooms are you looking for?

We have:
• 1 BHK Studios
• 2 BHK Apartments
• 3 BHK Homes
• 4 BHK Penthouses

Just tell me your preference!`;
        }

        // Thank you
        if (msg.includes('thank') || msg.includes('thanks')) {
            return `You're welcome! 😊 

Feel free to ask if you need any more help finding your dream property. I'm here to assist! 🏡`;
        }

        // Default helpful response
        return `I'm here to help you find the perfect property! 🏠

You can ask me:
• "Show me all properties"
• "Properties in [location]"
• "3BHK under [budget]"
• "Show villas"

Or just tell me what you're looking for, and I'll help you! 😊`;
    }

    /**
     * Extract filters from user message using intelligent parsing
     */
    async extractFilters(message) {
        const msg = message.toLowerCase();
        const filters = {};

        // Extract location (Indian cities and Bangalore areas)
        const locations = [
            'bangalore', 'bengaluru', 'mumbai', 'delhi', 'chennai', 'hyderabad', 'pune', 'kolkata', 'ahmedabad',
            'electronic city', 'whitefield', 'koramangala', 'hsr layout', 'jayanagar', 'indiranagar',
            'marathahalli', 'btm layout', 'jp nagar', 'mg road', 'brigade road', 'yelahanka', 'hebbal',
            'coimbatore', 'salem', 'madurai', 'trichy', 'mysore'
        ];

        for (const location of locations) {
            if (msg.includes(location)) {
                filters.location = location.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                break;
            }
        }

        // Extract property type
        const types = {
            'villa': 'Villa',
            'apartment': 'Apartment',
            'flat': 'Apartment',
            'penthouse': 'Penthouse',
            'studio': 'Studio',
            'commercial': 'Commercial',
            'office': 'Commercial',
            'house': 'House'
        };

        for (const [keyword, type] of Object.entries(types)) {
            if (msg.includes(keyword)) {
                filters.propertyType = type;
                break;
            }
        }

        // Extract bedrooms (1BHK, 2BHK, etc.)
        const bhkMatch = msg.match(/(\d+)\s*bhk/i);
        if (bhkMatch) {
            filters.bedrooms = parseInt(bhkMatch[1]);
        } else {
            const bedMatch = msg.match(/(\d+)\s*bed/i);
            if (bedMatch) filters.bedrooms = parseInt(bedMatch[1]);
        }

        // Extract price in Indian format (lakhs/crores)
        const croreMatch = msg.match(/(\d+\.?\d*)\s*crore/i);
        if (croreMatch) {
            filters.maxPrice = parseFloat(croreMatch[1]) * 10000000; // Convert crore to rupees
        } else {
            const lakhMatch = msg.match(/(\d+\.?\d*)\s*lakh/i);
            if (lakhMatch) {
                filters.maxPrice = parseFloat(lakhMatch[1]) * 100000; // Convert lakh to rupees
            }
        }

        // Extract "under" pricing
        const underMatch = msg.match(/(under|below|less than)\s+(\d+\.?\d*)\s*(lakh|crore)/i);
        if (underMatch) {
            const amount = parseFloat(underMatch[2]);
            const unit = underMatch[3].toLowerCase();
            filters.maxPrice = unit === 'crore' ? amount * 10000000 : amount * 100000;
        }

        // Extract "above" pricing 
        const aboveMatch = msg.match(/(above|greater than|more than)\s+(\d+\.?\d*)\s*(lakh|crore)/i);
        if (aboveMatch) {
            const amount = parseFloat(aboveMatch[2]);
            const unit = aboveMatch[3].toLowerCase();
            filters.minPrice = unit === 'crore' ? amount * 10000000 : amount * 100000;
        }

        // Extract budget range (handle "to" or "-")
        const rangeMatch = msg.match(/(\d+\.?\d*)\s*(lakh|crore)\s*(to|-)\s*(\d+\.?\d*)\s*(lakh|crore)/i);
        if (rangeMatch) {
            const minAmount = parseFloat(rangeMatch[1]);
            const minUnit = rangeMatch[2].toLowerCase();
            const maxAmount = parseFloat(rangeMatch[4]);
            const maxUnit = rangeMatch[5].toLowerCase();

            filters.minPrice = minUnit === 'crore' ? minAmount * 10000000 : minAmount * 100000;
            filters.maxPrice = maxUnit === 'crore' ? maxAmount * 10000000 : maxAmount * 100000;
        }

        return filters;
    }

    /**
     * Generate a friendly "no results" message
     */
    getNoResultsMessage(filters, businessData = {}) {
        const businessName = businessData.businessName || 'Virpanix Real Estate';

        let message = `😔 I couldn't find any properties matching`;

        const criteria = [];
        if (filters.location) criteria.push(`in *${filters.location}*`);
        if (filters.bedrooms) criteria.push(`${filters.bedrooms} BHK`);
        if (filters.propertyType) criteria.push(filters.propertyType);
        if (filters.maxPrice) {
            const crores = filters.maxPrice / 10000000;
            const lakhs = filters.maxPrice / 100000;
            const priceStr = crores >= 1 ? `₹${crores.toFixed(1)} Cr` : `₹${lakhs} Lakhs`;
            criteria.push(`under ${priceStr}`);
        }

        if (criteria.length > 0) {
            message += ` ${criteria.join(', ')}`;
        } else {
            message += ' your criteria';
        }

        message += `. 

But don't worry! Here's what I can do:

📞 *Connect you with our team* who can help you find off-market properties
📧 *Alert you* when new properties matching your needs become available  
🏠 *Show you* our current available properties

Would you like to see all our available properties? Or would you like to modify your search? 😊`;

        return message;
    }
}

module.exports = new AIService();
