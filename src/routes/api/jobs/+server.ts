import { json } from "@sveltejs/kit";
import { db } from "$lib/database.js";
import { scheduleJob } from "$lib/services/scheduler.js";
import type { RequestHandler } from "./$types.js";

// GET /api/jobs - Get all jobs
export const GET: RequestHandler = async () => {
    try {
        const jobs = await db.job.findMany({
            orderBy: { date: "asc" },
        });
        return json(jobs);
    } catch (error) {
        console.error("Error fetching jobs:", error);
        return json({ error: "Failed to fetch jobs" }, { status: 500 });
    }
};

// POST /api/jobs - Create a new job
export const POST: RequestHandler = async ({ request }) => {
    try {
        const { type, message, date } = await request.json();

        if (!type || !message || !date) {
            return json({ error: "Missing required fields" }, { status: 400 });
        }

        const job = await db.job.create({
            data: {
                type,
                message,
                date: new Date(date),
            },
        });

        // Add the new job to the scheduler
        scheduleJob(job);

        return json(job, { status: 201 });
    } catch (error) {
        console.error("Error creating job:", error);
        return json({ error: "Failed to create job" }, { status: 500 });
    }
};
