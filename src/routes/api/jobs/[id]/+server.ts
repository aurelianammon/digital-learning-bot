import { json } from "@sveltejs/kit";
import { db } from "$lib/database.js";
import { scheduleJob, cancelJob } from "$lib/services/scheduler.js";
import type { RequestHandler } from "./$types.js";

// PUT /api/jobs/[id] - Update a job
export const PUT: RequestHandler = async ({ params, request }) => {
    try {
        const { id } = params;
        const { type, message, date, state } = await request.json();

        const job = await db.job.update({
            where: { id },
            data: {
                ...(type && { type }),
                ...(message && { message }),
                ...(date && { date: new Date(date) }),
                ...(state !== undefined && { state }),
            },
        });

        // Update the scheduler - cancel existing and reschedule if active
        cancelJob(id);
        if (job.state) {
            scheduleJob(job);
        }

        return json(job);
    } catch (error) {
        console.error("Error updating job:", error);
        return json({ error: "Failed to update job" }, { status: 500 });
    }
};

// DELETE /api/jobs/[id] - Delete a job
export const DELETE: RequestHandler = async ({ params }) => {
    try {
        const { id } = params;

        // Cancel the job from the scheduler first
        cancelJob(id);

        // Get associated files before deleting the job
        const jobWithFiles = await db.job.findUnique({
            where: { id },
            include: { files: true },
        });

        // Delete the job (this will cascade delete file records)
        await db.job.delete({
            where: { id },
        });

        // Delete physical files
        if (jobWithFiles?.files) {
            const { unlink } = await import("fs/promises");
            const { join } = await import("path");

            for (const file of jobWithFiles.files) {
                try {
                    // Handle both absolute and relative paths
                    let filePath = file.path;
                    if (!filePath.startsWith("/") && !filePath.includes(":")) {
                        // If it's a relative path, make it absolute
                        filePath = join(process.cwd(), filePath);
                    }

                    await unlink(filePath);
                    console.log(`Deleted physical file: ${filePath}`);
                } catch (error) {
                    console.warn(
                        `Failed to delete physical file ${file.path}:`,
                        error
                    );
                }
            }
        }

        return json({ success: true });
    } catch (error) {
        console.error("Error deleting job:", error);
        return json({ error: "Failed to delete job" }, { status: 500 });
    }
};
