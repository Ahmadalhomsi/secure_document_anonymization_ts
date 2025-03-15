import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/users
export async function GET() {
    try {
        const users = await prisma.user.findMany();
        return NextResponse.json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }
}

// POST /api/users
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, email, role } = body;

        if (!name || !email || !role) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const newUser = await prisma.user.create({
            data: { name, email, role },
        });

        return NextResponse.json(newUser, { status: 201 });
    } catch (error) {
        console.error("Error creating user:", error);
        return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }
}

// PUT /api/users/:id
export async function PUT(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        const body = await request.json();
        const { name, email, role } = body;

        const updatedUser = await prisma.user.update({
            where: { id: parseInt(id) },
            data: { name, email, role },
        });

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error("Error updating user:", error);
        return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }
}

// DELETE /api/users/:id
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        await prisma.user.delete({
            where: { id: parseInt(id) },
        });

        return NextResponse.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("Error deleting user:", error);
        return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
    }
}