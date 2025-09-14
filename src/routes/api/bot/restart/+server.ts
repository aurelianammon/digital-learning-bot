import { json } from "@sveltejs/kit";
import { restartTelegramBot } from "$lib/services/telegram.js";
import type { RequestHandler } from "./$types.js";

export const POST: RequestHandler = async () => {
    try {
        console.log("🔄 API: Restarting Telegram bot...");
        await restartTelegramBot();
        console.log("✅ API: Bot restarted successfully");
        return json({ success: true, message: "Bot restarted successfully" });
    } catch (error) {
        console.error("❌ API: Error restarting bot:", error);
        return json(
            { success: false, error: "Failed to restart bot" },
            { status: 500 }
        );
    }
};
