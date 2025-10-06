import { analyzeConversationEngagement } from "./conversationAnalysis.js";
import { formatMessagesForAI } from "./messageFormatter.js";

// Cache for AI engagement analysis to avoid excessive API calls
const engagementCache = new Map<
    string,
    { result: boolean; reason: string; timestamp: number }
>();
const CACHE_DURATION = 30000; // 30 seconds cache

/**
 * Helper function to determine if bot should respond using AI analysis
 */
export async function shouldBotRespond(
    messageText: string,
    linkedBot: any
): Promise<boolean> {
    if (!linkedBot) return false;

    // Always respond if directly mentioned (fast path)
    const directMention = new RegExp(`\\b(${linkedBot.name})\\b`, "i").test(
        messageText
    );
    if (directMention) {
        console.log(
            `🤖 Bot responding due to direct mention of "${linkedBot.name}"`
        );
        return true;
    }

    // Get recent conversation history for AI analysis
    const formattedMessages = await formatMessagesForAI(
        linkedBot.id,
        10 // Get more messages to ensure we have recent ones
    );

    if (formattedMessages.length === 0) return false;

    try {
        // Create cache key based on recent messages content hash
        const cacheKey = `${linkedBot.id}-${JSON.stringify(
            formattedMessages.slice(-5)
        )}`;
        const now = Date.now();

        // Check cache first
        const cached = engagementCache.get(cacheKey);
        if (cached && now - cached.timestamp < CACHE_DURATION) {
            console.log(
                `🤖 Using cached engagement decision: ${cached.reason}`
            );
            return cached.result;
        }

        console.log("Analyzing conversation engagement", formattedMessages);

        // Use AI to analyze conversation and decide on engagement
        const analysis = await analyzeConversationEngagement(
            formattedMessages,
            linkedBot.name,
            linkedBot.id
        );

        // Cache the result
        engagementCache.set(cacheKey, {
            result: analysis.shouldEngage,
            reason: analysis.reason,
            timestamp: now,
        });

        console.log("Relevance", analysis.relevance);

        if (analysis.shouldEngage) {
            let random = Math.random();
            if (
                analysis.relevance === 1.0 ||
                random < linkedBot.engagementFactor
            ) {
                console.log(
                    `🤖 Bot engaging due to AI analysis: ${analysis.reason}`
                );
            } else {
                analysis.shouldEngage = false;
                console.log(
                    `🤖 Bot not engaging due to random chance: ${analysis.reason}`
                );
            }
        } else {
            console.log(`🤖 Bot not engaging: ${analysis.reason}`);
        }

        return analysis.shouldEngage;
    } catch (error) {
        console.error("Error in AI conversation analysis:", error);
        // Fallback to basic rules if AI analysis fails
        return false;
    }
}
