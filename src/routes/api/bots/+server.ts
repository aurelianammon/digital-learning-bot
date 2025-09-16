import { json } from "@sveltejs/kit";
import { db } from "$lib/database.js";
import type { RequestHandler } from "./$types";

// POST - Create a new bot
export const POST: RequestHandler = async ({ request }) => {
    try {
        const { name, openaiKey } = await request.json();

        if (!name) {
            return json({ error: "Bot name is required" }, { status: 400 });
        }

        const bot = await db.bot.create({
            data: {
                name,
                openaiKey,
                isActive: true,
            },
            include: {
                _count: {
                    select: {
                        jobs: true,
                        messages: true,
                    },
                },
            },
        });

        return json(bot, { status: 201 });
    } catch (error) {
        console.error("Error creating bot:", error);
        return json({ error: "Failed to create bot" }, { status: 500 });
    }
};
