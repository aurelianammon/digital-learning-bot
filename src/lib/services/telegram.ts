import { Telegraf } from "telegraf";
import { db } from "$lib/database.js";
import {
    createChatCompletion,
    createImage,
    analyzeConversationEngagement,
} from "./openai.js";
import { generateImageCaption } from "./huggingface.js";
import {
    initializeScheduler,
    setBotInstance,
    cleanupScheduler,
} from "./scheduler.js";

export let bot: Telegraf | null = null;

// Cache for AI engagement analysis to avoid excessive API calls
const engagementCache = new Map<
    string,
    { result: boolean; reason: string; timestamp: number }
>();
const CACHE_DURATION = 30000; // 30 seconds cache

export async function initializeTelegramBot() {
    if (!process.env.TELEGRAM_KEY) {
        console.warn(
            "TELEGRAM_KEY not found, skipping Telegram bot initialization"
        );
        return;
    }

    // Stop existing bot instance if it exists
    if (bot) {
        try {
            bot.stop();
            console.log("Stopped existing Telegram bot instance");
        } catch (error) {
            console.warn("Error stopping existing bot:", error);
        }
        bot = null;
    }

    bot = new Telegraf(process.env.TELEGRAM_KEY);

    // Help command
    bot.command("help", async (ctx) => {
        // Find which bot this chat is linked to
        const linkedBot = await db.bot.findFirst({
            where: {
                linkedChatId: String(ctx.chat.id),
                isActive: true,
            },
        });

        const botName = linkedBot?.name || "assistant";

        const text = `${botName} ist ein AI-gesteuerten ChatBot, welcher speziell für «AI Encounter» entwickelt wurde, um auf persönliche und einladende Weise Wissen zu vermitteln. Im hintergrund werden ChatGTP und ähnliche Technologien benutzt. Um mit ${botName} in ein Gespräch einzusteigen, genügt es, ${botName} direkt anzusprechen. Ähnlich wie bei vielen KI-Systemen sind nicht alle Potenziale von Beginn an offensichtlich. Deshalb ermutigen wir dazu, verschiedene Ansätze auszuprobieren und aktiv mit ${botName} in Interaktion zu treten, um die vielfältigen Möglichkeiten zu entdecken, die es zu bieten hat. \n\nEntwickelt und umgesetzt vom Designstudio [alles-negativ](alles-negativ.ch).`;

        await ctx.reply(text.replace(/[_*\~\`>#\+\-=|{}.!]/g, "\\$&"), {
            parse_mode: "MarkdownV2",
        });
    });

    bot.command("link", async (ctx) => {
        try {
            // Generate a 6-digit PIN
            const pin = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 15); // PIN expires in 15 minutes

            // Check if this chat is already linked to any bot
            const existingBot = await db.bot.findFirst({
                where: {
                    linkedChatId: String(ctx.chat.id),
                    isActive: true,
                },
            });

            if (existingBot) {
                await ctx.reply(
                    `This chat is already linked to bot "${existingBot.name}"!\n\nTo link to a different bot, first unlink this chat in the backend interface.`
                );
                return;
            }

            // Remove any existing pending links for this chat (from any bot)
            await db.pendingLink.deleteMany({
                where: {
                    chatId: String(ctx.chat.id),
                },
            });

            // Create new bot-agnostic pending link
            await db.pendingLink.create({
                data: {
                    chatId: String(ctx.chat.id),
                    pin,
                    expiresAt,
                },
            });

            await ctx.reply(
                `🔗 Link Request Generated!\n\n` +
                    `PIN: \`${pin}\`\n` +
                    `Chat ID: \`${ctx.chat.id}\`\n\n` +
                    `An admin must enter this PIN in the backend interface of the bot they want to link to this chat.\n` +
                    `This PIN will expire in 15 minutes.`,
                { parse_mode: "Markdown" }
            );
        } catch (error) {
            console.error("Error generating link PIN:", error);
            await ctx.reply(
                "Sorry, I had trouble generating the link PIN. Please try again."
            );
        }
    });

    // Stats command
    bot.command("stats", async (ctx) => {
        // Find which bot this chat is linked to
        const linkedBot = await db.bot.findFirst({
            where: {
                linkedChatId: String(ctx.chat.id),
                isActive: true,
            },
        });

        if (linkedBot) {
            await ctx.reply(
                `Bot: ${linkedBot.name}\nChat ID: ${ctx.chat.id}\nLinked at: ${
                    linkedBot.linkedAt?.toLocaleString() || "Unknown"
                }`
            );
        } else {
            await ctx.reply(
                `This chat is not linked to any bot. Use /link to connect.`
            );
        }
    });

    // Handle image generation requests
    bot.hears(/\b(?:imagine|Traum)\b/, async (ctx) => {
        await ctx.sendChatAction("typing");

        try {
            const url = await createImage(ctx.message.text);
            if (url) {
                await ctx.replyWithPhoto(url);
            }
        } catch (error) {
            console.error("Error generating image:", error);
            await ctx.reply("Sorry, I had trouble generating that image.");
        }
    });

    // Helper function to determine if bot should respond using AI analysis
    async function shouldBotRespond(
        messageText: string,
        linkedBot: any,
        messageDate: number
    ): Promise<boolean> {
        if (!linkedBot) return false;

        // Always respond if directly mentioned (fast path)
        const directMention = new RegExp(`\\b(${linkedBot.name})\\b`, "i").test(
            messageText
        );
        if (directMention) {
            console.log(
                `🤖 Bot responding due to direct mention of "${linkedBot.name}"`
            );
            return true;
        }

        // Get recent conversation history for AI analysis
        const recentMessages = await db.message.findMany({
            where: {
                botId: linkedBot.id,
            },
            orderBy: { createdAt: "desc" },
            take: 10, // Last 15 messages for better context
        });

        if (recentMessages.length === 0) return false;

        // Prepare messages for AI analysis (include timestamps)
        // Reverse to get chronological order since we fetched in desc order
        const formattedMessages = recentMessages.reverse().map((msg) => ({
            role: msg.role,
            content: `[${msg.createdAt.toLocaleString()}] ${msg.content}`,
        }));

        try {
            // Create cache key based on recent messages content hash
            const cacheKey = `${linkedBot.id}-${JSON.stringify(
                formattedMessages.slice(-5)
            )}`;
            const now = Date.now();

            // Check cache first
            const cached = engagementCache.get(cacheKey);
            if (cached && now - cached.timestamp < CACHE_DURATION) {
                console.log(
                    `🤖 Using cached engagement decision: ${cached.reason}`
                );
                return cached.result;
            }

            console.log("Analyzing conversation engagement", formattedMessages);

            // Use AI to analyze conversation and decide on engagement
            const analysis = await analyzeConversationEngagement(
                formattedMessages,
                linkedBot.name,
                linkedBot.id
            );

            // Cache the result
            engagementCache.set(cacheKey, {
                result: analysis.shouldEngage,
                reason: analysis.reason,
                timestamp: now,
            });

            if (analysis.shouldEngage) {
                console.log(
                    `🤖 Bot engaging due to AI analysis: ${analysis.reason}`
                );
            } else {
                console.log(`🤖 Bot not engaging: ${analysis.reason}`);
            }

            return analysis.shouldEngage;
        } catch (error) {
            console.error("Error in AI conversation analysis:", error);
            // Fallback to basic rules if AI analysis fails
            return false;
        }
    }

    // Handle all other messages
    bot.on("message", async (ctx) => {
        // console.log("message", ctx.message);
        try {
            // Find which bot this chat is linked to
            const linkedBot = await db.bot.findFirst({
                where: {
                    linkedChatId: String(ctx.chat.id),
                    isActive: true,
                },
            });

            // If no bot is linked to this chat, ignore the message
            if (!linkedBot) {
                console.log("No bot linked to this chat, ignoring message");
                return;
            }

            // Handle images
            if ("photo" in ctx.message && ctx.message.photo) {
                const photo = ctx.message.photo[ctx.message.photo.length - 1];
                const fileLink = await ctx.telegram.getFileLink(photo.file_id);
                const caption = await generateImageCaption(fileLink.href);

                await db.message.create({
                    data: {
                        role: "user",
                        content: `image_description: ${caption}`,
                        botId: linkedBot?.id || null,
                    },
                });

                if ("caption" in ctx.message && ctx.message.caption) {
                    await db.message.create({
                        data: {
                            role: "user",
                            content: `${ctx.message.from.first_name}: ${ctx.message.caption}`,
                            botId: linkedBot?.id || null,
                        },
                    });
                }
            } else if ("text" in ctx.message && ctx.message.text) {
                // Save the user message
                await db.message.create({
                    data: {
                        role: "user",
                        content: `${ctx.message.from.first_name}: ${ctx.message.text}`,
                        botId: linkedBot?.id || null,
                    },
                });

                // Check if the bot should respond (either mentioned directly or based on conversation flow)
                const shouldRespond = await shouldBotRespond(
                    ctx.message.text,
                    linkedBot,
                    ctx.message.date
                );

                if (linkedBot && shouldRespond) {
                    await ctx.sendChatAction("typing");

                    try {
                        const messages = await db.message.findMany({
                            where: {
                                OR: [{ botId: linkedBot.id }],
                            },
                            orderBy: { createdAt: "asc" },
                            take: 100,
                        });

                        const formattedMessages = messages.map((msg) => ({
                            role: msg.role,
                            content:
                                "[" +
                                msg.createdAt.toLocaleString() +
                                "] " +
                                msg.content,
                        }));

                        const completion = await createChatCompletion(
                            formattedMessages,
                            linkedBot.id
                        );

                        // Save the assistant response
                        await db.message.create({
                            data: {
                                role: "assistant",
                                content:
                                    completion ||
                                    "Sorry, I could not generate a response.",
                                botId: linkedBot.id,
                            },
                        });

                        await ctx.reply(
                            completion ||
                                "Sorry, I could not generate a response."
                        );
                    } catch (error) {
                        console.error("Error generating AI response:", error);
                        await ctx.reply(
                            "Sorry, I had trouble processing your message."
                        );
                    }
                }
            }
        } catch (error) {
            console.error("Error saving message:", error);
        }
    });

    // Start the bot
    bot.launch();
    console.log("✅ Telegram bot started and ready");

    // Create bot interface for scheduler
    const botInterface = {
        sendMessage: async (chatId: string, message: string, options?: any) => {
            if (!bot) throw new Error("Bot not initialized");
            return await bot.telegram.sendMessage(chatId, message, options);
        },
        sendPhoto: async (chatId: string, photo: any) => {
            if (!bot) throw new Error("Bot not initialized");
            return await bot.telegram.sendPhoto(chatId, photo);
        },
        sendVideo: async (chatId: string, video: any) => {
            if (!bot) throw new Error("Bot not initialized");
            return await bot.telegram.sendVideo(chatId, video);
        },
    };

    // Connect bot to scheduler
    setBotInstance(botInterface);
    console.log("🔗 Bot connected to scheduler");

    // Initialize scheduler
    await initializeScheduler();
    console.log("⏰ Scheduler initialized");

    // Graceful shutdown
    process.once("SIGINT", async () => {
        console.log("\n🛑 Received SIGINT, shutting down gracefully...");
        await gracefulShutdown();
    });
    process.once("SIGTERM", async () => {
        console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
        await gracefulShutdown();
    });
}

export function stopTelegramBot() {
    if (bot) {
        bot.stop();
        bot = null;
        console.log("Telegram bot stopped");
    }
}

export async function restartTelegramBot() {
    stopTelegramBot();
    await initializeTelegramBot();
}
async function gracefulShutdown() {
    try {
        // Stop the Telegram bot first
        if (bot) {
            console.log("🤖 Stopping Telegram bot...");
            await bot.stop();
            bot = null;
        }

        // Clear any intervals or timeouts from scheduler
        cleanupScheduler();

        // Add a small delay to ensure everything is cleaned up
        setTimeout(() => {
            console.log("✅ Shutdown complete");
            // Force flush stdout and add newline before exit
            process.stdout.write("\n");
            setTimeout(() => process.exit(0), 0);
        }, 0);
    } catch (error) {
        console.error("❌ Error during shutdown:", error);
        process.exit(1);
    }
}
