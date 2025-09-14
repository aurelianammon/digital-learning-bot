import { Telegraf } from "telegraf";
import { db } from "$lib/database.js";
import { createChatCompletion, createImage } from "./openai.js";
import { generateImageCaption } from "./huggingface.js";
import {
    initializeScheduler,
    setBotInstance,
    cleanupScheduler,
} from "./scheduler.js";

export let bot: Telegraf | null = null;

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
        const settings = await db.botSettings.findFirst();
        const botName = settings?.name || "assistant";

        const text = `${botName} ist ein AI-gesteuerten ChatBot, welcher speziell für «AI Encounter» entwickelt wurde, um auf persönliche und einladende Weise Wissen zu vermitteln. Im hintergrund werden ChatGTP und ähnliche Technologien benutzt. Um mit ${botName} in ein Gespräch einzusteigen, genügt es, ${botName} direkt anzusprechen. Ähnlich wie bei vielen KI-Systemen sind nicht alle Potenziale von Beginn an offensichtlich. Deshalb ermutigen wir dazu, verschiedene Ansätze auszuprobieren und aktiv mit ${botName} in Interaktion zu treten, um die vielfältigen Möglichkeiten zu entdecken, die es zu bieten hat. \n\nEntwickelt und umgesetzt vom Designstudio [alles-negativ](alles-negativ.ch).`;

        await ctx.reply(text.replace(/[_*\~\`>#\+\-=|{}.!]/g, "\\$&"), {
            parse_mode: "MarkdownV2",
        });
    });

    bot.command("link", async (ctx) => {
        // Update or create bot settings with the chat.id as conversation
        await db.botSettings.upsert({
            where: { id: "cmfgscz4500014s1z9bjyfbwf" },
            update: { conversation: String(ctx.chat.id) },
            create: { conversation: String(ctx.chat.id) },
        });

        await ctx.reply(`Linked to conversation: ${ctx.chat.id}`);
    });

    // Stats command
    bot.command("stats", async (ctx) => {
        const settings = await db.botSettings.findFirst();
        const conversation = settings?.conversation || "Not set";
        await ctx.reply(`Active conversation: ${conversation}`);
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

    // Handle messages mentioning the bot
    const botName = await getBotName();
    bot.hears(new RegExp(`\\b(${botName})\\b`, "i"), async (ctx) => {
        await ctx.sendChatAction("typing");

        try {
            const messages = await db.message.findMany({
                orderBy: { createdAt: "asc" },
                take: 100,
            });

            const formattedMessages = messages.map((msg) => ({
                role: msg.role,
                content: msg.content,
            }));

            formattedMessages.push({
                role: "user",
                content: `${ctx.message.from.first_name}: ${ctx.message.text}`,
            });

            const completion = await createChatCompletion(formattedMessages);

            // Save messages to database
            await db.message.createMany({
                data: [
                    {
                        role: "user",
                        content: `${ctx.message.from.first_name}: ${ctx.message.text}`,
                    },
                    {
                        role: "assistant",
                        content:
                            completion ||
                            "Sorry, I could not generate a response.",
                    },
                ],
            });

            await ctx.reply(
                completion || "Sorry, I could not generate a response."
            );
        } catch (error) {
            console.error("Error processing message:", error);
            await ctx.reply("Sorry, I had trouble processing your message.");
        }
    });

    // Handle all other messages
    bot.on("message", async (ctx) => {
        try {
            // Handle images
            if ("photo" in ctx.message && ctx.message.photo) {
                const photo = ctx.message.photo[ctx.message.photo.length - 1];
                const fileLink = await ctx.telegram.getFileLink(photo.file_id);
                const caption = await generateImageCaption(fileLink.href);

                await db.message.create({
                    data: {
                        role: "user",
                        content: `image_description: ${caption}`,
                    },
                });

                if ("caption" in ctx.message && ctx.message.caption) {
                    await db.message.create({
                        data: {
                            role: "user",
                            content: `${ctx.message.from.first_name}: ${ctx.message.caption}`,
                        },
                    });
                }
            } else if ("text" in ctx.message && ctx.message.text) {
                await db.message.create({
                    data: {
                        role: "user",
                        content: `${ctx.message.from.first_name}: ${ctx.message.text}`,
                    },
                });
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

async function getBotName(): Promise<string> {
    const settings = await db.botSettings.findFirst();
    return settings?.name || "assistant";
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
