import { createClient } from '@insforge/sdk';

const baseUrl = import.meta.env.VITE_INSFORGE_URL;
const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY;

export const isInsForgeConfigured = Boolean(baseUrl && anonKey);

export const insforge = isInsForgeConfigured
  ? createClient({
      baseUrl,
      anonKey,
    })
  : null;
