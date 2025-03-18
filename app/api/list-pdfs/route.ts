// File: app/api/list-pdfs/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Fetch papers with tracking numbers and file paths from the database
    const papers = await prisma.paper.findMany({
      select: {
        trackingNumber: true,
        filePath: true,
        category: true,
      },
    });

    // Return the list of papers with tracking numbers and file paths
    return NextResponse.json({ files: papers });
  } catch (error) {
    console.error('Error fetching papers:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch papers',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
