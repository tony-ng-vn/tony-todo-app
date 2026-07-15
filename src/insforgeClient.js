import { createClient } from '@insforge/sdk';

const backendUrl = import.meta.env.VITE_INSFORGE_URL;
const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY;

export const isInsForgeConfigured = Boolean(backendUrl && anonKey);

// Talk to the backend through this app's own origin instead of the InsForge
// domain directly. A same-origin proxy (src/routes/api + src/routes/functions)
// forwards to the real backend, which keeps the auth refresh cookie first-party
// so sessions survive page reloads. See src/lib/server/insforgeProxy.js.
// Falls back to the absolute backend URL when there's no browser origin (e.g.
// during tests); the app itself only runs client-side.
const sameOriginBaseUrl = typeof window !== 'undefined' ? window.location.origin : backendUrl;

export const insforge = isInsForgeConfigured
  ? createClient({
      baseUrl: sameOriginBaseUrl,
      anonKey,
    })
  : null;
