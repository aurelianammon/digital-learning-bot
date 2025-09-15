import { json } from "@sveltejs/kit";
import { db } from "$lib/database.js";
import type { RequestHandler } from "./$types.js";

// GET /api/context - Get the context for a specific bot
export const GET: RequestHandler = async ({ url }) => {
    try {
        const botId = url.searchParams.get("botId");

        if (!botId) {
            return json({ error: "Bot ID is required" }, { status: 400 });
        }

        const bot = await db.bot.findUnique({
            where: { id: botId },
            select: { context: true },
        });

        if (!bot) {
            return json({ error: "Bot not found" }, { status: 404 });
        }

        return json(bot.context || "");
    } catch (error) {
        console.error("Error fetching context:", error);
        return json({ error: "Failed to fetch context" }, { status: 500 });
    }
};

// PUT /api/context - Update the context for a specific bot
export const PUT: RequestHandler = async ({ request }) => {
    try {
        const { content, botId } = await request.json();

        if (content === undefined) {
            return json({ error: "Missing content field" }, { status: 400 });
        }

        if (!botId) {
            return json({ error: "Bot ID is required" }, { status: 400 });
        }

        // Update the bot's context
        const bot = await db.bot.update({
            where: { id: botId },
            data: { context: content },
            select: { context: true },
        });

        return json(bot);
    } catch (error) {
        console.error("Error updating context:", error);
        return json({ error: "Failed to update context" }, { status: 500 });
    }
};
