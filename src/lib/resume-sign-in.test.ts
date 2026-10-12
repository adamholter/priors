import { describe, expect, it } from "vitest";
import { RESUME_TRIED, resumeHint, resumeTarget, resumeWhileSignedIn, signedOutMark } from "./resume-sign-in";

describe("resuming an expired sign-in", () => {
  it("remembers a verified Google account", () => {
    expect(resumeHint([{ provider: "google", providerUserId: "1234", verification: { status: "verified" } }])).toBe("google:1234");
  });
  it("remembers nothing without one", () => {
    expect(resumeHint([])).toBeNull();
    expect(resumeHint([{ provider: "google", providerUserId: "1234", verification: { status: "unverified" } }])).toBeNull();
    expect(resumeHint([{ provider: "github", providerUserId: "9", verification: { status: "verified" } }])).toBeNull();
  });
  it("only resumes from a stored Google id", () => {
    expect(resumeTarget(resumeHint([{ provider: "google", providerUserId: "1234", verification: { status: "verified" } }]))).toBe("1234");
    expect(resumeTarget(null)).toBeNull();
    expect(resumeTarget(RESUME_TRIED)).toBeNull();
    expect(resumeTarget("google:")).toBeNull();
  });
  it("keeps a sign-out from being undone by the session it ended", () => {
    const google = [{ provider: "google", providerUserId: "1234", verification: { status: "verified" } }];
    const off = signedOutMark("sess_1");
    expect(resumeTarget(off)).toBeNull();
    expect(resumeWhileSignedIn(off, "sess_1", google)).toBe(off);
    expect(resumeWhileSignedIn(off, "sess_2", google)).toBe("google:1234");
    expect(resumeWhileSignedIn(RESUME_TRIED, "sess_2", google)).toBe("google:1234");
  });
});
