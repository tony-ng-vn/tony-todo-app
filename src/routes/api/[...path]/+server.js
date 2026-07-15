import { proxyToInsForge } from '$lib/server/insforgeProxy.js';

// Forward every method under /api/* to the InsForge backend (same-origin proxy).
export const GET = proxyToInsForge;
export const POST = proxyToInsForge;
export const PUT = proxyToInsForge;
export const PATCH = proxyToInsForge;
export const DELETE = proxyToInsForge;
export const OPTIONS = proxyToInsForge;
export const HEAD = proxyToInsForge;
