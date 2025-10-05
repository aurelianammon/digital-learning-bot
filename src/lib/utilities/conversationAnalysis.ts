import OpenAI from "openai";
import { db } from "$lib/database.js";

/**
 * Analyze conversation context to determine if bot should engage
 * Uses GPT-4o for optimal balance of quality and cost for engagement decisions
 * Returns decision and reasoning for engagement
 */
export async function analyzeConversationEngagement(
    messages: Array<{ role: string; content: string }>,
    botName: string,
    botId?: string
): Promise<{ shouldEngage: boolean; reason: string; relevance: number }> {
    if (!botId) {
        throw new Error("Bot ID is required for conversation analysis");
    }

    try {
        // Get bot configuration
        const bot = await db.bot.findUnique({
            where: { id: botId },
            select: { openaiKey: true, model: true, context: true },
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
BOT CONTEXT:
${bot.context}

ANALYSIS CRITERIA:
- Direct mentions of the bot name
- Unanswered questions targeting the bot or general requests for help
- Conversation lulls where engagement would be valuable
- Topics the bot could meaningfully contribute to
- Whether the conversation needs assistance or guidance
- If there's a natural opportunity for the bot to add value

RESPONSE FORMAT:
Respond with a JSON object containing:
{
  "shouldEngage": true/false,
  "reason": "Brief explanation of why the bot should or shouldn't engage",
  "relevance": How relevant the engagement is to the conversation regarding the bot context (0.0-1.0)
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
            if (jsonContent.startsWith("```json")) {
                jsonContent = jsonContent
                    .replace(/^```json\s*/, "")
                    .replace(/\s*```$/, "");
            } else if (jsonContent.startsWith("```")) {
                jsonContent = jsonContent
                    .replace(/^```\s*/, "")
                    .replace(/\s*```$/, "");
            }

            const result = JSON.parse(jsonContent);
            return {
                shouldEngage: result.shouldEngage === true,
                reason: result.reason || "No reason provided",
                relevance: result.relevance || 0.0,
            };
        } catch (parseError) {
            console.error("Failed to parse AI response:", content);
            return {
                shouldEngage: false,
                reason: "Failed to parse AI analysis",
                relevance: 0.0,
            };
        }
    } catch (error) {
        console.error("Error in conversation analysis:", error);
        return {
            shouldEngage: false,
            reason: `Analysis failed: ${
                error instanceof Error ? error.message : "Unknown error"
            }`,
            relevance: 0.0,
        };
    }
}
