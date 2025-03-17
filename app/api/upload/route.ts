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
    
    // Check if a paper with the same authorEmail and originalFileName already exists
    const existingPaper = await prisma.paper.findFirst({
      where: {
        authorEmail,
        originalFileName,
      },
    });
    
    // Generate tracking number - reuse existing one if paper exists
    const trackingNumber = existingPaper 
      ? existingPaper.trackingNumber 
      : Math.random().toString(36).substring(2, 15);
    
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
    
    let paper;
    
    if (existingPaper) {
      // Update existing paper entry
      paper = await prisma.paper.update({
        where: {
          id: existingPaper.id
        },
        data: {
          status: 'pending', // Reset status for the new submission
          filePath: `pdfs/${fileName}`,
          // Only update fields that should be refreshed
          // Keep feedback and feedbackScore if you want to preserve them
        },
      });
      
      // Optionally, delete the old file if the path is different
      if (existingPaper.filePath && existingPaper.filePath !== `pdfs/${fileName}`) {
        try {
          const oldFilePath = join(process.cwd(), existingPaper.filePath);
          // You may want to use fs.unlink to delete the old file
          // await unlink(oldFilePath);
          console.log(`Previous file could be deleted at: ${oldFilePath}`);
        } catch (err) {
          console.error('Error deleting old file:', err);
          // Continue even if file deletion fails
        }
      }
    } else {
      // Create new paper entry
      paper = await prisma.paper.create({
        data: {
          trackingNumber,
          authorEmail,
          originalFileName,
          status: 'pending',
          filePath: `pdfs/${fileName}`,
          category: 'uncategorized',
        },
      });
    }
    
    return NextResponse.json(
      { 
        trackingNumber: paper.trackingNumber, 
        fileName, 
        isReplacement: !!existingPaper 
      }, 
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in upload API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}