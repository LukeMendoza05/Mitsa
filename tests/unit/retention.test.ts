import { describe, expect, it } from "vitest";
import { retentionPreview, retentionProposals } from "../../src/lib/privacy/retention";

describe("proposed retention and disposal preview", () => {
  const now = new Date("2030-03-01T00:00:00Z");
  const controls = { legallyApproved: true, disposalEnabled: true, holds: [] };
  const clock = { subjectId: "synthetic", triggeredAt: "2020-02-29T00:00:00Z" };
  const rule = retentionProposals.categories.find(item => item.id === "privacy-request-case")!;
  it("keeps every real proposal unapproved and fails closed before evaluating deletion", () => {
    expect(retentionProposals.status).toBe("proposed");
    expect(retentionProposals.legalApprovalRequired).toBe(true);
    expect(retentionPreview(rule, clock, { ...controls, legallyApproved: false }, now).reason).toBe("not-approved");
    expect(retentionPreview(rule, clock, { ...controls, disposalEnabled: false }, now).reason).toBe("disposal-disabled");
  });
  it("handles calendar-year boundaries and never releases a hold automatically", () => {
    expect(retentionPreview(rule, clock, controls, now)).toMatchObject({ eligible: true, dueAt: "2023-02-28T00:00:00.000Z" });
    expect(retentionPreview(rule, clock, { ...controls, holds: [{ category: rule.id, subjectId: clock.subjectId, releasedAt: null }] }, now).reason).toBe("held");
    expect(retentionPreview(rule, clock, { ...controls, holds: [{ category: rule.id, subjectId: clock.subjectId, releasedAt: "2029-01-01" }] }, now).eligible).toBe(true);
  });
  it("requires reviewed statutory clocks, valid triggers and longer linked-record schedules", () => {
    const statutory = retentionProposals.categories.find(item => item.id === "operational-accounting")!;
    expect(retentionPreview(statutory, clock, controls, now).reason).toBe("review-required");
    expect(retentionPreview(rule, { ...clock, triggeredAt: null }, controls, now).reason).toBe("missing-trigger");
    expect(retentionPreview(rule, { ...clock, relatedClockPending: true }, controls, now).reason).toBe("review-required");
    expect(retentionPreview(rule, { ...clock, relatedDueAt: "2031-01-01T00:00:00Z" }, controls, now)).toMatchObject({ eligible: false, reason: "not-due", dueAt: "2031-01-01T00:00:00.000Z" });
  });
});
