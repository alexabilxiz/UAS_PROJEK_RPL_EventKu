// Lightweight TextDecoder-based iconv-lite shim for Cloudflare Workers bundling.
// Express 4 (raw-body/body-parser) bundles iconv-lite@0.4.24 whose package.json "browser" field
// stubs ./lib/streams to false while nodejs_compat exposes process.versions.node.
function normalizeEncoding(encoding) {
  const raw = String(encoding || 'utf-8').trim().toLowerCase();
  if (raw === 'utf8' || raw === 'utf-8') return 'utf-8';
  if (raw === 'ascii' || raw === 'latin1' || raw === 'iso-8859-1' || raw === 'binary') return 'windows-1252';
  if (raw === 'utf16le' || raw === 'ucs2' || raw === 'ucs-2') return 'utf-16le';
  return raw;
}

export function encodingExists(encoding) {
  try {
    new TextDecoder(normalizeEncoding(encoding));
    return true;
  } catch {
    return false;
  }
}

export function getDecoder(encoding) {
  const label = normalizeEncoding(encoding);
  let decoder;
  try {
    decoder = new TextDecoder(label);
  } catch {
    throw new Error(`Encoding not recognized: '${encoding}'`);
  }
  return {
    write(buf) {
      return decoder.decode(buf, { stream: true });
    },
    end() {
      return decoder.decode();
    },
  };
}

export function decode(buf, encoding = 'utf-8') {
  const decoder = getDecoder(encoding);
  return decoder.write(buf) + decoder.end();
}

export default { encodingExists, getDecoder, decode };
