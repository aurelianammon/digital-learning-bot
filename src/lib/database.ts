import { PrismaClient } from "@prisma/client";

declare global {
    var __prisma: PrismaClient | undefined;
}

export const db = globalThis.__prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalThis.__prisma = db;
}

// Initialize default data
export async function initializeDatabase() {
    try {
        // Check if context exists, if not create default
        const contextExists = await db.context.findFirst();
        if (!contextExists) {
            await db.context.create({
                data: {
                    content: "Define bot context here",
                },
            });
        }

        console.log("Database initialized successfully");
    } catch (error) {
        console.error("Error initializing database:", error);
    }
}
