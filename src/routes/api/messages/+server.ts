import { json } from '@sveltejs/kit';
import { db } from '$lib/database.js';
import type { RequestHandler } from './$types.js';

// GET /api/messages - Get all messages
export const GET: RequestHandler = async () => {
	try {
		const messages = await db.message.findMany({
			orderBy: { createdAt: 'asc' }
		});
		return json(messages);
	} catch (error) {
		console.error('Error fetching messages:', error);
		return json({ error: 'Failed to fetch messages' }, { status: 500 });
	}
};

// POST /api/messages - Create a new message
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { role, content } = await request.json();
		
		if (!role || !content) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		const message = await db.message.create({
			data: {
				role,
				content
			}
		});

		return json(message, { status: 201 });
	} catch (error) {
		console.error('Error creating message:', error);
		return json({ error: 'Failed to create message' }, { status: 500 });
	}
};