import { json } from "@sveltejs/kit";
import { db } from "$lib/database.js";
import { withAuth } from "$lib/middleware.js";
import type { RequestHandler } from "./$types.js";

// GET /api/messages - Get messages for the authenticated bot
export const GET: RequestHandler = withAuth(async ({ bot }) => {
    try {
        const messages = await db.message.findMany({
            where: { botId: bot.id } as any,
            orderBy: { createdAt: "desc" },
        });
        return json(messages);
    } catch (error) {
        console.error("Error fetching messages:", error);
        return json({ error: "Failed to fetch messages" }, { status: 500 });
    }
});

// POST /api/messages - Create a new message for the authenticated bot
export const POST: RequestHandler = withAuth(async ({ request, bot }) => {
    try {
        const { role, content } = await request.json();

        if (!role || !content) {
            return json({ error: "Missing required fields" }, { status: 400 });
        }

        const message = await db.message.create({
            data: {
                role,
                content,
                botId: bot.id, // Associate message with authenticated bot
            } as any,
        });

        return json(message, { status: 201 });
    } catch (error) {
        console.error("Error creating message:", error);
        return json({ error: "Failed to create message" }, { status: 500 });
    }
});
