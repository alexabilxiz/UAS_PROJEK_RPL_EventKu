export const MAX_LIMIT = 20;

/** page >= 1, 1 <= limit <= 20. Nilai buruk jatuh ke default, bukan error. */
export function pageParams(query, defaultLimit = MAX_LIMIT) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}
