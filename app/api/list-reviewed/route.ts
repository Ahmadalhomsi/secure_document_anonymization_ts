import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Define the path to your PDFs folder
    const pdfsFolderPath = path.join(process.cwd(), 'pdfs', 'reviewed');

    // Check if the directory exists
    if (!fs.existsSync(pdfsFolderPath)) {
      return NextResponse.json({
        error: 'PDFs directory not found',
        files: []
      }, { status: 404 });
    }

    // Read the directory contents
    const filesInDirectory = fs.readdirSync(pdfsFolderPath)
      .filter(file => file.toLowerCase().endsWith('.pdf'));

    // Fetch metadata from the database
    const papers = await prisma.paper.findMany({
      where: {
        filePath: {
          not: null,
        },
      },
      select: {
        trackingNumber: true,
        filePath: true,
        category: true,
      },
    });

    console.log('Files in directory:', filesInDirectory);
    console.log('Papers in database:', papers);

    // Combine the file list with database metadata
    const files = papers.filter(paper =>
      filesInDirectory.includes(path.basename(paper.filePath || ''))
    );

    console.log('Combined files:', files);
    

    // Return the combined list
    return NextResponse.json({ files });
  } catch (error) {
    console.error('Error listing PDF files:', error);
    return NextResponse.json({
      error: 'Failed to list PDF files',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}