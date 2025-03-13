import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';


// POST /api/messages
export async function POST(request: NextRequest) {
    const { sender, receiver, message } = await request.json();

    if (!sender || !receiver || !message) {
        console.log(sender, receiver, message);
        
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    try {
        const newMessage = await prisma.message.create({
            data: { sender, receiver, message },
        });
        return NextResponse.json(newMessage, { status: 201 });
    } catch (error) {
        console.log(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET /api/messages
export async function GET() {
    try {
        const messages = await prisma.message.findMany();
        return NextResponse.json(messages, { status: 200 });
    } catch (error : any) {
        console.log(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/messages
export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    try {
        await prisma.message.delete({
            where: { id: Number(id) },
        });
        return NextResponse.json({}, { status: 204 });
    } catch (error : any) {
        console.log(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
