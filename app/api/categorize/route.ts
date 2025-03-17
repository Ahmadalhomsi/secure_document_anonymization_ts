import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        const { trackingNumber, category } = await request.json();

        if (!trackingNumber || !category) {
            return NextResponse.json(
                { error: "Tracking number and category are required." },
                { status: 400 }
            );
        }

        const updatedPaper = await prisma.paper.update({
            where: { trackingNumber },
            data: { category },
        });

        return NextResponse.json(updatedPaper, { status: 200 });
    } catch (error) {
        console.error("Error updating category:", error);
        return NextResponse.json(
            { error: "Failed to update category." },
            { status: 500 }
        );
    }
}