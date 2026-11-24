function escapeCell(value) {
  const textValue = String(value ?? '');
  // Cegah aplikasi spreadsheet menjalankan nama/email yang diawali rumus.
  const safe = /^(?:[\t\r\n]|\s*[=+@-])/.test(textValue) ? `'${textValue}` : textValue;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function participantsCsv(participants) {
  return [
    ['Nama', 'Email', 'Waktu daftar (ISO 8601)'],
    ...participants.map(({ name, email, registeredAt }) => [name, email, registeredAt]),
  ].map((cells) => cells.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}
