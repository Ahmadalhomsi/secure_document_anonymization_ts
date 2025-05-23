import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const { trackingNumber, reviewerProfile, reviewScore, review } = await req.json();
    console.log("AAA");
    console.log(trackingNumber, reviewerProfile, reviewScore, review);
    
    
    
    // Validate trackingNumber
    if (!trackingNumber) {
      return NextResponse.json(
        { error: 'Tracking number is required' },
        { status: 400 }
      );
    }

    // Update the status of the Paper record
    const updatedPaper = await prisma.paper.update({
      where: { trackingNumber },
      data: {
        status: 'reviewed', // Example status
        feedback: review.review_text,
        feedbackScore: reviewScore,
        reviewer: reviewerProfile,
        reviewDate: new Date(),
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
