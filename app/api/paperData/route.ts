import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { inputData, trackingNumber } = await req.json(); // Parse JSON body from the request
        console.log("Received data:", inputData);

        // Iterate over the inputData array and save each item to the database
        for (const item of inputData) {
            if (item.name) {
                await prisma.paperData.create({
                    data: {
                        content: item.name.encrypted,
                        type: "name",
                        trackingNumber: trackingNumber,
                    },
                });
            } else if (item.email) {
                await prisma.paperData.create({
                    data: {
                        content: item.email.encrypted,
                        type: "email",
                        trackingNumber: trackingNumber,
                    },
                });
            } else if (item.affiliation) {
                await prisma.paperData.create({
                    data: {
                        content: item.affiliation.encrypted,
                        type: "affiliation",
                        trackingNumber: trackingNumber,
                    },
                });
            }
        }

        return NextResponse.json({ message: "Data saved successfully" }, { status: 200 });
    } catch (error) {
        console.log("Error saving data:", error);
        return NextResponse.json({ message: "Error saving data" }, { status: 500 });
    }
}