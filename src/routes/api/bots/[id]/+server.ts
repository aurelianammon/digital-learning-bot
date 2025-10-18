import { json } from "@sveltejs/kit";
import { db } from "$lib/database.js";
import type { RequestHandler } from "./$types";

// GET - Get a specific bot
export const GET: RequestHandler = async ({ params }) => {
    try {
        const { id } = params;

        const bot = await db.bot.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        jobs: true,
                        messages: true,
                    },
                },
            },
        });

        if (!bot) {
            return json({ error: "Bot not found" }, { status: 404 });
        }

        return json(bot);
    } catch (error) {
        console.error("Error fetching bot:", error);
        return json({ error: "Failed to fetch bot" }, { status: 500 });
    }
};

// PUT - Update a bot
export const PUT: RequestHandler = async ({ params, request }) => {
    try {
        const { id } = params;
        const updates = await request.json();

        // Only allow certain fields to be updated
        const allowedFields = [
            "name",
            "openaiKey",
            "model",
            "isActive",
            "engagementFactor",
            "introShown",
        ];
        const filteredUpdates = Object.keys(updates)
            .filter((key) => allowedFields.includes(key))
            .reduce((obj, key) => {
                obj[key] = updates[key];
                return obj;
            }, {} as any);

        const bot = await db.bot.update({
            where: { id },
            data: {
                ...filteredUpdates,
                updatedAt: new Date(),
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

        return json(bot);
    } catch (error) {
        console.error("Error updating bot:", error);
        return json({ error: "Failed to update bot" }, { status: 500 });
    }
};

// DELETE - Delete a bot and all its associated data
export const DELETE: RequestHandler = async ({ params }) => {
    try {
        const { id } = params;

        // First, delete all associated messages and jobs
        await db.$transaction([
            // Delete all messages for this bot
            db.message.deleteMany({
                where: { botId: id },
            }),
            // Delete all jobs for this bot
            db.job.deleteMany({
                where: { botId: id },
            }),
            // Finally, delete the bot itself
            db.bot.delete({
                where: { id },
            }),
        ]);

        return json({
            success: true,
            message: "Bot and all associated data deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting bot:", error);
        return json(
            { error: "Failed to delete bot and associated data" },
            { status: 500 }
        );
    }
};
