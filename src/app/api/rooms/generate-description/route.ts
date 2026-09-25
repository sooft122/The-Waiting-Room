import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import Anthropic from "@anthropic-ai/sdk";
import { authOptions } from "@/lib/auth";
import { getAnthropicClient } from "@/lib/anthropic";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_CHARS = 400;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Sign in with Google to generate a description." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, category } = (body ?? {}) as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "A room name is required." }, { status: 400 });
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: "Room name is too long." }, { status: 400 });
  }
  const categoryLabel = typeof category === "string" && category.trim() ? category.trim() : null;

  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return NextResponse.json(
      { error: "AI generation isn't configured on the server." },
      { status: 503 },
    );
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 300,
      output_config: { effort: "low" },
      system:
        "You write short, punchy event descriptions for a countdown/waiting-room page, in the " +
        "voice of a product landing page blurb — confident, concrete, and specific to the event, " +
        "never generic filler. Write 2-4 sentences, under " +
        MAX_DESCRIPTION_CHARS +
        " characters total. Reply with only the description text — no titles, quotes, or markdown.",
      messages: [
        {
          role: "user",
          content: categoryLabel
            ? `Room name: "${name.trim()}"\nCategory: ${categoryLabel}`
            : `Room name: "${name.trim()}"`,
        },
      ],
    });

    const textBlock = message.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    const description = textBlock?.text.trim();
    if (!description) {
      return NextResponse.json({ error: "The AI didn't return a description." }, { status: 502 });
    }

    return NextResponse.json({ description: description.slice(0, MAX_DESCRIPTION_CHARS) });
  } catch (err) {
    console.error("generate-description: Anthropic request failed", err);
    return NextResponse.json({ error: "Description generation failed — please try again." }, { status: 502 });
  }
}
