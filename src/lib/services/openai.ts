import OpenAI from "openai";
import { db } from "$lib/database.js";

export async function createChatCompletion(
    messages: Array<{ role: string; content: string }>,
    botId?: string
) {
    // console.log("Creating chat completion", messages, botId);
    try {
        // Get bot-specific context, API key, and model from database
        let context: Array<{ role: "system"; content: string }> = [];
        let apiKey: string | null = null;
        let model: string = "gpt-4-1106-preview"; // default model

        if (botId) {
            const bot = await db.bot.findUnique({
                where: { id: botId },
                select: { context: true, openaiKey: true, model: true },
            });

            if (bot?.context) {
                context = [{ role: "system" as const, content: bot.context }];
            }

            // Use bot-specific API key - required, no fallback
            apiKey = bot?.openaiKey || null;

            // Use bot-specific model or default
            model = bot?.model || "gpt-4-1106-preview";
        }

        // Return error if no API key is available
        if (!apiKey) {
            throw new Error("No OpenAI API key configured for this bot");
        }

        // Create OpenAI instance with bot-specific API key
        const openai = new OpenAI({
            apiKey: apiKey,
        });

        const chat = await openai.chat.completions.create({
            model: model,
            messages: [...context, ...messages] as any,
            functions: [
                {
                    name: "getStaffInfo",
                    description: "Get the contact info of a staff member",
                    parameters: {
                        type: "object",
                        properties: {
                            staffPosition: {
                                type: "string",
                                description:
                                    'The position of the desired staff member. E.g. "author" or "owner"',
                            },
                        },
                        required: ["staffPosition"],
                    },
                },
            ],
            function_call: "auto",
        });

        let answer = chat.choices[0].message?.content;
        const wantsToUseFunction =
            chat.choices[0].finish_reason === "function_call";

        if (wantsToUseFunction) {
            const functionToUse = chat.choices[0].message?.function_call;
            let dataToReturn = {};

            if (functionToUse?.name === "getStaffInfo") {
                const args = JSON.parse(functionToUse.arguments);
                dataToReturn = getStaffInfo(args.staffPosition);
            }

            // New completion API call
            const chatWithFunction = await openai.chat.completions.create({
                model: model,
                messages: [
                    ...context,
                    ...messages,
                    {
                        role: "function" as const,
                        name: functionToUse?.name || "",
                        content: JSON.stringify(dataToReturn),
                    },
                ] as any,
            });

            answer = chatWithFunction.choices[0].message?.content;
        }

        return answer;
    } catch (error) {
        console.error("Error creating chat completion:", error);
        throw error;
    }
}

export async function createImage(prompt: string, botId?: string) {
    try {
        // Get bot-specific API key from database
        let apiKey: string | null = null;

        if (botId) {
            const bot = await db.bot.findUnique({
                where: { id: botId },
                select: { openaiKey: true },
            });

            // Use bot-specific API key - required, no fallback
            apiKey = bot?.openaiKey || null;
        }

        // Return error if no API key is available
        if (!apiKey) {
            throw new Error("No OpenAI API key configured for this bot");
        }

        // Create OpenAI instance with bot-specific API key
        const openai = new OpenAI({
            apiKey: apiKey,
        });

        const response = await openai.images.generate({
            prompt: prompt,
            n: 1,
            size: "512x512",
        });

        return response.data?.[0]?.url || "";
    } catch (error) {
        console.error("Error creating image:", error);
        throw error;
    }
}

// Helper function for staff info
function getStaffInfo(staffPosition: string) {
    switch (staffPosition) {
        case "author":
            return {
                name: "Rebecca",
                email: "rebecca@company.com",
            };
        case "owner":
            return {
                name: "Josh",
                email: "josh@company.com",
            };
        default:
            return {
                name: "No name found",
                email: "Not found",
            };
    }
}

/**
 * Analyze conversation context to determine if bot should engage
 * Uses GPT-4o for optimal balance of quality and cost for engagement decisions
 * Returns decision and reasoning for engagement
 */
export async function analyzeConversationEngagement(
    messages: Array<{ role: string; content: string }>,
    botName: string,
    botId?: string
): Promise<{ shouldEngage: boolean; reason: string }> {
    if (!botId) {
        throw new Error("Bot ID is required for conversation analysis");
    }

    try {
        // Get bot configuration
        const bot = await db.bot.findUnique({
            where: { id: botId },
            select: { openaiKey: true, model: true },
        });

        if (!bot?.openaiKey) {
            throw new Error("No OpenAI API key configured for this bot");
        }

        // Create OpenAI instance with bot-specific key
        const openai = new OpenAI({
            apiKey: bot.openaiKey,
        });

        // Prepare conversation context for analysis
        const conversationContext = messages
            .slice(-8) // Last 8 messages for context
            .map((msg) => `${msg.role}: ${msg.content}`)
            .join("\n");

        const analysisPrompt = `You are a conversation analysis agent. Your job is to determine if a bot named "${botName}" should engage in this conversation.

CONVERSATION CONTEXT:
${conversationContext}

ANALYSIS CRITERIA:
- Direct mentions of the bot name
- Unanswered questions or requests for help
- Conversation lulls where engagement would be valuable
- Topics the bot could meaningfully contribute to
- Whether the conversation needs assistance or guidance
- If there's a natural opportunity for the bot to add value

RESPONSE FORMAT:
Respond with a JSON object containing:
{
  "shouldEngage": true/false,
  "reason": "Brief explanation of why the bot should or shouldn't engage"
}

Be concise but specific in your reasoning. Consider the conversation flow, timing, and context.`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o", // Use GPT-4o for better engagement analysis quality
            messages: [
                {
                    role: "system",
                    content:
                        "You are a conversation analysis agent. Respond with ONLY valid JSON - no markdown formatting, no code blocks, just pure JSON.",
                },
                {
                    role: "user",
                    content: analysisPrompt,
                },
            ],
            temperature: 0.3,
            max_tokens: 200, // Allow for more detailed reasoning with GPT-4o
            response_format: { type: "json_object" }, // Ensure JSON response
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error("No response from OpenAI");
        }

        // Parse the JSON response (handle markdown-wrapped JSON)
        try {
            // Remove markdown code blocks if present
            let jsonContent = content.trim();
            if (jsonContent.startsWith('```json')) {
                jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (jsonContent.startsWith('```')) {
                jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            
            const result = JSON.parse(jsonContent);
            return {
                shouldEngage: result.shouldEngage === true,
                reason: result.reason || "No reason provided",
            };
        } catch (parseError) {
            console.error("Failed to parse AI response:", content);
            return {
                shouldEngage: false,
                reason: "Failed to parse AI analysis",
            };
        }
    } catch (error) {
        console.error("Error in conversation analysis:", error);
        return {
            shouldEngage: false,
            reason: `Analysis failed: ${
                error instanceof Error ? error.message : "Unknown error"
            }`,
        };
    }
}
