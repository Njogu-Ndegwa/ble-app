// Display-only grouping of digit codes ("186354729801" → "186 354 729 801").
// Non-digit values (e.g. an APN string in pubk) pass through unchanged.
// Copy actions must always use the raw value, never the chunked one.
export const chunk3 = (code: string) => code.replace(/(\d{3})(?=\d)/g, '$1 ');
