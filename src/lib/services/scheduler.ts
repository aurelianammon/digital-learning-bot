import * as schedule from "node-schedule";
import { db } from "$lib/database.js";

// Bot interface for executing jobs
interface BotInterface {
    sendMessage(chatId: string, message: string, options?: any): Promise<any>;
    sendPhoto(chatId: string, photo: any): Promise<any>;
    sendVideo(chatId: string, video: any): Promise<any>;
}

let botInstance: BotInterface | null = null;
const scheduledJobs = new Map<string, schedule.Job>();
let periodicCheckInterval: NodeJS.Timeout | null = null;
let startupCheckTimeout: NodeJS.Timeout | null = null;

// Debug: Track bot instance changes
let botInstanceSetCount = 0;
const botInstanceHistory: string[] = [];

// Set the bot instance for job execution
export function setBotInstance(bot: BotInterface) {
    botInstanceSetCount++;
    const timestamp = new Date().toISOString();
    botInstanceHistory.push(
        `${timestamp}: setBotInstance called (count: ${botInstanceSetCount})`
    );

    botInstance = bot;
    console.log(
        `✅ Bot instance set for scheduler (call #${botInstanceSetCount})`
    );
    console.log(`🔗 Bot instance available: ${!!botInstance}`);
    console.log(`📝 Bot instance history length: ${botInstanceHistory.length}`);
}

// Health check function
export function getBotInstanceStatus() {
    return {
        available: !!botInstance,
        timestamp: new Date().toISOString(),
        setCount: botInstanceSetCount,
        history: botInstanceHistory.slice(-3), // Last 3 entries
    };
}

export async function initializeScheduler() {
    try {
        // Verify bot instance is available
        console.log(
            `🔍 Scheduler initialization - bot instance available: ${!!botInstance}`
        );

        // Load existing jobs from database
        const jobs = await db.job.findMany({
            where: { state: true },
        });

        for (const job of jobs) {
            scheduleJob(job);
        }

        console.log(`✅ Scheduler initialized with ${jobs.length} jobs`);

        // Set up periodic check for new jobs every 30 seconds
        periodicCheckInterval = setInterval(async () => {
            await checkForNewJobs();
        }, 30000);

        console.log("🔄 Started periodic job checker (every 30 seconds)");

        // Do an immediate check for any new jobs
        startupCheckTimeout = setTimeout(async () => {
            console.log("🔍 Checking for any new jobs after startup...");
            await checkForNewJobs();
        }, 5000);
    } catch (error) {
        console.error("❌ Error initializing scheduler:", error);
        throw error;
    }
}

async function checkForNewJobs() {
    try {
        // Get all active jobs from database
        const allActiveJobs = await db.job.findMany({
            where: { state: true },
        });

        // Check which jobs are not yet scheduled
        for (const job of allActiveJobs) {
            if (!scheduledJobs.has(job.id)) {
                // Only schedule if the job's time hasn't passed yet
                const now = new Date();
                if (job.date > now) {
                    console.log(`📅 Found new job ${job.id}, scheduling...`);
                    scheduleJob(job);
                } else {
                    // console.log(
                    //     `⏰ Job ${job.id} scheduled time has passed (${job.date}), skipping...`
                    // );
                }
            }
        }

        // Remove completed jobs from scheduler
        const activeJobIds = allActiveJobs.map((job) => job.id);
        for (const [jobId, scheduledJob] of scheduledJobs.entries()) {
            if (!activeJobIds.includes(jobId)) {
                console.log(`🗑️ Removing completed/cancelled job ${jobId}`);
                scheduledJob.cancel();
                scheduledJobs.delete(jobId);
            }
        }
    } catch (error) {
        console.error("❌ Error checking for new jobs:", error);
    }
}

export function scheduleJob(job: {
    id: string;
    type: string;
    message: string;
    date: Date;
}) {
    try {
        // Cancel existing job if it exists
        if (scheduledJobs.has(job.id)) {
            scheduledJobs.get(job.id)?.cancel();
        }

        // Create new scheduled job
        const scheduledJob = schedule.scheduleJob(
            job.id,
            job.date,
            async () => {
                // Get fresh bot instance at execution time
                console.log(
                    `🔄 Job ${job.id} executing - getting fresh bot instance`
                );
                console.log(`🔗 Current bot instance exists: ${!!botInstance}`);
                await executeJob(job, botInstance);
            }
        );

        if (scheduledJob) {
            scheduledJobs.set(job.id, scheduledJob);
            const timeUntil = job.date.getTime() - Date.now();
            const timeUntilFormatted =
                timeUntil > 0
                    ? `in ${Math.round(timeUntil / 1000)}s`
                    : "immediately (past due)";
            console.log(
                `📅 Scheduled job ${job.id} (${job.type}) for ${job.date} (${timeUntilFormatted})`
            );
        } else {
            console.error(`❌ Failed to schedule job ${job.id}`);
        }
    } catch (error) {
        console.error(`❌ Error scheduling job ${job.id}:`, error);
    }
}

export function cancelJob(jobId: string) {
    const job = scheduledJobs.get(jobId);
    if (job) {
        job.cancel();
        scheduledJobs.delete(jobId);
        console.log(`❌ Cancelled job ${jobId}`);
    }
}

