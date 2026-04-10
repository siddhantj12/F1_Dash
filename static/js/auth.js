/**
 * auth.js — Auth0 SPA SDK wrapper
 *
 * Exposes:
 *   Auth.init()          — call once on page load; performs silent auth check
 *   Auth.login()         — redirect to Auth0 Universal Login
 *   Auth.logout()        — clear session and redirect to home
 *   Auth.getToken()      — returns access token string (or null if anonymous)
 *   Auth.getUser()       — returns Auth0 user object (or null)
 *   Auth.isAuthenticated — boolean
 *
 * Dispatches:
 *   window 'auth:ready'  — after init() completes (detail: { user, isAuthenticated })
 *   window 'auth:login'  — after a successful login callback (detail: { user })
 */

import { createAuth0Client } from 'https://cdn.jsdelivr.net/npm/@auth0/auth0-spa-js@2.1.3/dist/auth0-spa-js.production.esm.js';

let _client = null;
let _cfg = null; // resolved lazily after /api/auth0-config fetch completes

async function _getConfig() {
  if (_cfg) return _cfg;
  // Wait up to 2s for index.html's fetch('/api/auth0-config') to populate window.AUTH0_CONFIG
  for (let i = 0; i < 20; i++) {
    const c = window.AUTH0_CONFIG || {};
    if (c.domain && c.clientId) { _cfg = c; return _cfg; }
    await new Promise(r => setTimeout(r, 100));
  }
  return window.AUTH0_CONFIG || {};
}

const Auth = {
  isAuthenticated: false,
  user: null,

  async init() {
    const { domain, clientId, redirectUri, audience } = await _getConfig();

    if (!domain || !clientId) {
      console.warn('[Auth] AUTH0_CONFIG not set — auth disabled');
      window.dispatchEvent(new CustomEvent('auth:ready', { detail: { user: null, isAuthenticated: false } }));
      return;
    }

    _client = await createAuth0Client({
      domain,
      clientId,
      authorizationParams: {
        redirect_uri: redirectUri || window.location.origin,
        ...(audience ? { audience } : {}),
      },
      cacheLocation: 'localstorage',
    });

    // Handle the callback after Auth0 redirect
    const query = window.location.search;
    if (query.includes('code=') && query.includes('state=')) {
      try {
        await _client.handleRedirectCallback();
        window.history.replaceState({}, document.title, window.location.pathname);
        Auth.isAuthenticated = true;
        Auth.user = await _client.getUser();
        // Persist flag so silent-auth failures don't immediately log the user out
        localStorage.setItem('f1dash_auth', '1');
        if (Auth.user) localStorage.setItem('f1dash_user', JSON.stringify(Auth.user));
        try {
          const t = await _client.getTokenSilently();
          if (t) { sessionStorage.setItem('f1dash_token', t); sessionStorage.setItem('f1dash_token_exp', String(Date.now() + 3500000)); }
        } catch {}
        window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: Auth.user } }));
      } catch (e) {
        console.error('[Auth] handleRedirectCallback error:', e);
      }
    } else {
      try {
        const t = await _client.getTokenSilently();
        Auth.isAuthenticated = true;
        Auth.user = await _client.getUser();
        localStorage.setItem('f1dash_auth', '1');
        if (Auth.user) localStorage.setItem('f1dash_user', JSON.stringify(Auth.user));
        if (t) { sessionStorage.setItem('f1dash_token', t); sessionStorage.setItem('f1dash_token_exp', String(Date.now() + 3500000)); }
      } catch {
        // getTokenSilently() failed (refresh tokens not configured or cookies blocked).
        // Use the SDK's cached user object, then fall back to our own localStorage copy.
        const hadAuth = localStorage.getItem('f1dash_auth') === '1';
        let cached = hadAuth ? (await _client.getUser().catch(() => null)) : null;
        if (!cached && hadAuth) {
          try { cached = JSON.parse(localStorage.getItem('f1dash_user') || 'null'); } catch {}
        }
        if (cached) {
          Auth.isAuthenticated = true;
          Auth.user = cached;
        } else {
          Auth.isAuthenticated = false;
          Auth.user = null;
          localStorage.removeItem('f1dash_auth');
          localStorage.removeItem('f1dash_user');
        }
      }
    }

    window.dispatchEvent(new CustomEvent('auth:ready', {
      detail: { user: Auth.user, isAuthenticated: Auth.isAuthenticated },
    }));
  },

  async login() {
    if (!_client) { console.warn('[Auth] client not initialised'); return; }
    const { redirectUri, audience } = await _getConfig();
    _client.loginWithRedirect({
      authorizationParams: {
        redirect_uri: redirectUri || window.location.origin,
        ...(audience ? { audience } : {}),
      },
    });
  },

  logout() {
    if (!_client) return;
    Auth.isAuthenticated = false;
    Auth.user = null;
    localStorage.removeItem('f1dash_auth');
    localStorage.removeItem('f1dash_user');
    localStorage.removeItem('f1dash_profile');
    sessionStorage.removeItem('f1dash_token');
    sessionStorage.removeItem('f1dash_token_exp');
    _client.logout({ logoutParams: { returnTo: window.location.origin } });
  },

  async getToken() {
    if (!Auth.isAuthenticated) return null;
    if (_client) {
      try {
        const t = await _client.getTokenSilently();
        if (t) { sessionStorage.setItem('f1dash_token', t); sessionStorage.setItem('f1dash_token_exp', String(Date.now() + 3500000)); }
        return t;
      } catch {}
    }
    // Fallback: session-cached token (valid within same browser session until expiry)
    const cached = sessionStorage.getItem('f1dash_token');
    const exp = parseInt(sessionStorage.getItem('f1dash_token_exp') || '0');
    if (cached && Date.now() < exp) return cached;
    return null;
  },

  getUser() {
    return Auth.user;
  },
};

export default Auth;

// Auto-boot: deferred so all module listeners register first before auth:ready fires
setTimeout(() => Auth.init(), 0);
