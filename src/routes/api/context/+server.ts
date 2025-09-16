import { json } from "@sveltejs/kit";
import { db } from "$lib/database.js";
import { withAuth } from "$lib/middleware.js";
import type { RequestHandler } from "./$types.js";

// GET /api/context - Get the context for the authenticated bot
export const GET: RequestHandler = withAuth(async ({ bot }) => {
    try {
        const botData = await db.bot.findUnique({
            where: { id: bot.id },
            select: { context: true },
        });

        if (!botData) {
            return json({ error: "Bot not found" }, { status: 404 });
        }

        return json(botData.context || "");
    } catch (error) {
        console.error("Error fetching context:", error);
        return json({ error: "Failed to fetch context" }, { status: 500 });
    }
});

// PUT /api/context - Update the context for the authenticated bot
export const PUT: RequestHandler = withAuth(async ({ request, bot }) => {
    try {
        const { content } = await request.json();

        if (content === undefined) {
            return json({ error: "Missing content field" }, { status: 400 });
        }

        // Update the bot's context
        const updatedBot = await db.bot.update({
            where: { id: bot.id },
            data: { context: content },
            select: { context: true },
        });

        return json(updatedBot);
    } catch (error) {
        console.error("Error updating context:", error);
        return json({ error: "Failed to update context" }, { status: 500 });
    }
});
