import { Document, Page, Text, View } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import type {
  Pillar,
  Risk,
  Source,
  Valuation,
} from '../agent/schemas.js';
import { htmlToText } from './html-to-text.js';
import {
  colors,
  directionBadgeStyle,
  severityBadgeStyle,
  spacing,
  styles,
} from './styles.js';
import { WeeklyLogTablePdf, type WeeklyLogRow } from './components/WeeklyLogTablePdf.js';

export interface ThesisPdfProps {
  holding: {
    ticker: string;
    companyName: string;
    direction: 'long' | 'short';
    benchmark: string;
    status: 'active' | 'closed' | 'paused';
  };
  thesis: {
    summary: string | null;
    qualityAssess: string | null;
    valuation: Valuation | null;
    assumptions: string[] | null;
    risks: Risk[] | null;
    sources: Source[] | null;
  };
  pillars: Array<Pick<Pillar, 'title' | 'body'>>;
  weeklyLogs: WeeklyLogRow[];
  generatedAt: Date;
}

export function ThesisPdf({
  holding,
  thesis,
  pillars,
  weeklyLogs,
  generatedAt,
}: ThesisPdfProps): ReactElement {
  const generatedLabel = generatedAt.toISOString().slice(0, 10);
  return (
    <Document
      title={`${holding.ticker} — Investment Thesis`}
      author="Thesis Tracker"
      subject={`Thesis for ${holding.companyName}`}
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerBlock} fixed={false}>
          <View style={styles.tickerRow}>
            <Text style={styles.ticker}>{holding.ticker}</Text>
            <Text style={directionBadgeStyle(holding.direction)}>
              {holding.direction === 'long' ? 'Long' : 'Short'}
            </Text>
          </View>
          <Text style={styles.companyName}>{holding.companyName}</Text>
          <View style={styles.metaRow}>
            <MetaItem label="Benchmark" value={holding.benchmark} />
            <MetaItem label="Status" value={capitalise(holding.status)} />
            <MetaItem label="Generated" value={generatedLabel} />
          </View>
        </View>

        {thesis.summary ? (
          <Section title="Summary">
            <Paragraphs text={htmlToText(thesis.summary)} />
          </Section>
        ) : null}

        {pillars.length > 0 ? (
          <Section title="Thesis Pillars">
            {pillars.map((pillar, index) => (
              <View key={index} style={styles.pillar} wrap={false}>
                <Text style={styles.pillarTitle}>{pillar.title}</Text>
                <Paragraphs text={htmlToText(pillar.body ?? '')} />
              </View>
            ))}
          </Section>
        ) : null}

        {thesis.qualityAssess ? (
          <Section title="Quality Assessment">
            <Paragraphs text={htmlToText(thesis.qualityAssess)} />
          </Section>
        ) : null}

        {thesis.valuation ? (
          <Section title="Valuation">
            <ValuationBlock valuation={thesis.valuation} />
          </Section>
        ) : null}

        {thesis.assumptions && thesis.assumptions.length > 0 ? (
          <Section title="Assumptions">
            {thesis.assumptions.map((item, index) => (
              <View key={index} style={styles.bullet} wrap={false}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </Section>
        ) : null}

        {thesis.risks && thesis.risks.length > 0 ? (
          <Section title="Risks">
            {thesis.risks.map((risk, index) => (
              <View key={index} style={styles.riskRow} wrap={false}>
                <Text style={[...severityBadgeStyle(risk.severity), styles.riskSeverity]}>
                  {risk.severity.toUpperCase()}
                </Text>
                <Text style={{ flex: 1 }}>{risk.description}</Text>
              </View>
            ))}
          </Section>
        ) : null}

        {thesis.sources && thesis.sources.length > 0 ? (
          <Section title="Sources">
            {thesis.sources.map((source, index) => (
              <View key={index} style={styles.sourceRow} wrap={false}>
                <Text style={styles.sourceType}>{sourceTypeLabel(source.type)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sourceTitle}>{source.title}</Text>
                  {source.url ? <Text style={styles.sourceUrl}>{source.url}</Text> : null}
                </View>
              </View>
            ))}
          </Section>
        ) : null}

        <Section title="Weekly Log">
          <WeeklyLogTablePdf logs={weeklyLogs} />
        </Section>

        <View style={styles.footer} fixed>
          <Text>
            {holding.ticker} — {holding.companyName}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

function Section({ title, children }: { title: string; children: ReactElement | ReactElement[] }) {
  return (
    <View>
      <Text style={styles.sectionHeading}>{title}</Text>
      {children}
    </View>
  );
}

function Paragraphs({ text }: { text: string }) {
  if (!text) return <Text style={{ color: colors.brand500 }}>—</Text>;
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  return (
    <>
      {paragraphs.map((p, i) => (
        <Text
          key={i}
          style={{
            marginBottom: i === paragraphs.length - 1 ? 0 : spacing.xs,
          }}
        >
          {p}
        </Text>
      ))}
    </>
  );
}

function ValuationBlock({ valuation }: { valuation: Valuation }) {
  const rows: Array<[string, string | null]> = [
    ['Methodology', valuation.methodology],
    ['Current price', valuation.currentPrice != null ? formatPrice(valuation.currentPrice) : null],
    ['Upside case', valuation.upsideCase],
    ['Base case', valuation.baseCase],
    ['Downside case', valuation.downsideCase],
  ];
  return (
    <>
      {rows.map(([key, value]) =>
        value ? (
          <View key={key} style={styles.kvRow} wrap={false}>
            <Text style={styles.kvKey}>{key}</Text>
            <Text style={styles.kvValue}>{value}</Text>
          </View>
        ) : null,
      )}
    </>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}:</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function sourceTypeLabel(type: Source['type']): string {
  if (!type) return '';
  if (type === 'broker_research') return 'Broker research';
  if (type === 'web') return 'Web';
  if (type === 'filing') return 'Filing';
  if (type === 'news') return 'News';
  return '';
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPrice(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
