import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { clerkId, name, workoutPlan, dietPlan, isActive } = body;

        if (!clerkId) {
            return NextResponse.json({ error: "Missing clerkId" }, { status: 400 });
        }

        const [users] = await db.query<RowDataPacket[]>("SELECT id FROM users WHERE clerk_id = ?", [clerkId]);
        if (users.length === 0) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        const dbUserId = users[0].id;

        if (isActive) {
            await db.query("UPDATE plans SET is_active = FALSE WHERE user_id = ?", [dbUserId]);
        }

        const [result] = await db.query<ResultSetHeader>(
            "INSERT INTO plans (user_id, name, workout_plan, diet_plan, is_active) VALUES (?, ?, ?, ?, ?)",
            [dbUserId, name, JSON.stringify(workoutPlan), JSON.stringify(dietPlan), isActive]
        );

        return NextResponse.json({ planId: result.insertId });
    } catch (error) {
        console.error("Error creating plan:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const clerkId = searchParams.get("clerkId");

    if (!clerkId) {
        return NextResponse.json({ error: "Missing clerkId" }, { status: 400 });
    }

    try {
        const [users] = await db.query<RowDataPacket[]>("SELECT id FROM users WHERE clerk_id = ?", [clerkId]);
        if (users.length === 0) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        const dbUserId = users[0].id;

        const [plans] = await db.query("SELECT * FROM plans WHERE user_id = ? ORDER BY created_at DESC", [dbUserId]);
        return NextResponse.json(plans);
    } catch (error) {
        console.error("Error fetching plans:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
