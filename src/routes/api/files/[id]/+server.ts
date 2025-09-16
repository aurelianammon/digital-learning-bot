import { json } from "@sveltejs/kit";
import { db } from "$lib/database.js";
import { unlink } from "fs/promises";
import type { RequestHandler } from "./$types.js";

// PUT /api/files/[id] - Update a file (associate with job)
export const PUT: RequestHandler = async ({ params, request }) => {
    try {
        const { id } = params;
        const { jobId } = await request.json();

        const fileRecord = await db.file.update({
            where: { id },
            data: { jobId },
        });

        return json({ success: true, file: fileRecord });
    } catch (error) {
        console.error("Error updating file:", error);
        return json({ error: "Failed to update file" }, { status: 500 });
    }
};

// DELETE /api/files/[id] - Delete a file
export const DELETE: RequestHandler = async ({ params }) => {
    try {
        const { id } = params;

        // Find the file record
        const fileRecord = await db.file.findUnique({
            where: { id },
        });

        if (!fileRecord) {
            return json({ error: "File not found" }, { status: 404 });
        }

        // Delete the physical file
        try {
            await unlink(fileRecord.path);
        } catch (error) {
            console.warn(
                "Physical file not found, continuing with database deletion:",
                error
            );
        }

        // Delete the database record
        await db.file.delete({
            where: { id },
        });

        return json({ success: true });
    } catch (error) {
        console.error("Error deleting file:", error);
        return json({ error: "Failed to delete file" }, { status: 500 });
    }
};
