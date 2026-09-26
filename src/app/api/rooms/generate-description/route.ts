import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import Anthropic from "@anthropic-ai/sdk";
import { authOptions } from "@/lib/auth";
import { getAnthropicClient } from "@/lib/anthropic";
import { generateTemplateDescription } from "@/lib/descriptionTemplate";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_CHARS = 400;
const MAX_PREVIOUS_LENGTH = 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, category, date, previous } = (body ?? {}) as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "A room name is required." }, { status: 400 });
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: "Room name is too long." }, { status: 400 });
  }
  const roomName = name.trim();
  const categoryLabel = typeof category === "string" && category.trim() ? category.trim() : null;
  const isoDate = typeof date === "string" && ISO_DATE.test(date) ? date : null;
  const previousText =
    typeof previous === "string" ? previous.slice(0, MAX_PREVIOUS_LENGTH) : null;

  // The free, template-written description — used unless Claude is both
  // configured and available to this viewer, and as the fallback if the
  // Claude request fails, so the button always produces something.
  const templateResponse = () =>
    NextResponse.json({
      description: generateTemplateDescription({
        name: roomName,
        category: categoryLabel,
        date: isoDate,
        previous: previousText,
      }),
    });

  const anthropic = getAnthropicClient();
  if (!anthropic) return templateResponse();

  // Paid API credits are reserved for signed-in creators; everyone else
  // still gets a template description rather than an error.
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return templateResponse();

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
            ? `Room name: "${roomName}"\nCategory: ${categoryLabel}`
            : `Room name: "${roomName}"`,
        },
      ],
    });

    const textBlock = message.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    const description = textBlock?.text.trim();
    if (!description) return templateResponse();

    return NextResponse.json({ description: description.slice(0, MAX_DESCRIPTION_CHARS) });
  } catch (err) {
    console.error("generate-description: Anthropic request failed, using a template instead", err);
    return templateResponse();
  }
}
