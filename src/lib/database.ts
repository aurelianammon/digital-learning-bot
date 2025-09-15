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
        // Database initialization can be added here if needed
        console.log("Database initialized successfully");
    } catch (error) {
        console.error("Error initializing database:", error);
    }
}
