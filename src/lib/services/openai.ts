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
                select: {
                    context: true,
                    openaiKey: true,
                    model: true,
                    name: true,
                },
            });

            // Load context files (PDFs) for this bot
            const contextFiles = await db.contextFile.findMany({
                where: { botId: botId },
                select: { summary: true, originalName: true },
                orderBy: { createdAt: "desc" },
            });

            const internalContext =
                "Your name is " +
                bot?.name +
                ". You are an intelligent assistant with multiple capabilities. IMPORTANT: You can use MULTIPLE tools in a single response if the user's request requires it. For example, if they ask for a reminder AND want you to change engagement, use BOTH createTask AND changeEngagementFactor tools. You can also use tools that depend on each other - for example, use getCurrentEngagement to check the current engagement level before using changeEngagementFactor to modify it. CRITICAL RELATIVE CALCULATIONS: When users ask for relative changes (like 'reduce a bit', 'increase slightly', 'make it less'), you MUST: 1) Use getCurrentEngagement first, 2) Calculate the new value based on the current value and the user's request: 'a bit' = ±0.1, 'slightly' = ±0.1, 'more/less' = ±0.2, 'much' = ±0.3, 'significantly' = ±0.4, 3) Use changeEngagementFactor with the calculated value. Example: current=0.8, user says 'reduce a bit' → calculate 0.8-0.1=0.7 → use changeEngagementFactor(0.7). Always respond with plain text messages only. Do not format your responses as JSON objects. Respond naturally as a conversational assistant.";

            // Build context with uploaded documents
            let contextContent = bot?.context || "";

            // Add context files if available
            if (contextFiles.length > 0) {
                const filesContext = contextFiles
                    .map(
                        (file) =>
                            `[Context from ${file.originalName}]:\n${file.summary}`
                    )
                    .join("\n\n");
                contextContent = contextContent
                    ? `${contextContent}\n\n--- Additional Context from Uploaded Documents ---\n${filesContext}`
                    : `--- Context from Uploaded Documents ---\n${filesContext}`;
            }

            if (contextContent) {
                context = [
                    {
                        role: "system" as const,
                        content: contextContent + "\n\n" + internalContext,
                    },
                ];
            } else {
                context = [
                    {
                        role: "system" as const,
                        content: internalContext,
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

        // Define available tools
        const availableTools = [
            {
                type: "function",
                function: {
                    name: "createTask",
                    description:
                        "Create a scheduled task/reminder for the user. Use this when users ask for reminders, tasks, or scheduling something for the future.",
                    parameters: {
                        type: "object",
                        properties: {
                            message: {
                                type: "string",
                                description:
                                    "The message/content of the task, create a natural and engaging message for the user, something that would be a good reminder for the user to do. Do not write the time in the message, just the task.",
                            },
                            date: {
                                type: "string",
                                description:
                                    "When the task should be executed (ISO date string)",
                            },
                            reason: {
                                type: "string",
                                description: "Why this task is being created",
                            },
                        },
                        required: ["message", "date"],
                    },
                },
            },
            {
                type: "function",
                function: {
                    name: "changeEngagementFactor",
                    description:
                        "Change the bot's engagement factor (0.0 = no engagement, 1.0 = full engagement). Use this when users ask you to be more or less active, to stop participating, to be quiet, or to reduce/increase engagement. ALWAYS use getCurrentEngagement first for relative changes, then calculate the new value: 'a bit'=±0.1, 'slightly'=±0.1, 'more/less'=±0.2, 'much'=±0.3, 'significantly'=±0.4. For absolute changes, use exact values when user specifies numbers.",
                    parameters: {
                        type: "object",
                        properties: {
                            engagementFactor: {
                                type: "number",
                                description:
                                    "The calculated engagement factor value (0.0 to 1.0). For relative changes: if current=0.8 and user wants 'a bit less', calculate 0.8-0.1=0.7. If current=0.3 and user wants 'more', calculate 0.3+0.2=0.5. Always calculate based on current value from getCurrentEngagement.",
                                minimum: 0.0,
                                maximum: 1.0,
                            },
                            reason: {
                                type: "string",
                                description:
                                    "Why the engagement factor is being changed, including the calculation (e.g., 'reduce a bit: 0.8 - 0.1 = 0.7')",
                            },
                        },
                        required: ["engagementFactor"],
                    },
                },
            },
            {
                type: "function",
                function: {
                    name: "getCurrentEngagement",
                    description:
                        "Get the current engagement factor of the bot. Use this to check the current engagement level before making changes or to understand the current bot behavior.",
                    parameters: {
                        type: "object",
                        properties: {},
                        required: [],
                    },
                },
            },
        ];

        // Helper function to execute a single tool
        const executeTool = async (toolCall: any) => {
            if (toolCall.type === "function" && toolCall.function) {
                const args = JSON.parse(toolCall.function.arguments);

                switch (toolCall.function.name) {
                    case "createTask":
                        console.log("🤖 Creating scheduled task:", args);
                        const taskResult = await createScheduledTask(
                            args.message,
                            new Date(args.date),
                            botId || ""
                        );
                        console.log("📅 Task creation result:", taskResult);

                        return {
                            success: taskResult.success,
                            message: taskResult.success
                                ? `Task created successfully!`
                                : `Failed to create task: ${taskResult.error}`,
                            error: taskResult.error,
                        };

                    case "changeEngagementFactor":
                        console.log("🤖 Changing engagement factor:", args);
                        const engagementResult = await updateEngagementFactor(
                            botId || "",
                            args.engagementFactor,
                            args.reason
                        );
                        console.log(
                            "📊 Engagement factor update result:",
                            engagementResult
                        );

                        return {
                            success: engagementResult.success,
                            message: engagementResult.success
                                ? `Engagement factor updated to ${args.engagementFactor}!`
                                : `Failed to update engagement factor: ${engagementResult.error}`,
                            error: engagementResult.error,
                        };

                    case "getCurrentEngagement":
                        console.log("📊 Getting current engagement factor");
                        try {
                            if (botId) {
                                const bot = await db.bot.findUnique({
                                    where: { id: botId },
                                    select: { engagementFactor: true },
                                });

                                const currentEngagement =
                                    bot?.engagementFactor || 0.5;

                                return {
                                    success: true,
                                    message: `Current engagement factor: ${currentEngagement}`,
                                    engagementFactor: currentEngagement,
                                    description:
                                        currentEngagement === 0
                                            ? "No engagement (silent)"
                                            : currentEngagement <= 0.3
                                            ? "Low engagement (minimal participation)"
                                            : currentEngagement <= 0.7
                                            ? "Medium engagement (moderate participation)"
                                            : "High engagement (very active)",
                                };
                            }

                            return {
                                success: false,
                                message:
                                    "Could not retrieve engagement factor - no bot ID provided",
                                error: "No bot ID",
                            };
                        } catch (error) {
                            console.error(
                                "Error getting engagement factor:",
                                error
                            );
                            return {
                                success: false,
                                message: "Error retrieving engagement factor",
                                error: error.message,
                            };
                        }

                    default:
                        return {
                            success: false,
                            message: `Unknown tool: ${toolCall.function.name}`,
                            error: "Tool not implemented",
                        };
                }
            }
            return {
                success: false,
                message: "Invalid tool call",
                error: "Invalid tool call type",
            };
        };

        // Tool execution loop
        let conversationMessages = [...context, ...messages];
        let answer = "";
        let maxIterations = 5; // Prevent infinite loops
        let iteration = 0;

        while (iteration < maxIterations) {
            iteration++;
            console.log(`🔄 AI Iteration ${iteration}`);

            const chat = await openai.chat.completions.create({
                model: model,
                messages: conversationMessages,
                tools: availableTools,
                tool_choice: "auto",
            });

            const assistantMessage = chat.choices[0].message;
            conversationMessages.push({
                role: "assistant",
                content: assistantMessage.content,
                tool_calls: assistantMessage.tool_calls,
            });

            // If no tool calls, we're done
            if (
                !assistantMessage.tool_calls ||
                assistantMessage.tool_calls.length === 0
            ) {
                answer = assistantMessage.content || "I'm here to help!";
                break;
            }

            // Execute tools
            const toolCalls = assistantMessage.tool_calls;
            console.log(
                `🔄 Executing ${toolCalls.length} tool call(s) in iteration ${iteration}`
            );

            for (const toolCall of toolCalls) {
                try {
                    const result = await executeTool(toolCall);
                    conversationMessages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(result),
                    });
                    console.log(
                        `✅ Tool ${toolCall.function?.name} executed successfully`
                    );
                } catch (error) {
                    console.error(
                        `❌ Error executing tool ${toolCall.function?.name}:`,
                        error
                    );
                    conversationMessages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: JSON.stringify({
                            success: false,
                            message: `Error executing ${toolCall.function?.name}`,
                            error: error.message,
                        }),
                    });
                }
            }
        }

        // If we hit max iterations, add a final system message
        if (iteration >= maxIterations) {
            conversationMessages.push({
                role: "system",
                content:
                    "Respond with plain text only. Do not format your response as JSON. Be conversational, natural and not too technical. Summarize what was accomplished.",
            });

            const finalChat = await openai.chat.completions.create({
                model: model,
                messages: conversationMessages,
                tools: [], // No more tools
            });

            answer =
                finalChat.choices[0].message?.content ||
                "I've completed the requested actions.";
        }

        // Ensure we always return a plain text string, not JSON
        if (answer && typeof answer === "string") {
            // If the response looks like JSON, extract the message field or return a fallback
            try {
                const parsed = JSON.parse(answer);
                if (parsed.message) {
                    return parsed.message;
                }
            } catch (e) {
                // Not JSON, return as is
            }
        }

        return answer || "I'm here to help!";
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

/**
 * Update the engagement factor for a bot
 * Returns the update result
 */
export async function updateEngagementFactor(
    botId: string,
    engagementFactor: number,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Validate engagement factor range
        if (engagementFactor < 0 || engagementFactor > 1) {
            return {
                success: false,
                error: "Engagement factor must be between 0.0 and 1.0",
            };
        }

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

        // Update the engagement factor in database
        await db.bot.update({
            where: { id: botId },
            data: {
                engagementFactor: engagementFactor,
            },
        });

        console.log(
            `📊 Updated engagement factor for bot ${botId} to ${engagementFactor}${
                reason ? ` (${reason})` : ""
            }`
        );

        return {
            success: true,
        };
    } catch (error) {
        console.error("Error updating engagement factor:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
