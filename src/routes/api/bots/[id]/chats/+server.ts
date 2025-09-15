import { json } from "@sveltejs/kit";
import { db } from "$lib/database.js";
import type { RequestHandler } from "./$types";

// GET - Get the linked chat for a bot
export const GET: RequestHandler = async ({ params }) => {
    try {
        const { id: botId } = params;

        const bot = await db.bot.findUnique({
            where: { id: botId },
            select: {
                linkedChatId: true,
                linkedAt: true,
            },
        });

        if (!bot || !bot.linkedChatId) {
            return json(null);
        }

        return json({
            chatId: bot.linkedChatId,
            linkedAt: bot.linkedAt,
        });
    } catch (error) {
        console.error("Error fetching bot chat:", error);
        return json({ error: "Failed to fetch bot chat" }, { status: 500 });
    }
};

// DELETE - Unlink the chat from a bot
export const DELETE: RequestHandler = async ({ params }) => {
    try {
        const { id: botId } = params;

        await db.bot.update({
            where: { id: botId },
            data: {
                linkedChatId: null,
                linkedAt: null,
            },
        });

        return json({ success: true, message: "Chat unlinked successfully" });
    } catch (error) {
        console.error("Error unlinking chat:", error);
        return json({ error: "Failed to unlink chat" }, { status: 500 });
    }
};
