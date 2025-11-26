import { hf } from "@/lib/ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        const response = await hf.chatCompletion({
            model: "Qwen/Qwen2.5-72B-Instruct",
            messages: messages,
            max_tokens: 1000,
        });

        return NextResponse.json(response.choices[0].message);
    } catch (error) {
        console.error("Error generating AI response:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
