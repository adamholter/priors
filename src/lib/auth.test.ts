import { describe, expect, it } from "vitest";
import { clerkNeeded } from "./auth";

const base = { cookie: "", resume: null, url: "https://mypriors.com/models/x", pathname: "/models/x" };
describe("clerkNeeded", () => {
  it("leaves an anonymous visitor without Clerk", () => {
    expect(clerkNeeded(base)).toBe(false);
    expect(clerkNeeded({ ...base, cookie: "priors_theme=dark; __client_uat=0; __client_uat_abc=0" })).toBe(false);
    expect(clerkNeeded({ ...base, cookie: "my__session=1; x__client_uat=123" })).toBe(false);
  });
  it("loads for a session", () => {
    expect(clerkNeeded({ ...base, cookie: "a=b; __client_uat=1793667034" })).toBe(true);
    expect(clerkNeeded({ ...base, cookie: "__client_uat_xY1=1793667034; a=b" })).toBe(true);
    expect(clerkNeeded({ ...base, cookie: "__session=eyJ" })).toBe(true);
    expect(clerkNeeded({ ...base, cookie: "__session_xY1=eyJ" })).toBe(true);
  });
  it("loads for a Google sign-in to resume or finish, not after a deliberate sign-out", () => {
    expect(clerkNeeded({ ...base, resume: "google:123" })).toBe(true);
    expect(clerkNeeded({ ...base, resume: "tried" })).toBe(true);
    expect(clerkNeeded({ ...base, resume: "off:sess_1" })).toBe(false);
  });
  it("loads for Clerk's return trips and pages", () => {
    expect(clerkNeeded({ ...base, url: "https://mypriors.com/?__clerk_ticket=x" })).toBe(true);
    expect(clerkNeeded({ ...base, url: "https://mypriors.com/?a=1&__clerk_status=verified" })).toBe(true);
    expect(clerkNeeded({ ...base, pathname: "/sign-in" })).toBe(true);
    expect(clerkNeeded({ ...base, pathname: "/sign-in/sso-callback" })).toBe(true);
    expect(clerkNeeded({ ...base, pathname: "/sign-inside" })).toBe(false);
  });
});
