import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const { trackingNumber } = await req.json();

    // Validate trackingNumber and originalFileName
    if (!trackingNumber) {
      return NextResponse.json(
        { error: 'Tracking number and original file name are required' },
        { status: 400 }
      );
    }

    // Fetch the Paper record
    const paper = await prisma.paper.findUnique({
      where: { trackingNumber },
    });

    if(!paper) {
      return NextResponse.json(
        { error: `Paper with tracking number ${trackingNumber} not found` },
        { status: 404 }
      );
    }

    // Construct the new file path
    const newFilePath = `reviewed_${trackingNumber}_${paper.filePath}`;

    // Update the status and filePath of the Paper record
    const updatedPaper = await prisma.paper.update({
      where: { trackingNumber },
      data: {
        status: 'reviewed',
        filePath: newFilePath,
      },
    });

    // Return success response
    return NextResponse.json({
      success: true,
      message: `Paper with tracking number ${trackingNumber} has been marked as reviewed.`,
      updatedPaper,
    });
  } catch (error) {
    console.error('Error updating paper status:', error);
    return NextResponse.json(
      {
        error: 'Failed to update paper status',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
