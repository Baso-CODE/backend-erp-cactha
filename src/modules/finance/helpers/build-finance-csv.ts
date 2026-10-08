function escapeCsv(value: string | number) {
  const text = String(value);
  const safe = /^[\s]*[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildFinanceCsv(
  headers: string[],
  rows: (string | number)[][],
) {
  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\r\n")}\r\n`;
}
