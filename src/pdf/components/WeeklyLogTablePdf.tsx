import { Text, View } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import { colors, impactBadgeStyle, sizes, spacing, styles } from '../styles.js';

export interface WeeklyLogRow {
  weekLabel: string | null;
  weekDate: string | Date | null;
  priceChangePct: string | number | null;
  indexChangePct: string | number | null;
  relativePerf: string | number | null;
  thesisImpact: 'strengthened' | 'weakened' | 'unchanged' | null;
  summary: string | null;
  pillarRefs:
    | Array<{ pillarId: string; pillarTitle: string; impact: 'strengthened' | 'weakened' | 'unchanged' }>
    | null;
}

const columnWidths = {
  week: '14%',
  price: '10%',
  index: '10%',
  relative: '12%',
  impact: '16%',
  summary: '38%',
};

const rowStyle = {
  flexDirection: 'row' as const,
  borderBottomWidth: 0.5,
  borderBottomColor: colors.brand200,
  paddingVertical: spacing.xs,
};

const cellText = {
  fontSize: sizes.caption,
  paddingHorizontal: 4,
};

export function WeeklyLogTablePdf({ logs }: { logs: WeeklyLogRow[] }): ReactElement {
  if (logs.length === 0) {
    return (
      <View
        style={{
          padding: spacing.md,
          alignItems: 'center',
          backgroundColor: colors.brand50,
          borderRadius: 4,
        }}
      >
        <Text style={{ color: colors.brand500 }}>No weekly updates yet.</Text>
      </View>
    );
  }

  return (
    <View>
      <View
        fixed
        style={{
          ...rowStyle,
          borderBottomWidth: 1,
          borderBottomColor: colors.brand500,
          backgroundColor: colors.brand50,
        }}
      >
        <Text style={{ ...cellText, width: columnWidths.week, fontWeight: 700 }}>Week</Text>
        <Text style={{ ...cellText, width: columnWidths.price, fontWeight: 700 }}>Price %</Text>
        <Text style={{ ...cellText, width: columnWidths.index, fontWeight: 700 }}>Index %</Text>
        <Text style={{ ...cellText, width: columnWidths.relative, fontWeight: 700 }}>Relative %</Text>
        <Text style={{ ...cellText, width: columnWidths.impact, fontWeight: 700 }}>Impact</Text>
        <Text style={{ ...cellText, width: columnWidths.summary, fontWeight: 700 }}>Summary</Text>
      </View>

      {logs.map((log, index) => (
        <View key={index} style={rowStyle} wrap={false}>
          <Text style={{ ...cellText, width: columnWidths.week }}>
            {log.weekLabel ?? formatDate(log.weekDate)}
          </Text>
          <Text style={{ ...cellText, width: columnWidths.price, ...colorForPct(log.priceChangePct) }}>
            {formatPct(log.priceChangePct)}
          </Text>
          <Text style={{ ...cellText, width: columnWidths.index }}>
            {formatPct(log.indexChangePct)}
          </Text>
          <Text style={{ ...cellText, width: columnWidths.relative, ...colorForPct(log.relativePerf) }}>
            {formatPct(log.relativePerf)}
          </Text>
          <View style={{ width: columnWidths.impact, paddingHorizontal: 4 }}>
            {log.thesisImpact ? (
              <Text style={[...impactBadgeStyle(log.thesisImpact), { alignSelf: 'flex-start' }]}>
                {capitalise(log.thesisImpact)}
              </Text>
            ) : (
              <Text style={cellText}>—</Text>
            )}
          </View>
          <View style={{ width: columnWidths.summary, paddingHorizontal: 4 }}>
            <Text style={{ fontSize: sizes.caption }}>{log.summary ?? ''}</Text>
            {log.pillarRefs && log.pillarRefs.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
                {log.pillarRefs.map((ref) => (
                  <Text
                    key={ref.pillarId}
                    style={[
                      ...impactBadgeStyle(ref.impact),
                      { fontSize: 7, paddingVertical: 1, paddingHorizontal: 3 },
                    ]}
                  >
                    {ref.pillarTitle}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function formatPct(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return '—';
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

function colorForPct(value: string | number | null | undefined) {
  if (value === null || value === undefined) return { color: colors.brand700 };
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num) || num === 0) return { color: colors.brand700 };
  return { color: num > 0 ? colors.statusGreenText : colors.statusRedText };
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
