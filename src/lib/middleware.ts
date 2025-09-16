import type { RequestHandler } from "@sveltejs/kit";
import { authenticateBot, type AuthenticatedBot } from "$lib/auth.js";

/**
 * Middleware to authenticate bot requests
 * Adds authenticated bot to the request context
 */
export function withAuth(
    handler: (
        event: Parameters<RequestHandler>[0] & { bot: AuthenticatedBot }
    ) => ReturnType<RequestHandler>
): RequestHandler {
    return async (event) => {
        try {
            const bot = await authenticateBot(event.request, event.url);
            return await handler({ ...event, bot });
        } catch (error) {
            // Re-throw authentication errors
            throw error;
        }
    };
}

/**
 * Optional authentication - doesn't throw if no auth provided
 * Useful for routes that can work with or without authentication
 */
export function withOptionalAuth(
    handler: (
        event: Parameters<RequestHandler>[0] & { bot?: AuthenticatedBot }
    ) => ReturnType<RequestHandler>
): RequestHandler {
    return async (event) => {
        try {
            const bot = await authenticateBot(event.request, event.url);
            return await handler({ ...event, bot });
        } catch {
            // If authentication fails, continue without bot context
            return await handler({ ...event, bot: undefined });
        }
    };
}
