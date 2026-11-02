import { roleLabels } from "./domain";
import type { Command, Member, Role } from "./types";

export const supportedRole = (role: string): role is Exclude<Role, "viewer"> =>
  Object.hasOwn(roleLabels, role);
export const accountState = (member: Member) =>
  !supportedRole(member.role)
    ? "pending"
    : member.active
      ? "active"
      : "disabled";
export const accountRoleLabel = (member: Member) =>
  supportedRole(member.role) ? roleLabels[member.role] : "Chưa phân quyền";
export const needsTeam = (role: string) =>
  ["leader", "telesale"].includes(role);

export function memberUpdate(
  member: Member,
  changes: { name: string; role: Role; active: boolean; teamId: string },
): Extract<Command, { type: "member" }> {
  return {
    type: "member",
    id: member.id,
    name: changes.name.trim(),
    role: changes.role,
    active: changes.active,
    ...(needsTeam(changes.role) &&
    changes.teamId !== (member.teamId ?? "default")
      ? { teamId: changes.teamId }
      : {}),
    expected: {
      name: member.name,
      role: member.role,
      active: member.active,
      teamId: member.teamId ?? "default",
    },
  };
}
