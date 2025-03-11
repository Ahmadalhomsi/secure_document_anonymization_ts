// File: src/app/api/list-processed/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
    try {
        const processedDir = path.join(process.cwd(), 'pdfs', 'processed');

        // Check if the directory exists
        try {
            await fs.access(processedDir);
        } catch (error) {
            // Create the directory if it doesn't exist
            await fs.mkdir(processedDir, { recursive: true });
            console.log('Created processed directory:', processedDir, error);
            return NextResponse.json({ files: [] });
        }

        // Read the directory
        const files = await fs.readdir(processedDir);

        // Get file stats for each file
        const fileDetails = await Promise.all(
            files.map(async (filename) => {
                const filePath = path.join(processedDir, filename);
                const stats = await fs.stat(filePath);
                return {
                    name: filename,
                    path: `pdfs/processed/${filename}`,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime,
                };
            })
        );

        // Sort by most recently modified
        fileDetails.sort((a, b) => b.modified.getTime() - a.modified.getTime());

        return NextResponse.json({ files: fileDetails });
    } catch (error) {
        console.error('Error listing processed files:', error);
        return NextResponse.json({ error: 'Failed to list processed files' }, { status: 500 });
    }
}