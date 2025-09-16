import { db } from "$lib/database.js";
import { error } from "@sveltejs/kit";

/**
 * Authentication utilities for bot-based API authentication
 */

export interface AuthenticatedBot {
    id: string;
    name: string;
    isActive: boolean;
}

/**
 * Extract bot ID from various sources (Authorization header, query params, request body)
 */
export function extractBotId(request: Request, url?: URL): string | null {
    // 1. Check Authorization header (Bearer token format)
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.substring(7);
    }

    // 2. Check X-Bot-ID header
    const botIdHeader = request.headers.get("x-bot-id");
    if (botIdHeader) {
        return botIdHeader;
    }

    // 3. Check query parameter
    if (url) {
        const botIdParam = url.searchParams.get("botId");
        if (botIdParam) {
            return botIdParam;
        }
    }

    return null;
}

/**
 * Validate that a bot ID exists and is active
 */
export async function validateBotId(
    botId: string
): Promise<AuthenticatedBot | null> {
    if (!botId) {
        return null;
    }

    try {
        const bot = await db.bot.findUnique({
            where: { id: botId },
            select: {
                id: true,
                name: true,
                isActive: true,
            },
        });

        if (!bot || !bot.isActive) {
            return null;
        }

        return bot;
    } catch (error) {
        console.error("Error validating bot ID:", error);
        return null;
    }
}

/**
 * Authenticate a request using bot ID
 * Returns the authenticated bot or throws an error
 */
export async function authenticateBot(
    request: Request,
    url?: URL
): Promise<AuthenticatedBot> {
    const botId = extractBotId(request, url);

    if (!botId) {
        throw error(
            401,
            "Authentication required. Provide bot ID via Authorization header, X-Bot-ID header, or botId query parameter."
        );
    }

    const bot = await validateBotId(botId);

    if (!bot) {
        throw error(401, "Invalid or inactive bot ID");
    }

    return bot;
}

/**
 * Create authentication headers for client requests
 */
export function createAuthHeaders(botId: string): Record<string, string> {
    return {
        Authorization: `Bearer ${botId}`,
        "X-Bot-ID": botId,
    };
}

/**
 * Helper to get bot ID from request body (for POST/PUT requests)
 */
export async function getBotIdFromBody(
    request: Request
): Promise<string | null> {
    try {
        const body = await request.json();
        return body.botId || null;
    } catch {
        return null;
    }
}