async function executeJob(
    job: {
        id: string;
        type: string;
        message: string;
        date: Date;
        botId?: string | null;
    },
    botInstanceParam: BotInterface | null = null
) {
    try {
        // Use parameter bot instance first, fallback to module-level instance
        const activeBotInstance = botInstanceParam || botInstance;

        console.log(`🔍 Checking bot instance availability for job ${job.id}`);
        console.log(`🔗 Parameter bot instance exists: ${!!botInstanceParam}`);
        console.log(`🔗 Module bot instance exists: ${!!botInstance}`);
        console.log(`🔗 Active bot instance exists: ${!!activeBotInstance}`);
        console.log(
            `📊 Set count: ${botInstanceSetCount}, History entries: ${botInstanceHistory.length}`
        );

        if (!activeBotInstance) {
            console.error("❌ Bot instance not available for job execution");
            console.error("📜 Bot instance history:", botInstanceHistory);
            console.error("🏥 Full status:", getBotInstanceStatus());
            console.error(
                "💡 This usually means the bot wasn't properly connected to the scheduler"
            );
            return;
        }

        // Get the bot associated with this job
        let conversationId: string | null = null;

        if (job.botId) {
            const bot = await db.bot.findUnique({
                where: { id: job.botId },
                select: { linkedChatId: true, name: true },
            });
            conversationId = bot?.linkedChatId || null;

            if (!conversationId) {
                console.error(
                    `❌ Bot "${
                        bot?.name || "Unknown"
                    }" has no linked chat for job execution`
                );
                console.error(
                    "💡 Use /link command in Telegram to link a chat to this bot"
                );
                return;
            }
        } else {
            // Legacy job without botId - try to find any bot with a linked chat
            const anyBotWithChat = await db.bot.findFirst({
                where: {
                    linkedChatId: { not: null },
                    isActive: true,
                },
                select: { linkedChatId: true, name: true },
            });

            conversationId = anyBotWithChat?.linkedChatId || null;

            if (!conversationId) {
                console.error(
                    "❌ No bot has a linked chat for legacy job execution"
                );
                console.error(
                    "💡 Create and link a bot to a chat to execute jobs"
                );
                return;
            }
        }

        console.log(
            `🎯 Executing job ${job.id} (${job.type}) to conversation: ${conversationId}`
        );

        switch (job.type) {
            case "TEXT":
                await activeBotInstance.sendMessage(
                    conversationId,
                    job.message,
                    {
                        parse_mode: "HTML",
                    }
                );
                console.log("✅ Text message sent successfully");
                break;

            case "IMAGE":
                // Get the associated file for this job
                const imageFile = await db.file.findFirst({
                    where: {
                        jobId: job.id,
                        type: "image",
                    },
                });

                if (imageFile) {
                    await activeBotInstance.sendPhoto(conversationId, {
                        source: imageFile.path,
                    });
                    console.log("✅ Image sent successfully");
                } else {
                    // Fallback for old jobs that might not have file records
                    console.warn(
                        `⚠️ No file record found for job ${job.id}, trying legacy path`
                    );
                    try {
                        await activeBotInstance.sendPhoto(conversationId, {
                            source: `static/upload/images/${job.message}`,
                        });
                        console.log("✅ Image sent successfully (legacy path)");
                    } catch (error) {
                        console.error(
                            `❌ Failed to send image for job ${job.id}:`,
                            error
                        );
                    }
                }
                break;

            case "VIDEO":
                // Get the associated file for this job
                const videoFile = await db.file.findFirst({
                    where: {
                        jobId: job.id,
                        type: "video",
                    },
                });

                if (videoFile) {
                    await activeBotInstance.sendVideo(conversationId, {
                        source: videoFile.path,
                    });
                    console.log("✅ Video sent successfully");
                } else {
                    // Fallback for old jobs that might not have file records
                    console.warn(
                        `⚠️ No file record found for job ${job.id}, trying legacy path`
                    );
                    try {
                        await activeBotInstance.sendVideo(conversationId, {
                            source: `static/upload/videos/${job.message}`,
                        });
                        console.log("✅ Video sent successfully (legacy path)");
                    } catch (error) {
                        console.error(
                            `❌ Failed to send video for job ${job.id}:`,
                            error
                        );
                    }
                }
                break;

            case "PROMPT":
                // For now, just send the prompt as text
                // TODO: Add AI completion logic here
                await activeBotInstance.sendMessage(
                    conversationId,
                    job.message
                );
                console.log("✅ Prompt message sent successfully");
                break;

            default:
                console.error(`❌ Unknown job type: ${job.type}`);
                break;
        }

        // Mark job as completed by setting state to false
        await db.job.update({
            where: { id: job.id },
            data: { state: false },
        });

        console.log(`✅ Job ${job.id} completed successfully`);
    } catch (error) {
        console.error(`❌ Error executing job ${job.id}:`, error);
    }
}

export async function getScheduledJobs() {
    return Array.from(scheduledJobs.keys());
}

// Cleanup function for graceful shutdown
export function cleanupScheduler() {
    console.log("🧹 Cleaning up scheduler...");

    // Clear intervals and timeouts
    if (periodicCheckInterval) {
        clearInterval(periodicCheckInterval);
        periodicCheckInterval = null;
        console.log("✅ Cleared periodic check interval");
    }

    if (startupCheckTimeout) {
        clearTimeout(startupCheckTimeout);
        startupCheckTimeout = null;
        console.log("✅ Cleared startup check timeout");
    }

    // Cancel all scheduled jobs
    for (const [jobId, job] of scheduledJobs.entries()) {
        job.cancel();
        console.log(`✅ Cancelled job: ${jobId}`);
    }
    scheduledJobs.clear();

    // Clear bot instance
    botInstance = null;
    console.log("✅ Scheduler cleanup complete");
}
