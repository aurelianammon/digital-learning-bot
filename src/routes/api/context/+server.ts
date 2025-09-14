import { json } from '@sveltejs/kit';
import { db } from '$lib/database.js';
import type { RequestHandler } from './$types.js';

// GET /api/context - Get the current context
export const GET: RequestHandler = async () => {
	try {
		const context = await db.context.findFirst();
		return json(context?.content || '');
	} catch (error) {
		console.error('Error fetching context:', error);
		return json({ error: 'Failed to fetch context' }, { status: 500 });
	}
};

// PUT /api/context - Update the context
export const PUT: RequestHandler = async ({ request }) => {
	try {
		const { content } = await request.json();
		
		if (content === undefined) {
			return json({ error: 'Missing content field' }, { status: 400 });
		}

		// Get the first context record or create one
		let context = await db.context.findFirst();
		
		if (context) {
			context = await db.context.update({
				where: { id: context.id },
				data: { content }
			});
		} else {
			context = await db.context.create({
				data: { content }
			});
		}

		return json(context);
	} catch (error) {
		console.error('Error updating context:', error);
		return json({ error: 'Failed to update context' }, { status: 500 });
	}
};