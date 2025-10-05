import { db } from "$lib/database.js";

/**
 * Format messages for AI processing with configurable limit
 * @param botId - The bot ID to fetch messages for
 * @param limit - Number of messages to load (default: 100)
 * @returns Array of formatted messages ready for AI processing
 */
export async function formatMessagesForAI(
    botId: string,
    limit: number = 100
): Promise<Array<{ role: string; content: string }>> {
    const messages = await db.message.findMany({
        where: {
            OR: [{ botId: botId }],
        },
        orderBy: { createdAt: "desc" },
        take: limit,
    });

    const botName = await db.bot.findUnique({
        where: { id: botId },
        select: { name: true },
    });

    return messages.reverse().map((msg) => ({
        role: msg.role,
        content: JSON.stringify({
            timestamp: msg.createdAt.toISOString(),
            name:
                msg.name ||
                (msg.role === "user" ? "User" : botName || "Assistant"),
            message: msg.content,
        }),
    }));
}
