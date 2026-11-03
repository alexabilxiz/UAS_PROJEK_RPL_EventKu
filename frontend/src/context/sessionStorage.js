export const SESSION_KEY = 'eventku.auth.token';

// Default to this tab's session. Remembering login is an explicit user choice.
export function readSession() {
  try {
    const temporary = sessionStorage.getItem(SESSION_KEY);
    const persistent = localStorage.getItem(SESSION_KEY);
    return temporary ? { token: temporary, remember: false } : persistent ? { token: persistent, remember: true } : null;
  } catch { return null; }
}

export function clearSession({ persistent = true } = {}) {
  for (const key of persistent ? ['sessionStorage', 'localStorage'] : ['sessionStorage']) {
    try { window[key].removeItem(SESSION_KEY); } catch { /* Private mode may deny storage. */ }
  }
}

export function saveSession(token, remember) {
  // Replace a shared token atomically: remove-then-set emits a false logout to
  // other tabs and lets their logout handlers erase the newly written token.
  if (remember) {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* Storage may be denied. */ }
    try { localStorage.setItem(SESSION_KEY, token); } catch { /* In-memory login remains usable. */ }
  } else {
    try { sessionStorage.setItem(SESSION_KEY, token); } catch { /* In-memory login remains usable. */ }
    try { localStorage.removeItem(SESSION_KEY); } catch { /* Storage may be denied. */ }
  }
}
