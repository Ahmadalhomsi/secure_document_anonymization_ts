import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(request: NextRequest, { params }: { params: { filename: string } }) {
  const { filename } = await params;
  const filePath = path.join(process.cwd(), 'pdfs', 'decrypted', filename);

  if (fs.existsSync(filePath)) {
    const fileContents = fs.readFileSync(filePath);
    return new NextResponse(fileContents, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } else {
    console.log('File not found in decrypted folder');
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
