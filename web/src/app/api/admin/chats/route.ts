import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { userId, targetUserId } = await req.json();

    if (!userId || !targetUserId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { data: newChat, error: chatError } = await supabaseAdmin
      .from("chats")
      .insert({})
      .select("id")
      .single();

    if (chatError || !newChat) {
      throw chatError || new Error("Failed to create chat");
    }

    const { error: partError } = await supabaseAdmin.from("chat_participants").insert([
      { chat_id: newChat.id, profile_id: userId },
      { chat_id: newChat.id, profile_id: targetUserId },
    ]);

    if (partError) {
      throw partError;
    }

    return NextResponse.json({ success: true, chatId: newChat.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
