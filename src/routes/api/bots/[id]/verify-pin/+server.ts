import { json } from "@sveltejs/kit";
import { db } from "$lib/database.js";
import type { RequestHandler } from "./$types";

// POST - Verify PIN and link chat to bot
export const POST: RequestHandler = async ({ params, request }) => {
    try {
        const { id: botId } = params;
        const { pin } = await request.json();

        if (!pin) {
            return json({ error: "PIN is required" }, { status: 400 });
        }

        // Find the pending link with the given PIN
        const pendingLink = await db.pendingLink.findFirst({
            where: {
                pin,
                expiresAt: {
                    gt: new Date(),
                },
            },
        });

        if (!pendingLink) {
            return json({ error: "Invalid or expired PIN" }, { status: 400 });
        }

        // Check if bot already has a linked chat
        const existingBot = await db.bot.findUnique({
            where: { id: botId },
        });

        if (existingBot?.linkedChatId) {
            return json(
                {
                    error: "Bot already has a linked chat. Unlink the current chat first.",
                },
                { status: 400 }
            );
        }

        // Update the bot with the linked chat
        const updatedBot = await db.bot.update({
            where: { id: botId },
            data: {
                linkedChatId: pendingLink.chatId,
                linkedAt: new Date(),
            },
        });

        // Remove the pending link
        await db.pendingLink.delete({
            where: { id: pendingLink.id },
        });

        // Also clean up any expired pending links
        await db.pendingLink.deleteMany({
            where: {
                expiresAt: {
                    lt: new Date(),
                },
            },
        });

        return json({
            success: true,
            chatId: pendingLink.chatId,
            message: "Chat successfully linked to bot",
        });
    } catch (error) {
        console.error("Error verifying PIN:", error);
        return json({ error: "Failed to verify PIN" }, { status: 500 });
    }
};
