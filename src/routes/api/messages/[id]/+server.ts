import { json } from '@sveltejs/kit';
import { db } from '$lib/database.js';
import type { RequestHandler } from './$types.js';

// DELETE /api/messages/[id] - Delete a message
export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { id } = params;
		
		await db.message.delete({
			where: { id }
		});

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting message:', error);
		return json({ error: 'Failed to delete message' }, { status: 500 });
	}
};