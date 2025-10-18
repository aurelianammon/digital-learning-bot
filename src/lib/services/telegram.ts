import { Telegraf } from "telegraf";
import { db } from "$lib/database.js";
import { createChatCompletion, createImage } from "./openai.js";
import { generateImageCaption } from "./imageProcessing.js";
import {
    initializeScheduler,
    setBotInstance,
    cleanupScheduler,
} from "./scheduler.js";
import { shouldBotRespond } from "../utilities/botResponse.js";
import { formatMessagesForAI } from "../utilities/messageFormatter.js";

export let bot: Telegraf | null = null;

/**
 * Helper function to process a message and generate AI response
 * @param ctx - Telegram context
 * @param messageText - The message text to process
 * @param linkedBot - The bot configuration
 * @param errorMessage - Custom error message if processing fails
 */
async function processMessageAndRespond(
    ctx: any,
    messageText: string,
    linkedBot: any,
    errorMessage: string = "Sorry, I had trouble processing your message."
) {
    // Small delay to ensure database write is committed
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check if the bot should respond
    const shouldRespond = await shouldBotRespond(messageText, linkedBot);

    if (linkedBot && shouldRespond) {
        await ctx.sendChatAction("typing");

        try {
            const formattedMessages = await formatMessagesForAI(
                linkedBot.id,
                100
            );

            const completion = await createChatCompletion(
                formattedMessages,
                linkedBot.id
            );

            // Save the assistant response
            await db.message.create({
                data: {
                    role: "assistant",
                    content:
                        completion || "Sorry, I could not generate a response.",
                    name: linkedBot.name,
                    botId: linkedBot.id,
                },
            });

            await ctx.reply(
                completion || "Sorry, I could not generate a response."
            );
        } catch (error) {
            console.error("Error generating AI response:", error);
            await ctx.reply(errorMessage);
        }
    }
}

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

        if (!linkedBot) {
            return;
        }

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

    // Unlink command
    bot.command("unlink", async (ctx) => {
        await db.bot.update({
            where: { linkedChatId: String(ctx.chat.id) },
            data: { linkedChatId: null },
        });
        await ctx.reply("Chat unlinked from bot.");
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

            if (!linkedBot.openaiKey) {
                await ctx.reply(
                    `No OpenAI API key configured for this bot. Please configure the bot in the backend interface.`
                );
                return;
            }

            // Handle voice messages and audio files
            if (
                ("voice" in ctx.message && ctx.message.voice) ||
                ("audio" in ctx.message && ctx.message.audio)
            ) {
                try {
                    await ctx.sendChatAction("typing");

                    // Get the audio file from Telegram
                    let fileId: string;
                    let audioType: string;

                    if ("voice" in ctx.message && ctx.message.voice) {
                        fileId = ctx.message.voice.file_id;
                        audioType = "voice";
                    } else if ("audio" in ctx.message && ctx.message.audio) {
                        fileId = ctx.message.audio.file_id;
                        audioType = "audio";
                    } else {
                        return;
                    }

                    const fileLink = await ctx.telegram.getFileLink(fileId);

                    // Import the transcription function
                    const { transcribeAudio } = await import("./openai.js");

                    // Transcribe the audio
                    const transcribedText = await transcribeAudio(
                        fileLink.href,
                        linkedBot.openaiKey as string
                    );

                    console.log(
                        `🎤 ${audioType} message transcribed:`,
                        transcribedText
                    );

                    // Save the transcribed message
                    await db.message.create({
                        data: {
                            role: "user",
                            content: transcribedText,
                            name: ctx.message.from.first_name,
                            botId: linkedBot?.id || null,
                        },
                    });

                    // Process the transcribed text and generate response
                    await processMessageAndRespond(
                        ctx,
                        transcribedText,
                        linkedBot,
                        "Sorry, I had trouble processing your audio message."
                    );
                } catch (error) {
                    console.error("Error processing audio message:", error);
                    await ctx.reply(
                        "Sorry, I had trouble transcribing your audio message."
                    );
                }
            }
            // Handle images
            else if ("photo" in ctx.message && ctx.message.photo) {
                const photo = ctx.message.photo[ctx.message.photo.length - 1];
                const fileLink = await ctx.telegram.getFileLink(photo.file_id);
                const caption = await generateImageCaption(
                    fileLink.href,
                    linkedBot.openaiKey as string
                );

                await db.message.create({
                    data: {
                        role: "user",
                        name: ctx.message.from.first_name,
                        content: `Sent image showing ${caption}`,
                        botId: linkedBot?.id || null,
                    },
                });

                if ("caption" in ctx.message && ctx.message.caption) {
                    await db.message.create({
                        data: {
                            role: "user",
                            name: ctx.message.from.first_name,
                            content: ctx.message.caption,
                            botId: linkedBot?.id || null,
                        },
                    });
                }
            } else if ("text" in ctx.message && ctx.message.text) {
                // Save the user message
                await db.message.create({
                    data: {
                        role: "user",
                        content: ctx.message.text,
                        name: ctx.message.from.first_name,
                        botId: linkedBot?.id || null,
                    },
                });

                // Process the message and generate response
                await processMessageAndRespond(
                    ctx,
                    ctx.message.text,
                    linkedBot
                );
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

/**
 * Send a photo to a specific chat
 * This is used by the OpenAI service to send generated images
 */
export async function sendPhotoToChat(chatId: string, photoUrl: string) {
    if (!bot) {
        throw new Error("Bot not initialized");
    }
    return await bot.telegram.sendPhoto(chatId, photoUrl);
}

/**
 * Send a voice message to a specific chat
 * This is used by the OpenAI service to send generated audio
 */
export async function sendVoiceToChat(chatId: string, audioPath: string) {
    if (!bot) {
        throw new Error("Bot not initialized");
    }
    const fs = await import("fs");
    return await bot.telegram.sendVoice(chatId, {
        source: fs.createReadStream(audioPath),
    });
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
