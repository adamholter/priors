import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
// Files uploaded on /request whose report was never sent.
crons.interval("sweep unsent request files", { hours: 6 }, internal.requests.sweepFiles, {});
export default crons;
