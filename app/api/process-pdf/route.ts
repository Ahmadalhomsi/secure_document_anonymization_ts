import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { readFile } from 'fs/promises';

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const { filename, encryptionOptions } = await req.json();

    // Validate filename
    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    // Sanitize filename and construct file path
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'pdfs', sanitizedFilename);

    // Read the PDF file
    let pdfBytes;
    try {
      pdfBytes = await readFile(filePath);
    } catch (error) {
      console.error('Error reading file:', error);
      return NextResponse.json(
        { error: `Could not read file: ${filePath}` },
        { status: 404 }
      );
    }

    // Prepare FormData for Python FastAPI service
    const formData = new FormData();
    formData.append('file', new Blob([pdfBytes]), sanitizedFilename);
    formData.append('options', JSON.stringify(encryptionOptions));

    // Call Python FastAPI service
    const pythonServiceUrl = 'http://localhost:8000/process-pdf'; // Replace with your FastAPI URL
    const response = await fetch(pythonServiceUrl, {
      method: 'POST',
      body: formData,
    });

    // Handle Python service response
    if (!response.ok) {
      const errorDetails = await response.text();
      console.error('Python service error:', errorDetails);
      return NextResponse.json(
        { error: 'Python service failed', details: errorDetails },
        { status: 500 }
      );
    }

    // Extract processed PDF and mapping data
    const [pdfResponse, mappingResponse] = await Promise.all([
      response.blob(),
      response.json(),
    ]);

    // Save the processed PDF
    const processedDir = path.join(process.cwd(), 'pdfs', 'processed');
    await fs.mkdir(processedDir, { recursive: true });

    const newPdfFilename = sanitizedFilename.replace('.pdf', '-anonymized.pdf');
    const newPdfPath = path.join(processedDir, newPdfFilename);
    await fs.writeFile(newPdfPath, Buffer.from(await pdfResponse.arrayBuffer()));

    // Save the encryption mapping
    const mappingFilename = sanitizedFilename.replace('.pdf', '-encryption-map.json');
    const mappingPath = path.join(processedDir, mappingFilename);
    await fs.writeFile(mappingPath, JSON.stringify(mappingResponse, null, 2));

    // Return success response
    return NextResponse.json({
      success: true,
      originalFilename: sanitizedFilename,
      newFilename: newPdfFilename,
      mappingFilename,
      processedFilePath: `pdfs/processed/${newPdfFilename}`,
      encryptedData: mappingResponse.encrypted_data,
      sensitiveDataFound: mappingResponse.sensitive_data_found,
      authorCount: mappingResponse.encrypted_data.length,
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
    return NextResponse.json(
      {
        error: 'Failed to process PDF',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}