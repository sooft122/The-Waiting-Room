"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_PRESETS,
  describeAccess,
  matchingPreset,
  normalizePermissions,
  type AdminPermission,
} from "@/lib/admin/permissions";
import type { AdminPerson } from "@/lib/admin/types";
import { useAdmin, type AccessTarget } from "./AdminContext";
import { timeAgo } from "./format";
import { CheckIcon, CopyIcon, CrownIcon, LinkIcon, SearchIcon, ShieldIcon, UserPlusIcon } from "./icons";
import { Avatar, Badge, Button, CheckMark, Dialog, TextInput, cx } from "./ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SUGGESTIONS = 5;

/** Adding someone as an admin, or changing what an admin can do. Only the
 * owner ever gets here (the API refuses anyone else regardless). */
export default function AccessDialog({ target, onClose }: { target: AccessTarget | null; onClose: () => void }) {
  return (
    <Dialog open={!!target} onClose={onClose} width={600} labelledBy="access-title" className="overflow-hidden">
      {target ? <AccessForm key={`${target.mode}:${target.email ?? ""}`} target={target} onClose={onClose} /> : null}
    </Dialog>
  );
}

function findPerson(people: AdminPerson[] | null, email: string): AdminPerson | null {
  return people?.find((person) => person.kind === "google" && person.identity.toLowerCase() === email) ?? null;
}

