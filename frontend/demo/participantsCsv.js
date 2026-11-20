function escapeCell(value) {
  const text = String(value ?? '');
  // Prevent spreadsheet apps from evaluating names or emails as formulas.
  const safe = /^(?:[\t\r\n]|\s*[=+@-])/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function participantsCsv(participants) {
  return [
    ['Nama', 'Email', 'Waktu daftar (ISO 8601)'],
    ...participants.map(({ name, email, registeredAt }) => [name, email, registeredAt]),
  ].map((cells) => cells.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}
