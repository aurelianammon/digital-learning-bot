import { json } from "@sveltejs/kit";
import OpenAI from "openai";
import { db } from "$lib/database.js";
import type { RequestHandler } from "./$types";

// GET - Fetch available OpenAI models
export const GET: RequestHandler = async ({ url }) => {
    try {
        const botId = url.searchParams.get("botId");

        if (!botId) {
            return json({ error: "Bot ID is required" }, { status: 400 });
        }

        // Fetch the bot to get its API key (server-side only)
        const bot = await db.bot.findUnique({
            where: { id: botId },
            select: { openaiKey: true },
        });

        if (!bot || !bot.openaiKey) {
            return json(
                { error: "Bot not found or no API key set" },
                { status: 400 }
            );
        }

        // Create OpenAI instance with the bot's stored key
        const openai = new OpenAI({
            apiKey: bot.openaiKey,
        });

        // Fetch available models
        const models = await openai.models.list();

        // Filter for GPT-5 models only
        const chatModels = models.data
            .filter(
                (model) => model.id.includes("gpt-5") // Only GPT-5 models
            )
            .map((model) => ({
                value: model.id,
                label: `${model.id}${
                    model.owned_by ? ` (${model.owned_by})` : ""
                }`,
            }))
            .sort((a, b) => {
                // Sort by model family: GPT-5, GPT-4, then GPT-3.x
                const getModelFamily = (modelId: string) => {
                    if (modelId.includes("gpt-5")) return 0; // Highest priority
                    if (modelId.includes("gpt-4")) return 1;
                    if (modelId.includes("gpt-3")) return 2;
                    return 3; // Fallback for other models
                };

                const aFamily = getModelFamily(a.value);
                const bFamily = getModelFamily(b.value);

                if (aFamily !== bFamily) {
                    return aFamily - bFamily; // Sort by family priority
                }

                // Within same family, sort alphabetically
                return a.value.localeCompare(b.value);
            });

        return json({
            models: chatModels,
        });
    } catch (error: any) {
        console.error("Error fetching OpenAI models:", error);

        // Handle specific OpenAI API errors
        if (error.status === 401) {
            return json(
                {
                    error: "Invalid API key",
                    models: [],
                },
                { status: 200 }
            );
        } else if (error.status === 429) {
            return json(
                {
                    error: "API rate limit exceeded",
                    models: [],
                },
                { status: 200 }
            );
        } else {
            return json(
                {
                    error: "Failed to fetch models",
                    models: [],
                },
                { status: 200 }
            );
        }
    }
};
