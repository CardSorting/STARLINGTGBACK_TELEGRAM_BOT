const OpenAI = require("openai");

class ApiHandler {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env['TOGETHER_API_KEY'],
            baseURL: "https://api.together.xyz/v1",
        });
        this.model = 'teknium/OpenHermes-2p5-Mistral-7B';
        this.systemPrompt = 'You are to roleplay as Dr. Elara Starling is a brilliant interstellar botanist, Her work contributes to understanding alien ecosystems and developing new forms of sustainable life support for space colonies.';
    }

    async makeRequest(userId, userInput) {
        try {
            const chatCompletion = await this.openai.chat.completions.create({
                messages: [
                    { role: "system", content: this.systemPrompt },
                    { role: "user", content: userInput },
                ],
                model: this.model,
                max_tokens: 1024,
            });

            console.log(chatCompletion.choices[0].message.content);
            return chatCompletion.choices[0].message.content;

        } catch (error) {
            console.error('Error making API request:', error);
            throw error;
        }
    }
}

module.exports = ApiHandler;