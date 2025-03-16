// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdir } from 'fs/promises';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const authorEmail = formData.get('authorEmail') as string;
    const file = formData.get('file') as File;
    const originalFileName = formData.get('originalFileName') as string;

    if (!authorEmail || !file || !originalFileName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate tracking number
    const trackingNumber = Math.random().toString(36).substring(2, 15);
    
    // Create pdfs directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'pdfs');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (err) {
      // Directory might already exist, which is fine
      console.log('Directory creation info:', err);
    }

    // Save the file with a more readable name
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Use a more readable filename format: trackingNumber_originalFileName.pdf
    // Replace spaces and special characters in the original filename
    const cleanFileName = originalFileName.replace(/[^a-zA-Z0-9.]/g, '_');
    const fileName = `${trackingNumber}_${cleanFileName}`;
    
    try {
      await writeFile(join(uploadDir, fileName), buffer);
    } catch (err) {
      console.error('Error saving file:', err);
      return NextResponse.json(
        { error: 'Failed to save file' },
        { status: 500 }
      );
    }


    // Save to database
    const paper = await prisma.paper.create({
      data: {
        trackingNumber,
        authorEmail,
        originalFileName,
        status: 'pending',
        filePath: `pdfs/${fileName}`,
      },
    });

    return NextResponse.json({ trackingNumber: paper.trackingNumber, fileName: fileName }, { status: 201 });
  } catch (error) {
    console.error('Error in upload API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}