import { json } from "@sveltejs/kit";
import { db } from "$lib/database.js";
import type { RequestHandler } from "./$types.js";

// GET /api/settings - Get bot settings
export const GET: RequestHandler = async () => {
    try {
        let settings = await db.botSettings.findFirst();

        if (!settings) {
            // Create default settings if none exist
            settings = await db.botSettings.create({
                data: {
                    name: "assistant",
                },
            });
        }

        return json(settings);
    } catch (error) {
        console.error("Error fetching settings:", error);
        return json({ error: "Failed to fetch settings" }, { status: 500 });
    }
};

// PUT /api/settings - Update bot settings
export const PUT: RequestHandler = async ({ request }) => {
    try {
        const { name, conversation } = await request.json();

        let settings = await db.botSettings.findFirst();

        if (settings) {
            settings = await db.botSettings.update({
                where: { id: settings.id },
                data: {
                    ...(name && { name }),
                    ...(conversation !== undefined && { conversation }),
                },
            });
        } else {
            settings = await db.botSettings.create({
                data: {
                    name: name || "assistant",
                    conversation,
                },
            });
        }

        return json(settings);
    } catch (error) {
        console.error("Error updating settings:", error);
        return json({ error: "Failed to update settings" }, { status: 500 });
    }
};
