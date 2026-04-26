import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Font, StyleSheet } from '@react-pdf/renderer';

const fontsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts');

Font.register({
  family: 'Inter',
  fonts: [
    { src: path.join(fontsDir, 'Inter-Regular.woff'), fontWeight: 400 },
    { src: path.join(fontsDir, 'Inter-Medium.woff'), fontWeight: 500 },
    { src: path.join(fontsDir, 'Inter-Bold.woff'), fontWeight: 700 },
  ],
});

export const colors = {
  brand900: '#0F172A',
  brand800: '#1E293B',
  brand700: '#334155',
  brand500: '#64748B',
  brand200: '#E2E8F0',
  brand100: '#F1F5F9',
  brand50: '#F8FAFC',
  accent700: '#1D4ED8',
  accent600: '#2563EB',
  accent50: '#EFF6FF',
  statusGreenText: '#15803D',
  statusGreenBg: '#DCFCE7',
  statusRedText: '#B91C1C',
  statusRedBg: '#FEE2E2',
  statusGreyText: '#4B5563',
  statusGreyBg: '#F3F4F6',
  severityHighText: '#991B1B',
  severityHighBg: '#FEE2E2',
  severityMediumText: '#92400E',
  severityMediumBg: '#FEF3C7',
  severityLowText: '#166534',
  severityLowBg: '#DCFCE7',
  white: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const sizes = {
  h1: 20,
  h2: 14,
  h3: 11,
  body: 10,
  caption: 8,
};

export const styles = StyleSheet.create({
  page: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
    fontFamily: 'Inter',
    fontSize: sizes.body,
    color: colors.brand700,
    lineHeight: 1.45,
  },
  headerBlock: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand200,
  },
  tickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ticker: {
    fontSize: sizes.h1,
    fontWeight: 700,
    color: colors.brand900,
  },
  companyName: {
    fontSize: sizes.h3,
    color: colors.brand500,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
    fontSize: sizes.caption,
    color: colors.brand500,
  },
  metaItem: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  metaLabel: {
    color: colors.brand500,
  },
  metaValue: {
    color: colors.brand700,
    fontWeight: 500,
  },
  sectionHeading: {
    fontSize: sizes.h2,
    fontWeight: 700,
    color: colors.brand900,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionBody: {
    fontSize: sizes.body,
    color: colors.brand700,
  },
  pillar: {
    marginBottom: spacing.md,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent600,
  },
  pillarTitle: {
    fontSize: sizes.h3,
    fontWeight: 700,
    color: colors.brand900,
    marginBottom: spacing.xs,
  },
  pillarBody: {
    fontSize: sizes.body,
    color: colors.brand700,
  },
  kvRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  kvKey: {
    width: 100,
    color: colors.brand500,
    fontSize: sizes.body,
  },
  kvValue: {
    flex: 1,
    color: colors.brand700,
    fontSize: sizes.body,
  },
  bullet: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  bulletDot: {
    width: 10,
    color: colors.accent600,
  },
  bulletText: {
    flex: 1,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    fontSize: sizes.caption,
    fontWeight: 500,
  },
  directionLong: {
    backgroundColor: colors.statusGreenBg,
    color: colors.statusGreenText,
  },
  directionShort: {
    backgroundColor: colors.statusRedBg,
    color: colors.statusRedText,
  },
  impactStrengthened: {
    backgroundColor: colors.statusGreenBg,
    color: colors.statusGreenText,
  },
  impactWeakened: {
    backgroundColor: colors.statusRedBg,
    color: colors.statusRedText,
  },
  impactUnchanged: {
    backgroundColor: colors.statusGreyBg,
    color: colors.statusGreyText,
  },
  severityHigh: {
    backgroundColor: colors.severityHighBg,
    color: colors.severityHighText,
  },
  severityMedium: {
    backgroundColor: colors.severityMediumBg,
    color: colors.severityMediumText,
  },
  severityLow: {
    backgroundColor: colors.severityLowBg,
    color: colors.severityLowText,
  },
  riskRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
    alignItems: 'flex-start',
  },
  riskSeverity: {
    width: 52,
  },
  sourceRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: 2,
  },
  sourceType: {
    color: colors.brand500,
    fontSize: sizes.caption,
    width: 80,
  },
  sourceTitle: {
    flex: 1,
    fontSize: sizes.body,
  },
  sourceUrl: {
    color: colors.accent600,
    fontSize: sizes.caption,
  },
  footer: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.xl,
    right: spacing.xl,
    fontSize: sizes.caption,
    color: colors.brand500,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.brand200,
    paddingTop: spacing.xs,
  },
});

export function directionBadgeStyle(direction: 'long' | 'short') {
  return [styles.badge, direction === 'long' ? styles.directionLong : styles.directionShort];
}

export function impactBadgeStyle(impact: 'strengthened' | 'weakened' | 'unchanged' | null | undefined) {
  if (impact === 'strengthened') return [styles.badge, styles.impactStrengthened];
  if (impact === 'weakened') return [styles.badge, styles.impactWeakened];
  return [styles.badge, styles.impactUnchanged];
}

export function severityBadgeStyle(severity: 'high' | 'medium' | 'low') {
  if (severity === 'high') return [styles.badge, styles.severityHigh];
  if (severity === 'medium') return [styles.badge, styles.severityMedium];
  return [styles.badge, styles.severityLow];
}
