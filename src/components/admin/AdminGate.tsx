"use client";

import { signIn } from "next-auth/react";
import { ShieldIcon } from "./icons";
import { Button, Card } from "./ui";

/** What the dashboard link shows before it knows you're an admin. Only
 * reachable with the link's secret key — without it, it's a plain 404. */
export default function AdminGate({ state, email }: { state: "signed-out" | "not-admin"; email?: string }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0c] p-4 font-inter text-white antialiased">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[18%] h-[380px] w-[560px] -translate-x-1/2 rounded-full bg-[#4453d6]/[0.14] blur-[120px]" />
      </div>
      <Card className="animate-admin-rise w-full max-w-[400px] px-7 py-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-[14px] border border-white/[0.1] bg-gradient-to-b from-[#1c1d22] to-[#111215] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src="/icons/logo.svg" className="h-5 w-auto" />
        </span>
        <h1 className="mt-5 text-[21px] font-semibold tracking-[-0.02em]">Waiting Room admin</h1>
        <p className="mx-auto mt-2 max-w-[300px] text-[13.5px] leading-[1.55] text-white/50">
          {state === "signed-out"
            ? "Sign in with your admin Google account to open the dashboard."
            : `You're signed in as ${email}, which doesn't have admin access.`}
        </p>
        <Button
          variant="primary"
          size="lg"
          className="mt-6 w-full"
          icon={<ShieldIcon size={16} />}
          onClick={() =>
            signIn(
              "google",
              { callbackUrl: window.location.href },
              state === "not-admin" ? { prompt: "select_account" } : undefined,
            )
          }
        >
          {state === "signed-out" ? "Continue with Google" : "Use a different account"}
        </Button>
      </Card>
    </div>
  );
}
