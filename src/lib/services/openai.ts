import OpenAI from "openai";
import { db } from "$lib/database.js";
import { scheduleJob } from "./scheduler.js";

export async function createChatCompletion(
    messages: Array<{ role: string; content: string }>,
    botId?: string
) {
    // console.log("Creating chat completion", messages, botId);
    try {
        // Get bot-specific context, API key, and model from database
        let context: Array<{ role: "system"; content: string }> = [];
        let apiKey: string | null = null;
        let model: string = "gpt-5-nano"; // default model

        if (botId) {
            const bot = await db.bot.findUnique({
                where: { id: botId },
                select: { context: true, openaiKey: true, model: true },
            });

            if (bot?.context) {
                context = [
                    {
                        role: "system" as const,
                        content:
                            bot.context +
                            "\n\nYou are an intelligent assistant with the ability to create scheduled tasks and reminders. When users ask you to create tasks, set reminders, or schedule something, use the createTask function to help them. You can create tasks with specific messages and dates/times for future execution.",
                    },
                ];
            } else {
                context = [
                    {
                        role: "system" as const,
                        content:
                            "You are an intelligent assistant with the ability to create scheduled tasks and reminders. When users ask you to create tasks, set reminders, or schedule something, use the createTask function to help them. You can create tasks with specific messages and dates/times for future execution.",
                    },
                ];
            }

            // Use bot-specific API key - required, no fallback
            apiKey = bot?.openaiKey || null;

            // Use bot-specific model or default
            model = bot?.model || "gpt-5-nano";
        }

        // Return error if no API key is available
        if (!apiKey) {
            throw new Error("No OpenAI API key configured for this bot");
        }

        // Create OpenAI instance with bot-specific API key
        const openai = new OpenAI({
            apiKey: apiKey,
        });

        const chat = await openai.chat.completions.create({
            model: model,
            messages: [...context, ...messages] as any,
            tools: [
                {
                    type: "function",
                    function: {
                        name: "createTask",
                        description:
                            "Create a scheduled task/reminder for the user",
                        parameters: {
                            type: "object",
                            properties: {
                                message: {
                                    type: "string",
                                    description:
                                        "The message/content of the task",
                                },
                                date: {
                                    type: "string",
                                    description:
                                        "When the task should be executed (ISO date string)",
                                },
                                reason: {
                                    type: "string",
                                    description:
                                        "Why this task is being created",
                                },
                            },
                            required: ["message", "date"],
                        },
                    },
                },
            ],
            tool_choice: "auto",
        });

        let answer = chat.choices[0].message?.content;
        const wantsToUseFunction =
            chat.choices[0].finish_reason === "tool_calls";

        if (wantsToUseFunction) {
            const toolCalls = chat.choices[0].message?.tool_calls;
            let dataToReturn = {};

            if (toolCalls && toolCalls.length > 0) {
                const toolCall = toolCalls[0];

                // Type guard to ensure it's a function tool call
                if (toolCall.type === "function" && toolCall.function) {
                    if (toolCall.function.name === "createTask") {
                        const args = JSON.parse(toolCall.function.arguments);
                        console.log("🤖 Creating scheduled task:", args);

                        // Create the scheduled task
                        const taskResult = await createScheduledTask(
                            args.message,
                            new Date(args.date),
                            botId || ""
                        );

                        console.log("📅 Task creation result:", taskResult);

                        dataToReturn = {
                            success: taskResult.success,
                            // taskId: taskResult.taskId,
                            message: taskResult.success
                                ? `Task created successfully!`
                                : `Failed to create task: ${taskResult.error}`,
                            error: taskResult.error,
                        };
                    }
                }

                // New completion API call with tool response
                const chatWithFunction = await openai.chat.completions.create({
                    model: model,
                    messages: [
                        ...context,
                        ...messages,
                        {
                            role: "assistant" as const,
                            content: null,
                            tool_calls: toolCalls,
                        },
                        {
                            role: "tool" as const,
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(dataToReturn),
                        },
                    ] as any,
                });

                answer = chatWithFunction.choices[0].message?.content;
            }
        }

        return answer;
    } catch (error) {
        console.error("Error creating chat completion:", error);
        throw error;
    }
}

export async function createImage(prompt: string, botId?: string) {
    try {
        // Get bot-specific API key from database
        let apiKey: string | null = null;

        if (botId) {
            const bot = await db.bot.findUnique({
                where: { id: botId },
                select: { openaiKey: true },
            });

            // Use bot-specific API key - required, no fallback
            apiKey = bot?.openaiKey || null;
        }

        // Return error if no API key is available
        if (!apiKey) {
            throw new Error("No OpenAI API key configured for this bot");
        }

        // Create OpenAI instance with bot-specific API key
        const openai = new OpenAI({
            apiKey: apiKey,
        });

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

/**
 * Create a scheduled task for a bot
 * Returns the created task information
 */
export async function createScheduledTask(
    message: string,
    date: Date,
    botId: string
): Promise<{ success: boolean; taskId?: string; error?: string }> {
    try {
        // Validate bot exists
        const bot = await db.bot.findUnique({
            where: { id: botId },
        });

        if (!bot) {
            return {
                success: false,
                error: "Bot not found",
            };
        }

        // Create the job directly in database
        const job = await db.job.create({
            data: {
                type: "TEXT",
                message,
                date,
                botId,
                state: true,
            },
        });

        // Schedule the job using the scheduler
        scheduleJob(job);

        return {
            success: true,
            taskId: job.id,
        };
    } catch (error) {
        console.error("Error creating scheduled task:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
