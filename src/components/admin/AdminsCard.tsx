"use client";

import { ALL_PERMISSIONS, PERMISSION_GROUPS, describeAccess, permissionInfo } from "@/lib/admin/permissions";
import type { AdminMember, AdminPerson } from "@/lib/admin/types";
import { useAdmin } from "./AdminContext";
import { plural, timeAgo } from "./format";
import { CheckIcon, CopyIcon, CrownIcon, LockIcon, PencilIcon, ShieldIcon, UserIcon, UserPlusIcon, XIcon } from "./icons";
import { ActionMenu, Avatar, Badge, Button, Card, CardHeader, MenuItem, MenuSeparator, cx } from "./ui";

const MAX_CHIPS = 4;

function findPerson(people: AdminPerson[] | null, email: string): AdminPerson | null {
  return people?.find((person) => person.kind === "google" && person.identity.toLowerCase() === email) ?? null;
}

/** Everyone who can open the dashboard. The owner adds, edits and removes
 * admins here; everyone else just sees who's who. */
export function AdminsCard({ className }: { className?: string }) {
  const { snapshot, people, me, deny, openAccess, notify, adminKey } = useAdmin();
  const owners = snapshot?.team.owners ?? [];
  const members = snapshot?.team.members ?? [];
  const isOwner = me.role === "owner";
  const myEmail = me.email.toLowerCase();

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/admin/${adminKey}`);
      notify("Dashboard link copied", "success");
    } catch {
      notify("Couldn't copy — your browser blocked it.", "error");
    }
  }

  return (
    <Card className={cx("p-5 sm:p-6", className)}>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Admins
            {snapshot ? (
              <span className="rounded-full bg-white/[0.07] px-1.5 py-px text-[11px] tabular-nums text-white/55">
                {owners.length + members.length}
              </span>
            ) : null}
          </span>
        }
        subtitle={
          isOwner
            ? "Who can open this dashboard, and what each of them can change. Only you can add or remove admins."
            : "Who can open this dashboard. Only the owner can add or remove admins, or change what they can do."
        }
        action={
          <Button
            size="sm"
            variant="primary"
            icon={<UserPlusIcon size={14} />}
            locked={deny("owner")}
            onClick={() => openAccess({ mode: "add" })}
          >
            Add admin
          </Button>
        }
      />

      <div className="mt-5 flex flex-col gap-2">
        {owners.map((email) => (
          <AdminRow key={email} email={email} member={null} person={findPerson(people, email)} isYou={email === myEmail} />
        ))}
        {members.map((member) => (
          <AdminRow
            key={member.email}
            email={member.email}
            member={member}
            person={findPerson(people, member.email)}
            isYou={member.email === myEmail}
          />
        ))}
        {snapshot && members.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-[16px] border border-dashed border-white/[0.09] px-5 py-6 text-center">
            <p className="text-[13.5px] font-medium text-white/80">No other admins yet</p>
            <p className="max-w-[360px] text-[12.5px] leading-[1.5] text-white/40">
              {isOwner
                ? "Add someone — or open anyone's profile in People — and choose exactly what they can change."
                : "The owner hasn't added anyone else."}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
        {isOwner ? (
          <>
            <p className="text-[12.5px] leading-[1.5] text-white/40">
              New admins open the dashboard with your link, signed in with the Google account you added.
            </p>
            <Button size="sm" icon={<CopyIcon size={14} />} onClick={() => void copyLink()}>
              Copy dashboard link
            </Button>
          </>
        ) : (
          <p className="flex items-center gap-2 text-[12.5px] text-white/40">
            <LockIcon size={14} />
            Adding and removing admins is up to the owner.
          </p>
        )}
      </div>
    </Card>
  );
}

function AdminRow({
  email,
  member,
  person,
  isYou,
}: {
  email: string;
  /** Null for the owner. */
  member: AdminMember | null;
  person: AdminPerson | null;
  isYou: boolean;
}) {
  const { me, now, openAccess, change, confirm, focusOn } = useAdmin();
  const name = person?.name ?? email;
  const isFull = member ? member.permissions.length === ALL_PERMISSIONS.length : true;
  const chips = member && !isFull ? member.permissions : [];

  async function remove() {
    const ok = await confirm({
      title: `Remove ${name} as an admin?`,
      body: "They lose access to this dashboard straight away — if they have it open, it closes within seconds. You can undo this.",
      confirmLabel: "Remove admin",
      tone: "danger",
    });
    if (ok) await change("admin.remove", { email });
  }

  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-white/[0.06] bg-white/[0.025] px-3.5 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Avatar name={name} image={person?.image} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[13.5px] font-medium">{name}</span>
            {isYou ? <span className="shrink-0 text-[12px] text-white/35">You</span> : null}
          </div>
          <p className="truncate text-[12px] text-white/40">
            {person ? email : `${email === name ? "" : `${email} · `}Hasn't signed in yet`}
            {member ? ` · added ${timeAgo(member.addedAt, now)}` : ""}
          </p>
          {member ? (
            chips.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {chips.slice(0, MAX_CHIPS).map((id) => (
                  <span
                    key={id}
                    className="rounded-full bg-white/[0.05] px-2 py-[3px] text-[11.5px] text-white/60 ring-1 ring-inset ring-white/[0.05]"
                  >
                    {permissionInfo(id).label}
                  </span>
                ))}
                {chips.length > MAX_CHIPS ? (
                  <span
                    className="rounded-full px-1.5 py-[3px] text-[11.5px] text-white/40"
                    title={chips.slice(MAX_CHIPS).map((id) => permissionInfo(id).label).join(", ")}
                  >
                    +{chips.length - MAX_CHIPS} more
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-[12px] text-white/40">
                {isFull ? "Can change everything except who's an admin." : "Can look around, but can't change anything."}
              </p>
            )
          ) : (
            <p className="mt-1 text-[12px] text-white/40">Full access, and the only one who can manage admins.</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 pl-[50px] sm:pl-0">
        {member ? (
          <Badge tone="violet" icon={<ShieldIcon size={12} />}>
            {describeAccess(member.permissions)}
          </Badge>
        ) : (
          <Badge tone="amber" icon={<CrownIcon size={12} />}>
            Owner
          </Badge>
        )}
        {member && me.role === "owner" ? (
          <>
            <Button size="sm" icon={<PencilIcon size={13} />} onClick={() => openAccess({ mode: "edit", email })}>
              Edit access
            </Button>
            <ActionMenu label={`More for ${name}`}>
              {(close) => (
                <>
                  <MenuItem
                    icon={<PencilIcon size={15} />}
                    onSelect={() => {
                      close();
                      openAccess({ mode: "edit", email });
                    }}
                  >
                    Edit access
                  </MenuItem>
                  {person ? (
                    <MenuItem
                      icon={<UserIcon size={15} />}
                      onSelect={() => {
                        close();
                        focusOn({ tab: "people", identity: person.identity });
                      }}
                    >
                      View profile
                    </MenuItem>
                  ) : null}
                  <MenuSeparator />
                  <MenuItem
                    tone="danger"
                    icon={<XIcon size={15} />}
                    onSelect={() => {
                      close();
                      void remove();
                    }}
                  >
                    Remove admin
                  </MenuItem>
                </>
              )}
            </ActionMenu>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** For admins other than the owner: exactly what they can and can't change. */
export function YourAccessCard() {
  const { me } = useAdmin();
  const allowed = me.permissions.length;
  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        title="Your access"
        subtitle={
          allowed === 0
            ? "You can look around the whole dashboard, but not change anything. The owner decides what you can do."
            : `You can look around the whole dashboard and make ${plural(allowed, "kind")} of change. The owner decides what you can do.`
        }
        action={
          <Badge tone="violet" icon={<ShieldIcon size={12} />}>
            {describeAccess(me.permissions)}
          </Badge>
        }
      />
      <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 text-[11.5px] font-medium uppercase tracking-[0.06em] text-white/35">{group.label}</p>
            {group.permissions.map((permission) => {
              const on = me.permissions.includes(permission.id);
              return (
                <div key={permission.id} className="flex items-center gap-2.5 py-[5px] text-[13px]">
                  <span
                    className={cx(
                      "flex size-5 shrink-0 items-center justify-center rounded-full",
                      on ? "bg-[#34d399]/15 text-[#6ee7b7]" : "bg-white/[0.05] text-white/30",
                    )}
                  >
                    {on ? <CheckIcon size={12} /> : <LockIcon size={11} />}
                  </span>
                  <span className={on ? "text-white/85" : "text-white/35"}>{permission.label}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}
