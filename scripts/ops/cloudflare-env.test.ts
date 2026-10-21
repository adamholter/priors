import { expect, it } from "vitest";
import { cloudflareEnv } from "./cloudflare-env.mjs";

it("trims production app settings and excludes provider credentials", () => {
  expect(cloudflareEnv('CLERK_SECRET_KEY=" key \\n"\nNEXT_PUBLIC_SITE_URL=" https://mypriors.com "\nVERCEL_OIDC_TOKEN=provider-secret\nVERCEL=1\nOPENROUTER_API_KEY=" api "'))
    .toEqual({ CLERK_SECRET_KEY: "key", NEXT_PUBLIC_SITE_URL: "https://mypriors.com", OPENROUTER_API_KEY: "api" });
});
