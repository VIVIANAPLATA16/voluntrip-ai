export type NaviTextPart = { text: string; bold: boolean };

/** Split **bold** markers without a Markdown library. Unmatched leftover stays plain. */
export function parseNaviBold(content: string): NaviTextPart[] {
  const parts = content.split("**");
  return parts.map(function (text, index) {
    return { text, bold: index % 2 === 1 };
  });
}
