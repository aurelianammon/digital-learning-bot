import { initializeTelegramBot } from "$lib/services/telegram.js";
import { initializeDatabase } from "$lib/database.js";
import type { Handle, ServerInit } from "@sveltejs/kit";

// ✅ The proper way to initialize services at server startup
export const init: ServerInit = async () => {
    console.log("🚀 Starting Digital Learning Bot Server...");

    try {
        console.log("📊 Initializing database...");
        await initializeDatabase();

        console.log("🤖 Initializing Telegram bot...");
        await initializeTelegramBot();

        console.log("✅ All services initialized successfully!");
    } catch (error) {
        console.error("❌ Error initializing services:", error);
        throw error; // This will prevent the server from starting if initialization fails
    }
};

// Handle function for processing requests (optional, but good to have)
export const handle: Handle = async ({ event, resolve }) => {
    return resolve(event);
};
