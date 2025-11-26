import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { RowDataPacket } from "mysql2";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { clerkId, name, email, image } = body;

        if (!clerkId || !email) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM users WHERE clerk_id = ?", [clerkId]);

        if (rows.length === 0) {
            await db.query("INSERT INTO users (clerk_id, name, email, image) VALUES (?, ?, ?, ?)", [
                clerkId,
                name,
                email,
                image,
            ]);
        } else {
            await db.query("UPDATE users SET name = ?, email = ?, image = ? WHERE clerk_id = ?", [name, email, image, clerkId]);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error syncing user:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
