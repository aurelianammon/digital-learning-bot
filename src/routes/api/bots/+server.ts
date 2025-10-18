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

        // Exclude openaiKey from the response for security
        const { openaiKey: _, ...botWithoutKey } = bot;

        // Only indicate if a key is set, but never return the actual key
        const botResponse = {
            ...botWithoutKey,
            hasOpenaiKey: !!openaiKey,
        };

        return json(botResponse, { status: 201 });
    } catch (error) {
        console.error("Error creating bot:", error);
        return json({ error: "Failed to create bot" }, { status: 500 });
    }
};
