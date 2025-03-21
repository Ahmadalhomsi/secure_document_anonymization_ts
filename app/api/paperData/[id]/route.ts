import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(params: { trackingNumber: string }) {
    const { trackingNumber } = params;
    try {
        const paperData = await prisma.paperData.findMany({
            where: { trackingNumber: trackingNumber },
        });
        return NextResponse.json({ data: paperData }, { status: 200 });
    } catch (error) {
        console.log("Error fetching data:", error);
        return NextResponse.json({ message: "Error fetching data" }, { status: 500 });
    }
}