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

// These are read from the global window.AUTH0_CONFIG injected by index.html
const { domain, clientId, audience, redirectUri } = window.AUTH0_CONFIG || {};

let _client = null;

const Auth = {
  isAuthenticated: false,
  user: null,

  async init() {
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
        audience,
      },
      cacheLocation: 'memory',
      useRefreshTokens: true,
    });

    // Handle the callback after Auth0 redirect
    const query = window.location.search;
    if (query.includes('code=') && query.includes('state=')) {
      try {
        await _client.handleRedirectCallback();
        // Clean the URL without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
        Auth.isAuthenticated = true;
        Auth.user = await _client.getUser();
        window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: Auth.user } }));
      } catch (e) {
        console.error('[Auth] handleRedirectCallback error:', e);
      }
    } else {
      try {
        // Silent auth — will succeed if user has an active Auth0 session
        await _client.getTokenSilently();
        Auth.isAuthenticated = true;
        Auth.user = await _client.getUser();
      } catch {
        // Not logged in — that's fine, anonymous browsing is supported
        Auth.isAuthenticated = false;
        Auth.user = null;
      }
    }

    window.dispatchEvent(new CustomEvent('auth:ready', {
      detail: { user: Auth.user, isAuthenticated: Auth.isAuthenticated },
    }));
  },

  login() {
    if (!_client) { console.warn('[Auth] client not initialised'); return; }
    _client.loginWithRedirect({
      authorizationParams: {
        redirect_uri: redirectUri || window.location.origin,
        audience,
      },
    });
  },

  logout() {
    if (!_client) return;
    Auth.isAuthenticated = false;
    Auth.user = null;
    _client.logout({ logoutParams: { returnTo: window.location.origin } });
  },

  async getToken() {
    if (!_client || !Auth.isAuthenticated) return null;
    try {
      return await _client.getTokenSilently();
    } catch {
      return null;
    }
  },

  getUser() {
    return Auth.user;
  },
};

export default Auth;

// Auto-boot: deferred so all module listeners register first before auth:ready fires
setTimeout(() => Auth.init(), 0);
