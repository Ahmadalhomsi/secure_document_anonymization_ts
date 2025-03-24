import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';


// Zod schema for log creation validation
export const LogSchema = z.object({
  action: z.string().min(1, "Action is required"),
  actor: z.string().min(1, "Actor is required"),
  target: z.string().min(1, "Target is required")
});

export async function GET() {
  try {
    const logs = await prisma.log.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(logs, { status: 200 });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = LogSchema.parse(body);

    const newLog = await prisma.log.create({
      data: validatedData
    });

    return NextResponse.json(newLog, { status: 201 });
  } catch (error) {
    console.error("Error creating log:", error);
    return NextResponse.json({ error: "Failed to create log" }, { status: 500 });
  }
}

export async function DELETE() {
    try {
      // Delete all logs
      await prisma.log.deleteMany();
  
      return NextResponse.json({ message: "All logs cleared successfully" }, { status: 200 });
    } catch (error) {
      console.error("Error clearing logs:", error);
      return NextResponse.json({ error: "Failed to clear logs" }, { status: 500 });
    }
  }