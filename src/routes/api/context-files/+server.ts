import { json, type RequestHandler } from "@sveltejs/kit";
import { db } from "$lib/database.js";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { withAuth } from "$lib/middleware.js";
import OpenAI from "openai";

// GET /api/context-files - Get all context files for a bot
export const GET: RequestHandler = withAuth(async ({ bot }) => {
    try {
        const contextFiles = await db.contextFile.findMany({
            where: { botId: bot.id },
            orderBy: { createdAt: "desc" },
        });

        return json({ contextFiles });
    } catch (error) {
        console.error("Error fetching context files:", error);
        return json(
            { error: "Failed to fetch context files" },
            { status: 500 }
        );
    }
});

// POST /api/context-files - Upload a context file (PDF) for the authenticated bot
export const POST: RequestHandler = withAuth(async ({ request, bot }) => {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const parsedText = formData.get("parsedText") as string;

        if (!file) {
            return json({ error: "No file provided" }, { status: 400 });
        }

        if (!parsedText) {
            return json({ error: "No parsed text provided" }, { status: 400 });
        }

        // Check if file is PDF
        if (file.type !== "application/pdf") {
            return json(
                { error: "Only PDF files are supported" },
                { status: 400 }
            );
        }

        // Generate unique filename while preserving original name
        const fileExtension = file.name.split(".").pop();
        const uniqueFilename = `${randomUUID()}.${fileExtension}`;
        const originalName = file.name;

        // Create upload directory if it doesn't exist
        const uploadPath = join(process.cwd(), "static", "upload", "files");
        try {
            await mkdir(uploadPath, { recursive: true });
        } catch (error) {
            // Directory might already exist
        }

        // Save file with unique name
        const filePath = join(uploadPath, uniqueFilename);
        const arrayBuffer = await file.arrayBuffer();
        await writeFile(filePath, Buffer.from(arrayBuffer));

        // Generate AI summary of the parsed text
        let summary = `PDF file uploaded: ${originalName}`;
        try {
            // Fetch full bot data to get API key and model
            const fullBot = await db.bot.findUnique({
                where: { id: bot.id },
                select: { openaiKey: true, model: true },
            });

            // Check if bot has OpenAI API key
            if (!fullBot?.openaiKey) {
                throw new Error("No OpenAI API key configured for this bot");
            }

            // Determine how much text to send (max ~10k chars to balance detail and token usage)
            const maxChars = 10000;
            const textToSummarize =
                parsedText.length > maxChars
                    ? parsedText.substring(0, maxChars) +
                      "\n\n[Note: Document continues beyond this point]"
                    : parsedText;

            // Create OpenAI client with bot's API key
            const openai = new OpenAI({
                apiKey: fullBot.openaiKey,
            });

            // Create a summarization prompt optimized for AI context
            const summaryPrompt = `Summarize the following document in a way that can be used as context for AI conversations. Include:
- Main topics and key concepts
- Important facts, data, and information
- Relevant details that would help an AI assistant answer questions about this content

Be comprehensive but concise. Focus on information density rather than narrative flow.

Document:
${textToSummarize}`;

            // Make direct API call to OpenAI
            const completion = await openai.chat.completions.create({
                model: fullBot.model || "gpt-5-nano",
                messages: [
                    {
                        role: "system",
                        content:
                            "You are an AI assistant specialized in creating dense, information-rich summaries optimized for use as context in AI systems. Extract and preserve all key information, facts, concepts, and details in a clear, organized format.",
                    },
                    { role: "user", content: summaryPrompt },
                ],
            });

            summary =
                completion.choices[0]?.message?.content?.trim() ||
                `PDF file uploaded: ${originalName}`;
        } catch (summaryError) {
            console.error("Error generating AI summary:", summaryError);
            // Fall back to basic summary with text preview
            summary = `PDF file uploaded: ${originalName}. Contains approximately ${
                parsedText.length
            } characters of text. Preview: ${parsedText.substring(0, 200)}...`;
        }

        // Save context file record to database with AI-generated summary
        const contextFile = await db.contextFile.create({
            data: {
                filename: uniqueFilename,
                originalName: originalName,
                path: filePath,
                summary: summary,
                parsedText: parsedText || null, // Store the full parsed text
                botId: bot.id,
            },
        });

        return json({ success: true, contextFile });
    } catch (error) {
        console.error("Error uploading context file:", error);
        return json(
            { error: "Failed to upload context file" },
            { status: 500 }
        );
    }
});

// DELETE /api/context-files/[id] - Delete a context file
export const DELETE: RequestHandler = withAuth(async ({ url, bot }) => {
    try {
        const fileId = url.searchParams.get("id");

        if (!fileId) {
            return json({ error: "File ID is required" }, { status: 400 });
        }

        // Find the context file
        const contextFile = await db.contextFile.findFirst({
            where: {
                id: fileId,
                botId: bot.id, // Ensure user can only delete their own files
            },
        });

        if (!contextFile) {
            return json({ error: "Context file not found" }, { status: 404 });
        }

        // Delete the physical file
        try {
            await unlink(contextFile.path);
        } catch (error) {
            console.error("Error deleting physical file:", error);
            // Continue with database deletion even if file deletion fails
        }

        // Delete the database record
        await db.contextFile.delete({
            where: { id: fileId },
        });

        return json({
            success: true,
            message: "Context file deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting context file:", error);
        return json(
            { error: "Failed to delete context file" },
            { status: 500 }
        );
    }
});
