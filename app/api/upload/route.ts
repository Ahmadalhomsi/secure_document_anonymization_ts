import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    const { email, file } = await req.json();

    // Save the paper to the database
    const paper = await prisma.paper.create({
        data: {
            authorEmail: email,
            originalFileName: file.name,
            status: "uploaded",
            trackingNumber: "some-tracking-number", // Replace with actual tracking number logic
            author: {
                connect: { email: email } // Assuming author is connected by email
            }
        },
    });

    return NextResponse.json({ trackingNumber: paper.trackingNumber }, { status: 201 });
}

export async function GET() {
    return NextResponse.json({ message: "This is the upload API route." });
}