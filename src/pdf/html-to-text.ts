const BLOCK_TAG = /<\/?(p|div|h[1-6]|li|br|tr)[^>]*>/gi;
const LIST_ITEM_OPEN = /<li[^>]*>/gi;
const TAG = /<[^>]+>/g;
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  let out = html
    .replace(LIST_ITEM_OPEN, '\n• ')
    .replace(BLOCK_TAG, '\n')
    .replace(TAG, '');
  for (const [entity, char] of Object.entries(ENTITIES)) {
    out = out.replaceAll(entity, char);
  }
  return out
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
