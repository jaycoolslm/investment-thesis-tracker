import { describe, it, expect } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { ThesisPdf } from '../ThesisPdf.js';
import { htmlToText } from '../html-to-text.js';

const baseProps = {
  holding: {
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    direction: 'long' as const,
    benchmark: 'S&P 500',
    status: 'active' as const,
  },
  thesis: {
    summary: '<p>This is the thesis summary.</p><p>A second paragraph.</p>',
    qualityAssess: '<p>High quality.</p>',
    valuation: {
      methodology: 'DCF',
      currentPrice: 175.5,
      upsideCase: '$220',
      baseCase: '$190',
      downsideCase: '$140',
    },
    assumptions: ['Growth continues', 'Margins expand'],
    risks: [
      { description: 'Regulatory risk', severity: 'high' as const },
      { description: 'FX exposure', severity: 'low' as const },
    ],
    sources: [
      { title: 'Q3 earnings', url: 'https://example.com', type: 'filing' as const },
    ],
  },
  pillars: [
    { title: 'Moat', body: '<p>Durable.</p>' },
    { title: 'Growth', body: '<p>Compounds.</p>' },
  ],
  generatedAt: new Date('2026-04-23'),
};

describe('ThesisPdf', () => {
  it('renders a valid PDF with full thesis + weekly logs', async () => {
    const buffer = await renderToBuffer(
      <ThesisPdf
        {...baseProps}
        weeklyLogs={[
          {
            weekLabel: '2026-W15',
            weekDate: '2026-04-11',
            priceChangePct: '2.3456',
            indexChangePct: '0.5000',
            relativePerf: '1.8456',
            thesisImpact: 'strengthened',
            summary: 'Earnings beat',
            pillarRefs: [
              { pillarId: 'p1', pillarTitle: 'Moat', impact: 'strengthened' },
            ],
          },
          {
            weekLabel: '2026-W14',
            weekDate: '2026-04-04',
            priceChangePct: '-1.2000',
            indexChangePct: '0.1000',
            relativePerf: '-1.3000',
            thesisImpact: 'unchanged',
            summary: 'Quiet week',
            pillarRefs: null,
          },
        ]}
      />,
    );

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1024);
  });

  it('renders with no weekly logs (empty state)', async () => {
    const buffer = await renderToBuffer(<ThesisPdf {...baseProps} weeklyLogs={[]} />);
    expect(buffer.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1024);
  });

  it('renders with a thesis missing optional sections', async () => {
    const buffer = await renderToBuffer(
      <ThesisPdf
        holding={baseProps.holding}
        thesis={{
          summary: null,
          qualityAssess: null,
          valuation: null,
          assumptions: null,
          risks: null,
          sources: null,
        }}
        pillars={[]}
        weeklyLogs={[]}
        generatedAt={baseProps.generatedAt}
      />,
    );
    expect(buffer.subarray(0, 5).toString('utf8')).toBe('%PDF-');
  });
});

describe('htmlToText', () => {
  it('strips tags and preserves paragraph breaks', () => {
    expect(htmlToText('<p>One</p><p>Two</p>')).toBe('One\n\nTwo');
  });

  it('converts list items to bullets', () => {
    const result = htmlToText('<ul><li>A</li><li>B</li></ul>');
    expect(result).toContain('• A');
    expect(result).toContain('• B');
  });

  it('decodes common entities', () => {
    expect(htmlToText('Tom &amp; Jerry &lt;3')).toBe('Tom & Jerry <3');
  });

  it('handles null and empty input', () => {
    expect(htmlToText(null)).toBe('');
    expect(htmlToText('')).toBe('');
  });
});
