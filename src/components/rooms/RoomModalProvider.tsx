"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { signIn, useSession } from "next-auth/react";
import type { Room } from "@/lib/rooms";
import { useSiteState } from "@/components/providers/SiteStateProvider";
import CreateRoomModal from "./CreateRoomModal";
import RoomCreatedModal from "./RoomCreatedModal";
import RoomCreationLockedModal from "./RoomCreationLockedModal";

type ModalState =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "created"; room: Room }
  | { kind: "locked"; interrupted: boolean };

type RoomModalContextValue = {
  openCreateRoom: () => void;
  /** The admin has paused room creation — Create Room buttons show a lock. */
  roomCreationLocked: boolean;
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
  const { roomCreation } = useSiteState();
  const [state, setState] = useState<ModalState>({ kind: "none" });

  const openCreateRoom = useCallback(() => {
    // Checked first, so nobody is sent through sign-in only to find it paused.
    if (roomCreation.locked) {
      setState({ kind: "locked", interrupted: false });
      return;
    }
    // Anonymous accounts can't create rooms — send them straight into
    // sign-in instead of opening a form the server will reject anyway.
    if (status !== "authenticated") {
      signIn("google");
      return;
    }
    setState({ kind: "create" });
  }, [status, roomCreation.locked]);

  // Paused while the form is open: swap it for the notice rather than let
  // them finish a room the server will refuse.
  useEffect(() => {
    if (!roomCreation.locked) return;
    setState((prev) => (prev.kind === "create" ? { kind: "locked", interrupted: true } : prev));
  }, [roomCreation.locked]);
  const close = useCallback(() => setState({ kind: "none" }), []);
  const handleCreated = useCallback((room: Room) => setState({ kind: "created", room }), []);

  return (
    <RoomModalContext.Provider value={{ openCreateRoom, roomCreationLocked: roomCreation.locked }}>
      {children}
      {state.kind === "create" ? (
        <CreateRoomModal onClose={close} onCreated={handleCreated} />
      ) : null}
      {state.kind === "created" ? (
        <RoomCreatedModal room={state.room} onClose={close} />
      ) : null}
      {state.kind === "locked" ? (
        <RoomCreationLockedModal
          message={roomCreation.message}
          interrupted={state.interrupted}
          onClose={close}
        />
      ) : null}
    </RoomModalContext.Provider>
  );
}
