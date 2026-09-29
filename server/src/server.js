// Entry point: opens the database, starts polling CBP, evaluates alerts, serves the API.
import { config } from './config.js';
import { openDb } from './db.js';
import { createFeed } from './feed.js';
import { createPusher } from './push.js';
import { createAlerts } from './alerts.js';
import { createApp } from './app.js';

const db = openDb(config.dbPath);
const feed = createFeed({ db, feedUrl: config.feedUrl });
const pusher = createPusher({ pushUrl: config.pushUrl });
const alerts = createAlerts({ db, feed, pusher });
const { server, community } = createApp({ db, feed, minDevices: config.minDevicesForCommunityWait, trustProxy: process.env.TRUST_PROXY === '1' });

const cycle = async () => {
  try {
    const recorded = await feed.poll();
    const sent = await alerts.run();
    console.log(`[${new Date().toISOString()}] poll ok: ${recorded} readings recorded, ${sent} notifications sent`);
  } catch (e) {
    console.error(`[${new Date().toISOString()}] poll failed: ${e.message}`);
  }
};

if (!config.disablePoll) {
  cycle();
  setInterval(cycle, config.pollMs).unref();
  setInterval(() => console.log('purged', community.purge()), 6 * 60 * 60 * 1000).unref();
}

server.listen(config.port, () => console.log(`CrossETA server listening on :${config.port}`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(); db.close(); process.exit(0); });
