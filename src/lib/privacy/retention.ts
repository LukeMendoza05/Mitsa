import { z } from "zod";
import proposals from "../../../config/retention-proposals.json";

const periodSchema = z.union([z.object({ days: z.number().int().positive() }).strict(), z.object({ years: z.number().int().positive() }).strict(), z.object({ manual: z.literal(true) }).strict()]);
const ruleSchema = z.object({ id: z.string(), period: periodSchema, trigger: z.string(), purpose: z.string(), disposal: z.string() });
export type RetentionRule = z.infer<typeof ruleSchema>;
export const retentionProposals = z.object({ version: z.string(), status: z.literal("proposed"), legalApprovalRequired: z.literal(true), categories: z.array(ruleSchema) }).parse(proposals);
type Hold = { category: string; subjectId: string; releasedAt: string | null };
type RecordClock = { subjectId: string; triggeredAt: string | null; relatedDueAt?: string; relatedClockPending?: boolean };
type Preview = { eligible: boolean; reason: "not-approved" | "disposal-disabled" | "held" | "missing-trigger" | "review-required" | "not-due" | "due"; dueAt?: string };

function validDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const date = new Date(input);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** Preview only. No database, provider, object-storage or deletion side effects.
 * Approval/clock inputs must come from reviewed server records, never a client.
 * Holds stay active until released; a review date does not release a hold.
 */
export function retentionPreview(rule: RetentionRule, record: RecordClock, controls: { legallyApproved: boolean; disposalEnabled: boolean; holds: readonly Hold[] }, now: Date): Preview {
  if (!controls.legallyApproved) return { eligible: false, reason: "not-approved" };
  if (!controls.disposalEnabled) return { eligible: false, reason: "disposal-disabled" };
  if (controls.holds.some(hold => hold.category === rule.id && hold.subjectId === record.subjectId && hold.releasedAt === null)) return { eligible: false, reason: "held" };
  if ("manual" in rule.period || record.relatedClockPending || !Number.isFinite(now.getTime())) return { eligible: false, reason: "review-required" };
  const due = validDate(record.triggeredAt);
  if (!due) return { eligible: false, reason: "missing-trigger" };
  if ("days" in rule.period) due.setTime(due.getTime() + rule.period.days * 86400000);
  else {
    const year = due.getUTCFullYear() + rule.period.years;
    const month = due.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    due.setUTCFullYear(year, month, Math.min(due.getUTCDate(), lastDay));
  }
  if (record.relatedDueAt) {
    const related = validDate(record.relatedDueAt);
    if (!related) return { eligible: false, reason: "review-required" };
    if (related > due) due.setTime(related.getTime());
  }
  return { eligible: due <= now, reason: due <= now ? "due" : "not-due", dueAt: due.toISOString() };
}
