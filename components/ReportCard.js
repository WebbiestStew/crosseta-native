import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { WaitPill } from './UI';
import { BLUE, GREEN, RED, ORANGE, timeAgo } from '../data';

/** Count how many OTHER reports corroborate this one (same crossing, lane, wait ±10 min). */
function getVerifiedCount(allReports, report) {
  return allReports.filter(
    (r) =>
      r.id !== report.id &&
      r.crossingId === report.crossingId &&
      r.lane === report.lane &&
      Math.abs(r.wait - report.wait) <= 10,
  ).length;
}

export default function ReportCard({ report, allReports = [], myVote, feedbackDone, onVote, onFeedback, dark }) {
  const card = dark ? '#2C2C2E' : '#fff';
  const text = dark ? '#fff' : '#000';
  const verifiedCount = getVerifiedCount(allReports, report);
  const isVerified = verifiedCount >= 2;
  return (
    <View style={[styles.card, { backgroundColor: card }]}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: report.avatarColor }]}>
          <Text style={styles.initials}>{report.initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.topRow}>
            <Text style={[styles.name, { color: text }]} numberOfLines={1}>{report.crossingName}</Text>
            <WaitPill wait={report.wait} small />
          </View>
          <Text style={styles.meta}>{report.lane} · {timeAgo(report.time)}</Text>
          {isVerified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓ Verified by {verifiedCount + 1}+ travelers</Text>
            </View>
          )}
          {report.note ? <Text style={[styles.note, { color: dark ? '#ccc' : '#333' }]}>{report.note}</Text> : null}
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => onVote(report.id, 'up')} style={styles.voteBtn}>
              <Text style={[styles.voteTxt, { color: myVote === 'up' ? GREEN : (dark ? '#aaa' : '#666') }]}>
                👍 {report.upvotes + (myVote === 'up' ? 1 : 0)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onVote(report.id, 'down')} style={styles.voteBtn}>
              <Text style={[styles.voteTxt, { color: myVote === 'down' ? RED : (dark ? '#aaa' : '#666') }]}>
                👎 {report.downvotes + (myVote === 'down' ? 1 : 0)}
              </Text>
            </TouchableOpacity>
            {!feedbackDone ? (
              <View style={styles.feedbackRow}>
                <Text style={styles.metaText}>Accurate? </Text>
                <TouchableOpacity onPress={() => onFeedback(report.id, 'yes')}>
                  <Text style={[styles.feedbackBtn, { color: GREEN }]}>Yes</Text>
                </TouchableOpacity>
                <Text style={styles.metaText}> / </Text>
                <TouchableOpacity onPress={() => onFeedback(report.id, 'no')}>
                  <Text style={[styles.feedbackBtn, { color: RED }]}>No</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.metaText}>{feedbackDone === 'yes' ? '✓ Accurate' : '✗ Inaccurate'}</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, marginHorizontal: 16, marginBottom: 10, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  row: { flexDirection: 'row', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontSize: 12, fontWeight: '700' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  meta: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  note: { fontSize: 13, marginTop: 5 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' },
  voteBtn: {},
  voteTxt: { fontSize: 13 },
  feedbackRow: { flexDirection: 'row', alignItems: 'center' },
  feedbackBtn: { fontSize: 12, fontWeight: '600' },
  metaText: { fontSize: 12, color: '#8E8E93' },
  verifiedBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(48,209,88,0.15)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 5,
  },
  verifiedText: { fontSize: 11, color: '#30D158', fontWeight: '700' },
});
