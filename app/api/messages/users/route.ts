// pages/api/messages/users.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get unique senders
    const users = await prisma.message.findMany({
      distinct: ['sender'],
      select: { sender: true }
    });

    return NextResponse.json(
      users.map(user => user.sender), 
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}