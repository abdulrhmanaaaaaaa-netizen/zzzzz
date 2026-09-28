/* ============================================================
   RemoveBG Neon Studio · CONFIG
   ⚠️ ضع مفاتيحك هنا. لا تشاركه علنًا.
   ============================================================ */

window.CONFIG = Object.freeze({

  /* ---------- Supabase ---------- */
  SUPABASE_URL: 'https://skhvturpodaimjjpjmtx.supabase.co',
  SUPABASE_KEY: 'sb_publishable_3Xuz2rzkutg9ivHlfmLTYA_uX5iI-tJ',

  /* ---------- Pixelcut Proxy ----------
     اتركه فارغًا لو مش عندك Proxy.
     لو ضبطت Cloudflare Worker، حط رابطه هنا لإخفاء الـ API key */
  MATTE_PROXY: '',
  PIXELCUT_DIRECT: 'https://api2.pixelcut.app/image/matte/v1',
  PIXELCUT_CLIENT_VERSION: 'web:pixa.com:4a5b0af2',

  /* ---------- Storage ---------- */
  BUCKET: 'user-images',
  SESSION_KEY: 'removebg_neon_v8',
  SIGNED_URL_SECONDS: 900,

  /* ---------- Limits ---------- */
  DEFAULT_DAILY_LIMIT: 5,
  MAX_FILE_MB: 20,
  LOADER_MIN_MS: 4200,

  /* ---------- Email Validation ---------- */
  BLOCK_DISPOSABLE: [
    'tempmail','10minutemail','guerrillamail','mailinator',
    'throwaway','yopmail','trashmail','getnada','sharklasers',
    'temp-mail','fakeinbox','mytemp','maildrop'
  ]
});
