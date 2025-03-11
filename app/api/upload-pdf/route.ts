// File: src/app/api/upload-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdir } from 'fs/promises';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }
    
    // Check file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }
    
    // Convert the file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Create the pdfs directory if it doesn't exist
    const pdfsDir = join(process.cwd(), 'pdfs');
    try {
      await mkdir(pdfsDir, { recursive: true });
    } catch (error) {
        console.log('Directory already exists or cannot be created', error);
    }
    
    // Create a unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name}`;
    const filepath = join(pdfsDir, filename);
    
    // Write the file to the server
    await writeFile(filepath, buffer);
    
    // Return the filename for further processing
    return NextResponse.json({ 
      message: 'File uploaded successfully',
      filename
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

// Increase the limit for the request body size
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};