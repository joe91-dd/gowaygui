'use strict';
// Issues short-lived read URLs for the exact public game-asset manifest only.
// Identity comes from getWXContext(), never from request parameters.
const TTL_SECONDS = 300;
function createAssetHandler({manifest, sign, now = Date.now}) {
  if (!manifest || !manifest.appid || !manifest.version || !Array.isArray(manifest.files)) throw Error('Invalid asset manifest');
  const files = new Map(manifest.files.map(f => [f.path, f.fileID]));
  const allowedHosts = new Set(manifest.downloadHosts);
  return async function handle(event, context) {
    if (!context || context.APPID !== manifest.appid || typeof context.OPENID !== 'string' || !context.OPENID || context.SOURCE === 'wx_trigger') return {ok:false,code:'AUTH_REQUIRED'};
    if (!event || event.version !== manifest.version) return {ok:false,code:'ASSET_VERSION_MISMATCH'};
    if (!Array.isArray(event.paths) || event.paths.length < 1 || event.paths.length > 50 || event.paths.some(p => typeof p !== 'string' || !files.has(p))) return {ok:false,code:'INVALID_ASSET_LIST'};
    const paths = [...new Set(event.paths)];
    const started = now();
    try {
      const result = await sign({fileList:paths.map(p => ({fileID:files.get(p),maxAge:TTL_SECONDS}))});
      const signed = new Map((result.fileList || []).map(f => [f.fileID,f]));
      const urls = paths.map(p => {
        const f = signed.get(files.get(p));
        if (!f || (f.status !== undefined && f.status !== 0) || (f.code && f.code !== 'SUCCESS') || typeof f.tempFileURL !== 'string') throw Error('Signing failed');
        const u = new URL(f.tempFileURL);
        if (u.protocol !== 'https:' || u.username || u.password || u.port || !allowedHosts.has(u.hostname)) throw Error('Invalid download host');
        return {path:p,url:f.tempFileURL};
      });
      return {ok:true,version:manifest.version,expiresAt:started+TTL_SECONDS*1000,ttlSeconds:TTL_SECONDS,files:urls};
    } catch (_) {
      // Never echo signed URLs or SDK exception payloads into client/log output.
      return {ok:false,code:'ASSET_SIGN_FAILED'};
    }
  };
}
module.exports = {createAssetHandler,TTL_SECONDS};
