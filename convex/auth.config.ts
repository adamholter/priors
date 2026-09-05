export default {
  providers: [
    {
      // Set CLERK_JWT_ISSUER_DOMAIN in the Convex dashboard (Clerk JWT template "convex").
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN ?? "https://placeholder.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
