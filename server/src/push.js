// Sends notifications through the Expo push service.
// https://docs.expo.dev/push-notifications/sending-notifications/
export const createPusher = ({ pushUrl, fetchImpl = fetch, log = console }) => {
  /**
   * @param {{to:string,title:string,body:string,data?:object}[]} messages
   * @returns {Promise<string[]>} push tokens Expo says are no longer valid
   */
  const send = async (messages) => {
    const dead = [];
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100).map((m) => ({ sound: 'default', ...m }));
      try {
        const res = await fetchImpl(pushUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(chunk),
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) { log.warn?.(`push HTTP ${res.status}`); continue; }
        const { data } = await res.json();
        (data ?? []).forEach((ticket, idx) => {
          if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') dead.push(chunk[idx].to);
        });
      } catch (e) {
        log.warn?.(`push failed: ${e.message}`);
      }
    }
    return dead;
  };
  return { send };
};
