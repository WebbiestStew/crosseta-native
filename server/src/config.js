// All configuration comes from the environment so tests and deployments can override it.
const env = process.env;

export const config = {
  port: Number(env.PORT ?? 8787),
  dbPath: env.DB_PATH ?? './data/crosseta.db',
  feedUrl: env.FEED_URL ?? 'https://bwt.cbp.gov/api/bwtnew',
  pushUrl: env.PUSH_URL ?? 'https://exp.host/--/api/v2/push/send',
  pollMs: Number(env.POLL_MS ?? 5 * 60 * 1000),
  disablePoll: env.DISABLE_POLL === '1',
  // Trip and report retention.
  tripRetentionDays: Number(env.TRIP_RETENTION_DAYS ?? 30),
  reportRetentionDays: Number(env.REPORT_RETENTION_DAYS ?? 14),
  // Community waits need this many distinct devices before a number is published.
  minDevicesForCommunityWait: Number(env.MIN_DEVICES ?? 2),
};