function AccessForm({ target, onClose }: { target: AccessTarget; onClose: () => void }) {
  const { snapshot, people, me, change, confirm, openAccess, now } = useAdmin();
  const owners = snapshot?.team.owners ?? [];
  const members = snapshot?.team.members ?? [];
  const editing = target.mode === "edit";
  const fixedEmail = target.email?.trim().toLowerCase() ?? null;
  const member = editing ? members.find((item) => item.email === fixedEmail) ?? null : null;

  const [emailInput, setEmailInput] = useState("");
  const [permissions, setPermissions] = useState<AdminPermission[]>(member?.permissions ?? []);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [added, setAdded] = useState<{ email: string; name: string } | null>(null);

  const email = fixedEmail ?? emailInput.trim().toLowerCase();
  const person = findPerson(people, email);
  const name = person?.name ?? email;
  const chosen = useMemo(() => new Set(permissions), [permissions]);
  const preset = matchingPreset(permissions);

  // Only matters while adding: is this an account that can be made an admin?
  const emailProblem: { message: string; action?: ReactNode } | null = (() => {
    if (editing) return null;
    if (!EMAIL_PATTERN.test(email)) {
      return touched && email ? { message: "Enter their full Google account email, like name@gmail.com." } : null;
    }
    if (owners.includes(email)) {
      return {
        message:
          email === me.email.toLowerCase()
            ? "That's you — the owner always has full access."
            : "That's the owner account — it always has full access.",
      };
    }
    if (members.some((item) => item.email === email)) {
      return {
        message: "They're already an admin.",
        action: (
          <button
            type="button"
            className="font-medium text-white/85 underline decoration-white/30 underline-offset-2 hover:decoration-white"
            onClick={() => openAccess({ mode: "edit", email })}
          >
            Edit their access
          </button>
        ),
      };
    }
    if (person?.suspended) return { message: "They're suspended — lift their suspension first." };
    return null;
  })();

  const unchanged =
    editing &&
    !!member &&
    member.permissions.length === permissions.length &&
    member.permissions.every((id) => chosen.has(id));
  const canSave = editing ? !!member && !unchanged : EMAIL_PATTERN.test(email) && !emailProblem;

  function toggle(ids: AdminPermission[], on: boolean) {
    setPermissions((current) => {
      const next = new Set(current);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return normalizePermissions(Array.from(next));
    });
  }

  async function save() {
    setTouched(true);
    if (!canSave) return;
    setSaving(true);
    const result = await change(editing ? "admin.update" : "admin.add", { email, permissions });
    setSaving(false);
    if (!result) return;
    if (editing) onClose();
    else setAdded({ email, name });
  }

  async function remove() {
    const ok = await confirm({
      title: `Remove ${name} as an admin?`,
      body: "They lose access to this dashboard straight away — if they have it open, it closes within seconds. You can undo this.",
      confirmLabel: "Remove admin",
      tone: "danger",
    });
    if (!ok) return;
    setRemoving(true);
    const result = await change("admin.remove", { email });
    setRemoving(false);
    if (result) onClose();
  }

  if (added) return <AddedStep email={added.email} name={added.name} onDone={onClose} />;

  if (editing && !member) {
    return (
      <div className="p-6">
        <h2 id="access-title" className="text-[17px] font-semibold tracking-[-0.01em]">
          They aren&apos;t an admin anymore
        </h2>
        <p className="mt-2 text-[13.5px] leading-[1.55] text-white/55">
          {fixedEmail} was removed as an admin. You can add them again from Settings.
        </p>
        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex max-h-[calc(100vh-32px)] flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="flex flex-col gap-4 border-b border-white/[0.07] px-5 pb-5 pt-6 sm:px-6">
        <div className="flex items-start gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] border border-white/[0.09] bg-gradient-to-b from-[#26262c] to-[#1a1a1f] text-[#c4b5fd] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            {editing ? <ShieldIcon size={19} /> : <UserPlusIcon size={19} />}
          </span>
          <div className="min-w-0">
            <h2 id="access-title" className="text-[17px] font-semibold tracking-[-0.01em]">
              {editing ? "Edit access" : "Add an admin"}
            </h2>
            <p className="mt-0.5 text-[13px] leading-[1.5] text-white/50">
              {editing
                ? "Choose what they can change. It applies the moment you save — even on a dashboard they already have open."
                : "They'll open the dashboard with your link, signed in with this Google account."}
            </p>
          </div>
        </div>

        {fixedEmail ? (
          <PersonLine email={fixedEmail} person={person} now={now} />
        ) : (
          <EmailField
            value={emailInput}
            onChange={setEmailInput}
            onBlur={() => setTouched(true)}
            people={people}
            excluded={[...owners, ...members.map((item) => item.email)]}
            person={person}
            problem={emailProblem}
            now={now}
          />
        )}
        {fixedEmail && emailProblem ? (
          <p className="-mt-2 text-[12.5px] text-[#ff9a9d]">{emailProblem.message}</p>
        ) : null}
      </div>

      <div className="admin-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-1.5">
          {PERMISSION_PRESETS.map((item) => {
            const active = preset?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setPermissions(item.permissions)}
                className={cx(
                  "h-8 rounded-[10px] px-3 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#8fb2ff]/50",
                  active
                    ? "bg-white text-[#111114]"
                    : "bg-white/[0.05] text-white/65 ring-1 ring-inset ring-white/[0.07] hover:bg-white/[0.09] hover:text-white",
                )}
              >
                {item.label}
              </button>
            );
          })}
          {!preset ? (
            <span className="flex h-8 items-center rounded-[10px] bg-white/[0.1] px-3 text-[12.5px] font-medium text-white ring-1 ring-inset ring-white/[0.14]">
              Custom
            </span>
          ) : null}
          <span className="ml-auto pl-2 text-[12px] tabular-nums text-white/40">
            {permissions.length} of {ALL_PERMISSIONS.length} allowed
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {PERMISSION_GROUPS.map((group) => {
            const ids = group.permissions.map((permission) => permission.id);
            const count = ids.filter((id) => chosen.has(id)).length;
            const state = count === 0 ? "off" : count === ids.length ? "on" : "mixed";
            return (
              <div key={group.label} className="overflow-hidden rounded-[16px] border border-white/[0.07] bg-white/[0.02]">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={state === "mixed" ? "mixed" : state === "on"}
                  onClick={() => toggle(ids, state !== "on")}
                  className="flex w-full items-center gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-left outline-none transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.05]"
                >
                  <CheckMark state={state} />
                  <span className="flex-1 text-[13px] font-semibold tracking-[-0.005em]">{group.label}</span>
                  <span className="text-[12px] tabular-nums text-white/40">
                    {count} of {ids.length}
                  </span>
                </button>
                {group.permissions.map((permission) => {
                  const on = chosen.has(permission.id);
                  return (
                    <button
                      key={permission.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle([permission.id], !on)}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.05]"
                    >
                      <span className="pt-px">
                        <CheckMark state={on ? "on" : "off"} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className={cx("text-[13.5px] font-medium", on ? "text-white" : "text-white/80")}>
                            {permission.label}
                          </span>
                          {permission.permanent ? <Badge tone="red">Can&apos;t be undone</Badge> : null}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-white/45">
                          {permission.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-[14px] bg-white/[0.03] px-3.5 py-3 text-[12.5px] leading-[1.5] text-white/50 ring-1 ring-inset ring-white/[0.05]">
          <span className="mt-px shrink-0 text-[#fcd34d]">
            <CrownIcon size={15} />
          </span>
          <span>
            Every admin can look around the whole dashboard — these decide what they can change. Adding, editing and
            removing admins always stays with you.
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-white/[0.07] px-5 py-4 sm:px-6">
        {editing ? (
          <Button variant="dangerGhost" loading={removing} onClick={() => void remove()}>
            Remove admin
          </Button>
        ) : (
          <span className="hidden text-[12.5px] text-white/40 sm:block">{describeAccess(permissions)}</span>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!canSave}>
            {editing ? "Save changes" : "Add admin"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Whose access this is: their name and photo once they've signed in. */
function PersonLine({ email, person, now }: { email: string; person: AdminPerson | null; now: number }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
      <Avatar name={person?.name ?? email} image={person?.image} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium">{person?.name ?? email}</p>
        <p className="truncate text-[12px] text-white/45">
          {person ? `${email} · active ${timeAgo(person.lastSeenAt ?? person.firstSeenAt, now)}` : "Hasn't signed in yet"}
        </p>
      </div>
    </div>
  );
}

/** Type an email — or part of a name, to pick from accounts that have signed in. */
function EmailField({
  value,
  onChange,
  onBlur,
  people,
  excluded,
  person,
  problem,
  now,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  people: AdminPerson[] | null;
  excluded: string[];
  person: AdminPerson | null;
  problem: { message: string; action?: ReactNode } | null;
  now: number;
}) {
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const query = value.trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (!query || !people) return [];
    return people
      .filter(
        (candidate) =>
          candidate.kind === "google" &&
          !candidate.suspended &&
          !excluded.includes(candidate.identity.toLowerCase()) &&
          candidate.identity.toLowerCase() !== query &&
          `${candidate.name} ${candidate.identity}`.toLowerCase().includes(query),
      )
      .sort((a, b) => {
        const starts = (candidate: AdminPerson) =>
          candidate.name.toLowerCase().startsWith(query) || candidate.identity.toLowerCase().startsWith(query) ? 0 : 1;
        return starts(a) - starts(b) || (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? "");
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [query, people, excluded]);

  const open = focused && suggestions.length > 0;
  const pick = (candidate: AdminPerson) => {
    onChange(candidate.identity);
    setActive(0);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="access-email" className="text-[12.5px] font-medium text-white/70">
        Google account
      </label>
      <TextInput
        id="access-email"
        type="email"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        leading={<SearchIcon size={15} />}
        value={value}
        maxLength={254}
        placeholder="name@gmail.com, or search people"
        onChange={(event) => {
          onChange(event.target.value);
          setActive(0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur();
        }}
        onKeyDown={(event) => {
          if (!open) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => Math.min(index + 1, suggestions.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && !EMAIL_PATTERN.test(query)) {
            event.preventDefault();
            pick(suggestions[Math.min(active, suggestions.length - 1)]);
          }
        }}
      />
      {open ? (
        <div role="listbox" aria-label="Matching accounts" className="rounded-[14px] border border-white/[0.07] bg-black/20 p-1">
          {suggestions.map((candidate, index) => (
            <button
              key={candidate.identity}
              type="button"
              role="option"
              aria-selected={index === active}
              // Picked before the input's blur hides the list.
              onMouseDown={(event) => {
                event.preventDefault();
                pick(candidate);
              }}
              onMouseMove={() => setActive(index)}
              className={cx(
                "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left",
                index === active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]",
              )}
            >
              <Avatar name={candidate.name} image={candidate.image} size={26} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{candidate.name}</span>
                <span className="block truncate text-[11.5px] text-white/40">{candidate.identity}</span>
              </span>
              <span className="shrink-0 text-[11.5px] text-white/30">
                {timeAgo(candidate.lastSeenAt ?? candidate.firstSeenAt, now)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {problem ? (
        <p className="flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-[#ff9a9d]">
          {problem.message}
          {problem.action}
        </p>
      ) : EMAIL_PATTERN.test(query) ? (
        person ? (
          <p className="flex items-center gap-1.5 text-[12.5px] text-[#6ee7b7]">
            <CheckIcon size={13} />
            {person.name} — signed in {timeAgo(person.lastSeenAt ?? person.firstSeenAt, now)}
          </p>
        ) : (
          <p className="text-[12.5px] text-white/40">
            Nobody has signed in with this account yet. They can as soon as you add them.
          </p>
        )
      ) : null}
    </div>
  );
}

/** After adding someone: they still need the link to get in. */
function AddedStep({ email, name, onDone }: { email: string; name: string; onDone: () => void }) {
  const { adminKey, notify } = useAdmin();
  const link = typeof window !== "undefined" ? `${window.location.origin}/admin/${adminKey}` : "";
  return (
    <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
      <span className="animate-admin-pop flex size-12 items-center justify-center rounded-full bg-[#34d399]/15 text-[#6ee7b7] ring-1 ring-inset ring-[#34d399]/25">
        <CheckIcon size={22} />
      </span>
      <h2 id="access-title" className="mt-4 max-w-full truncate text-[18px] font-semibold tracking-[-0.015em]">
        {name === email ? "They're now an admin" : `${name} is now an admin`}
      </h2>
      <p className="mt-1.5 max-w-[400px] text-[13.5px] leading-[1.55] text-white/50">
        Send them the dashboard link. It opens for them once they&apos;re signed in as{" "}
        <span className="text-white/80">{email}</span> — and still for nobody else.
      </p>
      <div className="mt-5 flex w-full max-w-[460px] items-center gap-2 rounded-[13px] border border-white/[0.07] bg-black/25 p-1.5 pl-3">
        <span className="shrink-0 text-white/35">
          <LinkIcon size={15} />
        </span>
        <span className="min-w-0 flex-1 truncate text-left font-mono text-[12px] text-white/60">{link}</span>
        <Button
          size="sm"
          icon={<CopyIcon size={14} />}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              notify("Dashboard link copied", "success");
            } catch {
              notify("Couldn't copy — your browser blocked it.", "error");
            }
          }}
        >
          Copy
        </Button>
      </div>
      <Button variant="primary" className="mt-6 min-w-[120px]" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
