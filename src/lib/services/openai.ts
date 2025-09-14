import OpenAI from "openai";
import { db } from "$lib/database.js";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
});

export async function createChatCompletion(
    messages: Array<{ role: string; content: string }>
) {
    try {
        // Get context from database
        const contextRecord = await db.context.findFirst();
        const context = contextRecord
            ? [{ role: "system" as const, content: contextRecord.content }]
            : [];

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
