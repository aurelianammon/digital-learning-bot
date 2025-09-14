import { json } from '@sveltejs/kit';
import { db } from '$lib/database.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { RequestHandler } from './$types.js';

// GET /api/files - Get all files
export const GET: RequestHandler = async () => {
	try {
		const files = await db.file.findMany({
			orderBy: { createdAt: 'desc' }
		});
		
		const result = {
			images: files.filter(f => f.type === 'image').map(f => f.filename),
			videos: files.filter(f => f.type === 'video').map(f => f.filename)
		};
		
		return json(result);
	} catch (error) {
		console.error('Error fetching files:', error);
		return json({ error: 'Failed to fetch files' }, { status: 500 });
	}
};

// POST /api/files - Upload a file
export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File;
		const type = formData.get('type') as string;
		
		if (!file || !type) {
			return json({ error: 'Missing file or type' }, { status: 400 });
		}

		// Create upload directories if they don't exist
		const uploadDir = type === 'IMAGE' ? 'images' : 'videos';
		const uploadPath = join(process.cwd(), 'static', 'upload', uploadDir);
		
		try {
			await mkdir(uploadPath, { recursive: true });
		} catch (error) {
			// Directory might already exist
		}

		// Save file
		const filePath = join(uploadPath, file.name);
		const arrayBuffer = await file.arrayBuffer();
		await writeFile(filePath, Buffer.from(arrayBuffer));

		// Save file record to database
		const fileRecord = await db.file.create({
			data: {
				filename: file.name,
				type: type === 'IMAGE' ? 'image' : 'video',
				path: filePath
			}
		});

		return json({ success: true, file: fileRecord });
	} catch (error) {
		console.error('Error uploading file:', error);
		return json({ error: 'Failed to upload file' }, { status: 500 });
	}
};