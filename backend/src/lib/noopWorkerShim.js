// Shim ringan khusus runtime Cloudflare Workers:
// Di produksi, Swagger UI disajikan langsung sebagai Workers Static Assets (/api-docs/)
// sehingga paket swagger-ui-express dan yaml tidak perlu ikut dibundle ke Worker JS.
export function parse() {
  return null;
}

export default {
  serve: [],
  setup: () => (_req, _res, next) => next(),
};
