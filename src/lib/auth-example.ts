/**
 * Example usage of the authentication system
 * This file demonstrates how to use the bot authentication in your application
 */

import { createAuthHeaders } from "$lib/auth.js";

// Example: Making authenticated API requests from the client side
export async function exampleApiCalls() {
    const botId = "your-bot-id-here"; // This would come from your bot management

    // Method 1: Using Authorization header (Bearer token)
    const response1 = await fetch("/api/context", {
        headers: {
            Authorization: `Bearer ${botId}`,
            "Content-Type": "application/json",
        },
    });

    // Method 2: Using X-Bot-ID header
    const response2 = await fetch("/api/messages", {
        headers: {
            "X-Bot-ID": botId,
            "Content-Type": "application/json",
        },
    });

    // Method 3: Using query parameter (for GET requests)
    const response3 = await fetch(`/api/context?botId=${botId}`);

    // Method 4: Using the helper function
    const response4 = await fetch("/api/jobs", {
        headers: {
            ...createAuthHeaders(botId),
            "Content-Type": "application/json",
        },
    });

    // Example POST request with authentication
    const response5 = await fetch("/api/messages", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${botId}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            role: "user",
            content: "Hello, bot!",
        }),
    });
}

// Example: Server-side usage in a SvelteKit load function
export async function load({ request, url }) {
    try {
        // This would be used in a load function to authenticate requests
        const { authenticateBot } = await import("$lib/auth.js");
        const bot = await authenticateBot(request, url);

        // Now you have access to the authenticated bot
        console.log(`Authenticated bot: ${bot.name} (${bot.id})`);

        return {
            bot: bot,
        };
    } catch (error) {
        // Handle authentication error
        throw error;
    }
}
