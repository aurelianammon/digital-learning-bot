import OpenAI from "openai";
import { db } from "$lib/database.js";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
});

export async function createChatCompletion(
    messages: Array<{ role: string; content: string }>,
    botId?: string
) {
    try {
        // Get bot-specific context from database
        let context: Array<{ role: "system"; content: string }> = [];

        if (botId) {
            const bot = await db.bot.findUnique({
                where: { id: botId },
                select: { context: true },
            });

            if (bot?.context) {
                context = [{ role: "system" as const, content: bot.context }];
            }
        }

        const chat = await openai.chat.completions.create({
            model: "gpt-4-1106-preview",
            messages: [...context, ...messages] as any,
            functions: [
                {
                    name: "getStaffInfo",
                    description: "Get the contact info of a staff member",
                    parameters: {
                        type: "object",
                        properties: {
                            staffPosition: {
                                type: "string",
                                description:
                                    'The position of the desired staff member. E.g. "author" or "owner"',
                            },
                        },
                        required: ["staffPosition"],
                    },
                },
            ],
            function_call: "auto",
        });

        let answer = chat.choices[0].message?.content;
        const wantsToUseFunction =
            chat.choices[0].finish_reason === "function_call";

        if (wantsToUseFunction) {
            const functionToUse = chat.choices[0].message?.function_call;
            let dataToReturn = {};

            if (functionToUse?.name === "getStaffInfo") {
                const args = JSON.parse(functionToUse.arguments);
                dataToReturn = getStaffInfo(args.staffPosition);
            }

            // New completion API call
            const chatWithFunction = await openai.chat.completions.create({
                model: "gpt-4-1106-preview",
                messages: [
                    ...context,
                    ...messages,
                    {
                        role: "function" as const,
                        name: functionToUse?.name || "",
                        content: JSON.stringify(dataToReturn),
                    },
                ] as any,
            });

            answer = chatWithFunction.choices[0].message?.content;
        }

        return answer;
    } catch (error) {
        console.error("Error creating chat completion:", error);
        throw error;
    }
}

export async function createImage(prompt: string) {
    try {
        const response = await openai.images.generate({
            prompt: prompt,
            n: 1,
            size: "512x512",
        });

        return response.data?.[0]?.url || "";
    } catch (error) {
        console.error("Error creating image:", error);
        throw error;
    }
}

// Helper function for staff info
function getStaffInfo(staffPosition: string) {
    switch (staffPosition) {
        case "author":
            return {
                name: "Rebecca",
                email: "rebecca@company.com",
            };
        case "owner":
            return {
                name: "Josh",
                email: "josh@company.com",
            };
        default:
            return {
                name: "No name found",
                email: "Not found",
            };
    }
}
