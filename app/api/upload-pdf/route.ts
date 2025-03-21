import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import PDFParser from 'pdf2json';

export async function POST(req: NextRequest) {
  const { filename } = await req.json();

  if (typeof filename !== 'string' || !filename.endsWith('.pdf')) {
    return new NextResponse('Invalid filename', { status: 400 });
  }

  // Construct the full path to the PDF file in the public/pdfs directory

  const filePath = path.join(process.cwd(), 'pdfs', 'processed', filename);

  try {
    // Check if the file exists
    await fs.access(filePath);

    const pdfParser = new (PDFParser as any)(null, 1);

    return new Promise((resolve, reject) => {
      pdfParser.on('pdfParser_dataError', (errData: any) => {
        console.error(errData.parserError);
        reject(new NextResponse('Error parsing PDF', { status: 500 }));
      });

      pdfParser.on('pdfParser_dataReady', () => {
        const parsedText = (pdfParser as any).getRawTextContent();
        resolve(
          new NextResponse(parsedText, {
            headers: { 'Content-Type': 'text/plain' },
          })
        );
      });

      pdfParser.loadPDF(filePath);
    });
  } catch (error) {
    console.log('Error reading file:', error);
    
    return new NextResponse('File not found', { status: 404 });
  }
}
