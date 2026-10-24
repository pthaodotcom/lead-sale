import type { Analytics, Database, Member, ReportFilters } from "./types";
import { dayVN } from "./workflow";
import { normalizeCity } from "./catalog";
export const inPeriod = (at: string, f: ReportFilters) =>
  (!f.from || dayVN(at) >= f.from) && (!f.to || dayVN(at) <= f.to);
export function calculateAnalytics(
  db: Database,
  actor: Member,
  f: ReportFilters = {},
): Analytics {
  if (f.from && f.to && f.from > f.to)
    throw new Error("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.");
  const ordered = [...db.assignments].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) ||
      (b.sequence ?? 0) - (a.sequence ?? 0),
  );
  const owner = (id: string, at?: string) =>
    ordered.find((t) => t.leadId === id && (!at || t.createdAt <= at));
  const credited = (l: Database["leads"][number]) =>
    owner(l.id, l.onboardedAt ?? l.activatedAt)?.assigneeId;
  const scoped = db.leads.filter(
    (l) =>
      !l.archived &&
      actor.role !== "admin" &&
      (actor.role === "leader"
        ? (owner(l.id)?.teamId ?? "default") === (actor.teamId ?? "default")
        : actor.role === "telesale"
          ? owner(l.id)?.assigneeId === actor.id
          : true) &&
      (!f.city || normalizeCity(l.city) === f.city) &&
      (!f.source || l.sourceId === f.source) &&
      (!f.status || l.status === f.status),
  );
  const leads = scoped.filter(
    (l) =>
      inPeriod(l.receivedAt, f) &&
      (!f.member || (credited(l) ?? "unassigned") === f.member),
  );
  const activities = db.activities.filter((a) => !a.voidedAt);
  const agreed = (id: string) =>
    activities.some((a) => a.leadId === id && a.decision === "agreed");
  const registered = (l: Database["leads"][number]) =>
    !!l.activatedAt || ["Activated", "Onboarded"].includes(l.status);
  const onboarded = (l: Database["leads"][number]) =>
    !!l.onboardedAt || l.status === "Onboarded";
  const tickets = db.assignments.filter((t) => {
    const l = db.leads.find((l) => l.id === t.leadId);
    return (
      actor.role !== "admin" &&
      (actor.role === "leader"
        ? (t.teamId ?? "default") === (actor.teamId ?? "default")
        : actor.role === "telesale"
          ? t.assigneeId === actor.id
          : true) &&
      inPeriod(t.createdAt, f) &&
      (!f.member || t.assigneeId === f.member) &&
      (!f.city || (l && normalizeCity(l.city) === f.city)) &&
      (!f.source || l?.sourceId === f.source)
    );
  });
  return {
    performance: db.members
      .filter(
        (m) =>
          m.role === "telesale" &&
          (actor.role !== "telesale" || m.id === actor.id) &&
          (actor.role !== "leader" ||
            (m.teamId ?? "default") === (actor.teamId ?? "default")) &&
          (!f.member || m.id === f.member),
      )
      .map((m) => {
        const ts = tickets.filter((t) => t.assigneeId === m.id);
        const latest = ts.map(
          (t) =>
            [...activities]
              .filter((a) => a.assignmentId === t.id)
              .sort(
                (a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id),
              )[0],
        );
        return {
          id: m.id,
          total: ts.length,
          New: ts.filter((t) => t.status === "New").length,
          Open: ts.filter((t) => t.status === "Open").length,
          Solved: ts.filter((t) => t.status === "Solved").length,
          Closed: ts.filter((t) => t.status === "Closed").length,
          called: latest.filter(
            (a) =>
              a &&
              ["called", "activated"].includes(a.outcome) &&
              a.decision !== "hungup",
          ).length,
          no_answer: latest.filter((a) => a?.outcome === "no_answer").length,
          wrong_phone: latest.filter((a) => a?.outcome === "wrong_phone")
            .length,
          agreed: latest.filter((a) => a?.decision === "agreed").length,
          declined: latest.filter((a) => a?.decision === "declined").length,
          hungup: latest.filter((a) => a?.decision === "hungup").length,
          assignedLeads: new Set(ts.map((t) => t.leadId)).size,
          converted: new Set(
            ts
              .filter((t) => {
                const l = db.leads.find((l) => l.id === t.leadId);
                return (
                  l?.onboardedAt && owner(l.id, l.onboardedAt)?.id === t.id
                );
              })
              .map((t) => t.leadId),
          ).size,
          backlog: db.assignments.filter(
            (t) => t.assigneeId === m.id && t.status !== "Closed",
          ).length,
        };
      }),
    conversion: [...new Set(leads.map((l) => credited(l) ?? "unassigned"))].map(
      (id) => {
        const ls = leads.filter((l) => (credited(l) ?? "unassigned") === id);
        return {
          id,
          total: ls.length,
          agreed: ls.filter((l) => agreed(l.id)).length,
          registered: ls.filter(registered).length,
          onboarded: ls.filter(onboarded).length,
        };
      },
    ),
    sources: db.sources.map((s) => {
      const ls = leads.filter((l) => l.sourceId === s.id);
      return {
        id: s.id,
        total: ls.length,
        New: ls.filter((l) => l.status === "New").length,
        Activated: ls.filter((l) => l.status === "Activated").length,
        Onboarded: ls.filter((l) => l.status === "Onboarded").length,
        Closed: ls.filter((l) => l.status === "Closed").length,
        wrongPhone: ls.filter(
          (l) =>
            l.wrongPhone ||
            activities.some(
              (a) => a.leadId === l.id && a.outcome === "wrong_phone",
            ),
        ).length,
      };
    }),
    totals: {
      total: leads.length,
      agreed: leads.filter((l) => agreed(l.id)).length,
      registered: leads.filter(registered).length,
      onboarded: leads.filter(onboarded).length,
      unassigned: scoped.filter(
        (l) =>
          l.status === "New" &&
          !db.assignments.some(
            (t) => t.leadId === l.id && t.status !== "Closed",
          ) &&
          !db.reviews.some((r) => r.leadId === l.id && !r.reviewedAt),
      ).length,
      reviewPending: new Set(
        db.reviews
          .filter((r) => !r.reviewedAt && scoped.some((l) => l.id === r.leadId))
          .map((r) => r.leadId),
      ).size,
      consulting: db.assignments.filter(
        (t) => t.status === "Open" && scoped.some((l) => l.id === t.leadId),
      ).length,
    },
  };
}
