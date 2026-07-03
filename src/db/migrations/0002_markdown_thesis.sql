-- Collapse the structured thesis (summary/pillars/quality/valuation/assumptions/risks)
-- into a single markdown `content` column, backfilling existing rows before dropping
-- the old columns and the thesis_pillars table.

-- 1. Add the new markdown column (nullable so the backfill can populate it).
ALTER TABLE "theses" ADD COLUMN "content" text;--> statement-breakpoint

-- 2. Crude HTML→text helper: turn paragraph/line breaks into newlines, strip all
--    remaining tags, then trim. Good enough to rescue Tiptap-authored fields.
CREATE OR REPLACE FUNCTION "__strip_html"(t text) RETURNS text AS $$
  SELECT trim(both E' \n' FROM regexp_replace(
    regexp_replace(coalesce(t, ''), '</p>|<br\s*/?>', E'\n', 'gi'),
    '<[^>]+>', '', 'g'
  ));
$$ LANGUAGE sql IMMUTABLE;--> statement-breakpoint

-- 3. Compose markdown `content` for every existing thesis. Empty/null sections are
--    skipped (concat_ws drops NULL arguments).
UPDATE "theses" t SET "content" = trim(both E'\n' FROM concat_ws(E'\n\n',
  -- ## Summary
  CASE WHEN "__strip_html"(t.summary) <> ''
    THEN '## Summary' || E'\n\n' || "__strip_html"(t.summary) END,
  -- ## Thesis Pillars  (### {title} + body, in sort_order)
  (SELECT '## Thesis Pillars' || E'\n\n' || string_agg(
      '### ' || p.title ||
      CASE WHEN "__strip_html"(p.body) <> '' THEN E'\n\n' || "__strip_html"(p.body) ELSE '' END,
      E'\n\n' ORDER BY p.sort_order)
   FROM "thesis_pillars" p WHERE p.thesis_id = t.id),
  -- ## Quality Assessment
  CASE WHEN "__strip_html"(t.quality_assess) <> ''
    THEN '## Quality Assessment' || E'\n\n' || "__strip_html"(t.quality_assess) END,
  -- ## Valuation  (methodology paragraph + case bullets)
  CASE WHEN t.valuation IS NOT NULL AND jsonb_typeof(t.valuation) = 'object'
    THEN '## Valuation' || E'\n\n' || concat_ws(E'\n\n',
      NULLIF(coalesce(t.valuation->>'methodology', ''), ''),
      concat_ws(E'\n',
        CASE WHEN t.valuation->>'currentPrice' IS NOT NULL
          THEN '- **Current price:** ' || (t.valuation->>'currentPrice') END,
        CASE WHEN t.valuation->>'upsideCase' IS NOT NULL
          THEN '- **Upside case:** ' || (t.valuation->>'upsideCase') END,
        CASE WHEN t.valuation->>'baseCase' IS NOT NULL
          THEN '- **Base case:** ' || (t.valuation->>'baseCase') END,
        CASE WHEN t.valuation->>'downsideCase' IS NOT NULL
          THEN '- **Downside case:** ' || (t.valuation->>'downsideCase') END
      )) END,
  -- ## Key Assumptions  (bullets)
  CASE WHEN t.assumptions IS NOT NULL AND jsonb_typeof(t.assumptions) = 'array'
        AND jsonb_array_length(t.assumptions) > 0
    THEN '## Key Assumptions' || E'\n\n' || (
      SELECT string_agg('- ' || a.value, E'\n')
      FROM jsonb_array_elements_text(t.assumptions) AS a(value)) END,
  -- ## Risks  (bullets with **High/Medium/Low** prefixes)
  CASE WHEN t.risks IS NOT NULL AND jsonb_typeof(t.risks) = 'array'
        AND jsonb_array_length(t.risks) > 0
    THEN '## Risks' || E'\n\n' || (
      SELECT string_agg(
        '- **' || initcap(coalesce(r.elem->>'severity', 'Unknown')) || ':** ' ||
        coalesce(r.elem->>'description', ''), E'\n')
      FROM jsonb_array_elements(t.risks) AS r(elem)) END
));--> statement-breakpoint

DROP FUNCTION "__strip_html"(text);--> statement-breakpoint

-- 4. Drop the old structured columns, the pillars table, and weekly_logs.pillar_refs.
DROP TABLE "thesis_pillars" CASCADE;--> statement-breakpoint
ALTER TABLE "theses" DROP COLUMN "summary";--> statement-breakpoint
ALTER TABLE "theses" DROP COLUMN "quality_assess";--> statement-breakpoint
ALTER TABLE "theses" DROP COLUMN "valuation";--> statement-breakpoint
ALTER TABLE "theses" DROP COLUMN "assumptions";--> statement-breakpoint
ALTER TABLE "theses" DROP COLUMN "risks";--> statement-breakpoint
ALTER TABLE "weekly_logs" DROP COLUMN "pillar_refs";
