import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Define the path to your PDFs folder
    const pdfsFolderPath = path.join(process.cwd(), 'pdfs', 'processed');
    
    // Check if the directory exists
    if (!fs.existsSync(pdfsFolderPath)) {
      return NextResponse.json({ 
        error: 'PDFs directory not found',
        files: [] 
      }, { status: 404 });
    }
    
    // Read the directory contents
    const files = fs.readdirSync(pdfsFolderPath)
      .filter(file => file.toLowerCase().endsWith('.pdf'));
    
    // Return the list of PDF files
    return NextResponse.json({ files });
  } catch (error) {
    console.error('Error listing PDF files:', error);
    return NextResponse.json({ 
      error: 'Failed to list PDF files',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}