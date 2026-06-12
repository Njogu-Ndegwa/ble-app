// Workaround for the Odoo chatter author bug: POST /api/tickets/<id>/messages
// always records the author as "OdooBot" — the Bearer token and any
// author_id/partner_id body hints are ignored (probed live 2026-06-12 on the
// desktop portal, see its BACKEND_GAPS.md). Until the backend derives the
// author from the token, we append a marker line to each note and parse it
// back out on display. Known limitation (accepted in the desktop 2026-06-12
// spec): attribution is by convention and could be typed by hand.
//
// Ported from the desktop portal (lib/portal/note-attribution.ts +
// components/ticketing/utils.ts#htmlToText/displayMessage).

const MARKER = '— logged by ';
// Matches a final line "— logged by <name>" (preceded by a newline so prose
// containing the phrase mid-sentence is not treated as a marker).
const MARKER_RE = /\n\s*—\s*logged by\s+(.+?)\s*$/;

/** Append the attribution marker to an outgoing note. No-op without a name. */
export function appendAttribution(message: string, name: string | null | undefined): string {
  const n = name?.trim();
  if (!n) return message;
  return `${message}\n\n${MARKER}${n}`;
}

/**
 * Extract the attribution marker from a note's plain text (run AFTER
 * htmlToText). Returns the author named by the marker (or null) and the text
 * with the marker line removed.
 */
export function parseAttribution(text: string): { author: string | null; text: string } {
  const m = text.match(MARKER_RE);
  if (!m || m.index === undefined) return { author: null, text };
  return { author: m[1], text: text.slice(0, m.index).replace(/\s+$/, '') };
}

/**
 * Convert Odoo rich-text (HTML) to plain text while preserving line breaks —
 * block-closing tags and <br> become newlines. Line breaks matter here: the
 * attribution marker is only recognised at the start of a line, and the
 * ticket description should not collapse into one long paragraph.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  // Turn breaks and block-closers into newlines before stripping.
  const withBreaks = html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, '\n');
  let text: string;
  if (typeof document !== 'undefined') {
    const tmp = document.createElement('div');
    tmp.innerHTML = withBreaks;
    text = tmp.textContent || tmp.innerText || '';
  } else {
    text = withBreaks.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
  }
  // Tidy: drop trailing spaces before newlines, collapse 3+ blank lines.
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Resolve a chatter message for display: convert the HTML body to text and
 * apply the note-attribution workaround. The marker is always stripped from
 * the body; the marker's name replaces the author only when Odoo attributed
 * the note to OdooBot (or no author at all), so a future backend fix wins
 * automatically.
 */
export function displayMessage(m: { author: string; body: string }): {
  author: string;
  body: string;
} {
  const { author: marked, text } = parseAttribution(htmlToText(m.body));
  const isBot = !m.author || /^odoo\s*bot$/i.test(m.author);
  return { author: isBot && marked ? marked : m.author || 'Unknown', body: text };
}
