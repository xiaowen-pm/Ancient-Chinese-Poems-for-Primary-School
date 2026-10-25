export function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    return "&quot;";
  });
}

/** Escape text, then turn `**强调**` into `<b>`. Content is never raw HTML. */
export function rich(value: string): string {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}
