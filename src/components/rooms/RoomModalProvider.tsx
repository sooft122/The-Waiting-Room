"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { signIn, useSession } from "next-auth/react";
import type { Room } from "@/lib/rooms";
import CreateRoomModal from "./CreateRoomModal";
import RoomCreatedModal from "./RoomCreatedModal";

type ModalState = { kind: "none" } | { kind: "create" } | { kind: "created"; room: Room };

type RoomModalContextValue = {
  openCreateRoom: () => void;
};

const RoomModalContext = createContext<RoomModalContextValue | null>(null);

export function useRoomModal() {
  const ctx = useContext(RoomModalContext);
  if (!ctx) {
    throw new Error("useRoomModal must be used within RoomModalProvider");
  }
  return ctx;
}

export default function RoomModalProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [state, setState] = useState<ModalState>({ kind: "none" });

  const openCreateRoom = useCallback(() => {
    // Anonymous accounts can't create rooms — send them straight into
    // sign-in instead of opening a form the server will reject anyway.
    if (status !== "authenticated") {
      signIn("google");
      return;
    }
    setState({ kind: "create" });
  }, [status]);
  const close = useCallback(() => setState({ kind: "none" }), []);
  const handleCreated = useCallback((room: Room) => setState({ kind: "created", room }), []);

  return (
    <RoomModalContext.Provider value={{ openCreateRoom }}>
      {children}
      {state.kind === "create" ? (
        <CreateRoomModal onClose={close} onCreated={handleCreated} />
      ) : null}
      {state.kind === "created" ? (
        <RoomCreatedModal room={state.room} onClose={close} />
      ) : null}
    </RoomModalContext.Provider>
  );
}
