import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// filepath: c:/Users/tarik/OneDrive/Documents/VSCode Proj/secure_document_anonymization_ts/app/api/paperStatus/route.ts

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const trackingNumber = searchParams.get('trackingNumber');

        if (!trackingNumber) {
            return NextResponse.json(
                { error: 'Missing tracking number' },
                { status: 400 }
            );
        }

        const paper = await prisma.paper.findUnique({
            where: { trackingNumber },
        });

        if (!paper) {
            return NextResponse.json(
                { error: 'Paper not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ paper }, { status: 200 });
    } catch (error) {
        console.error('Error in paper status API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}