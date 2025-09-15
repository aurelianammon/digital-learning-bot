import { json } from "@sveltejs/kit";
import { db } from "$lib/database.js";
import type { RequestHandler } from "./$types.js";

// GET /api/messages - Get all messages (optionally filtered by bot)
export const GET: RequestHandler = async ({ url }) => {
    try {
        const botId = url.searchParams.get("botId");

        // If botId is specified, get only messages for that specific bot
        // If no botId specified, get all messages (including legacy messages with botId: null)
        const whereClause = botId
            ? {
                  botId: botId,
              }
            : {};

        const messages = await db.message.findMany({
            where: whereClause,
            orderBy: { createdAt: "desc" },
        });
        return json(messages);
    } catch (error) {
        console.error("Error fetching messages:", error);
        return json({ error: "Failed to fetch messages" }, { status: 500 });
    }
};

// POST /api/messages - Create a new message
export const POST: RequestHandler = async ({ request }) => {
    try {
        const { role, content, botId } = await request.json();

        if (!role || !content) {
            return json({ error: "Missing required fields" }, { status: 400 });
        }

        const message = await db.message.create({
            data: {
                role,
                content,
                botId, // Associate message with bot if provided
            },
        });

        return json(message, { status: 201 });
    } catch (error) {
        console.error("Error creating message:", error);
        return json({ error: "Failed to create message" }, { status: 500 });
    }
};
