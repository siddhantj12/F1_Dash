/**
 * auth.js — Auth0 SPA SDK wrapper
 */

import { createAuth0Client } from 'https://cdn.jsdelivr.net/npm/@auth0/auth0-spa-js@2.1.3/dist/auth0-spa-js.production.esm.js';

let _client = null;
let _cfg = null;
const ACCESS_TOKEN_KEY = 'f1dash_token';
const ACCESS_TOKEN_EXP_KEY = 'f1dash_token_exp';
const ID_TOKEN_KEY = 'f1dash_id_token';
const ID_TOKEN_EXP_KEY = 'f1dash_id_token_exp';

async function _getConfig() {
  if (_cfg) return _cfg;
  for (let i = 0; i < 20; i++) {
    const c = window.AUTH0_CONFIG || {};
    if (c.domain && c.clientId) { _cfg = c; return _cfg; }
    await new Promise(r => setTimeout(r, 100));
  }
  return window.AUTH0_CONFIG || {};
}

function _authorizationParams(cfg) {
  // NOTE: audience is intentionally omitted — the Auth0 tenant does not have
  // https://f1dashboard.api registered as an API.  Without it Auth0 returns
  // an ID token (aud = clientId) which the backend accepts.
  return {
    redirect_uri: cfg.redirectUri || window.location.origin,
    scope: 'openid profile email',
  };
}

function _cacheToken(key, expKey, token, expiresAtMs = Date.now() + 3500000) {
  if (!token) return null;
  sessionStorage.setItem(key, token);
  sessionStorage.setItem(expKey, String(expiresAtMs));
  return token;
}

function _getCachedToken(key, expKey) {
  const token = sessionStorage.getItem(key);
  const expiresAt = Number(sessionStorage.getItem(expKey) || '0');
  if (!token || Date.now() >= expiresAt) return null;
  return token;
}

function _getAnyCachedToken() {
  return (
    _getCachedToken(ACCESS_TOKEN_KEY, ACCESS_TOKEN_EXP_KEY)
    || _getCachedToken(ID_TOKEN_KEY, ID_TOKEN_EXP_KEY)
  );
}

function _clearSessionTokens() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_EXP_KEY);
  sessionStorage.removeItem(ID_TOKEN_KEY);
  sessionStorage.removeItem(ID_TOKEN_EXP_KEY);
}

function _persistAuthUser(user) {
  localStorage.setItem('f1dash_auth', '1');
  if (user) {
    localStorage.setItem('f1dash_user', JSON.stringify(user));
  }
}

function _clearPersistedAuth({ clearProfile = false } = {}) {
  localStorage.removeItem('f1dash_auth');
  localStorage.removeItem('f1dash_user');
  if (clearProfile) {
    localStorage.removeItem('f1dash_profile');
    // Deliberately keep f1dash_profile_pending_sync — if a save was in-flight
    // or failed before logout, it will be flushed on the next login.
  }
  _clearSessionTokens();
}

async function _restoreUser() {
  if (_client) {
    const sdkUser = await _client.getUser().catch(() => null);
    if (sdkUser) return sdkUser;
  }
  try {
    return JSON.parse(localStorage.getItem('f1dash_user') || 'null');
  } catch {
    return null;
  }
}

async function _cacheIdToken() {
  if (!_client) return null;
  const claims = await _client.getIdTokenClaims().catch(() => null);
  const raw = claims?.__raw;
  if (!raw) return null;
  const expiresAtMs = claims?.exp ? claims.exp * 1000 : Date.now() + 3500000;
  return _cacheToken(ID_TOKEN_KEY, ID_TOKEN_EXP_KEY, raw, expiresAtMs);
}

function _isJwt(token) {
  // Opaque tokens have no dots; JWTs are header.payload.signature
  return typeof token === 'string' && token.split('.').length === 3;
}

async function _getAccessToken() {
  if (!_client) return null;
  const token = await _client.getTokenSilently();
  // Without a registered API audience Auth0 returns an opaque (non-JWT) token
  // which the backend cannot validate. Discard it and fall through to the ID token.
  if (!_isJwt(token)) return null;
  return _cacheToken(ACCESS_TOKEN_KEY, ACCESS_TOKEN_EXP_KEY, token);
}

async function _primeSessionTokens() {
  try {
    const accessToken = await _getAccessToken();
    if (accessToken) return accessToken;
  } catch (e) {
    console.warn('[Auth] access token refresh failed:', e.error || e.message);
  }

  const idToken = await _cacheIdToken();
  if (idToken) {
    console.warn('[Auth] falling back to cached ID token for authenticated requests');
  }
  return idToken;
}

const Auth = {
  isAuthenticated: false,
  user: null,

  async init() {
    const cfg = await _getConfig();
    const { domain, clientId } = cfg;

    if (!domain || !clientId) {
      console.warn('[Auth] AUTH0_CONFIG not set — auth disabled');
      window.dispatchEvent(new CustomEvent('auth:ready', { detail: { user: null, isAuthenticated: false } }));
      return;
    }

    try {
      _client = await createAuth0Client({
        domain,
        clientId,
        cacheLocation: 'localstorage',
        useRefreshTokens: true,
        useRefreshTokensFallback: true,
        authorizationParams: _authorizationParams(cfg),
      });
      console.log('[Auth] client created');
    } catch (e) {
      console.error('[Auth] createAuth0Client failed:', e);
      window.dispatchEvent(new CustomEvent('auth:ready', { detail: { user: null, isAuthenticated: false } }));
      return;
    }

    const query = new URLSearchParams(window.location.search);
    const isCallback = query.has('code') && query.has('state');

    if (isCallback) {
      try {
        await _client.handleRedirectCallback();
      } catch (e) {
        console.error('[Auth] handleRedirectCallback error:', e);
      } finally {
        const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }

    let sdkAuthenticated = false;
    try {
      sdkAuthenticated = await _client.isAuthenticated();
    } catch (e) {
      console.warn('[Auth] isAuthenticated check failed:', e.error || e.message);
    }

    if (sdkAuthenticated) {
      Auth.isAuthenticated = true;
      Auth.user = await _restoreUser();
      _persistAuthUser(Auth.user);
      await _primeSessionTokens();
      console.log('[Auth] authenticated user restored:', Auth.user?.email || Auth.user?.sub);
      if (isCallback) {
        window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: Auth.user } }));
      }
    } else {
      const hadAuth = localStorage.getItem('f1dash_auth') === '1';
      const cachedUser = hadAuth ? await _restoreUser() : null;
      if (cachedUser) {
        Auth.isAuthenticated = true;
        Auth.user = cachedUser;
        _persistAuthUser(cachedUser);
        await _cacheIdToken().catch(() => null);
        console.warn('[Auth] using cached user after silent auth miss:', cachedUser.email || cachedUser.sub);
      } else {
        Auth.isAuthenticated = false;
        Auth.user = null;
        _clearPersistedAuth();
      }
    }

    window.dispatchEvent(new CustomEvent('auth:ready', {
      detail: { user: Auth.user, isAuthenticated: Auth.isAuthenticated },
    }));
  },

  async login() {
    for (let i = 0; i < 30 && !_client; i++) await new Promise(r => setTimeout(r, 100));
    if (!_client) { console.error('[Auth] client not ready for login'); return; }
    const cfg = await _getConfig();
    console.log('[Auth] redirecting to Auth0...');
    await _client.loginWithRedirect({
      authorizationParams: _authorizationParams(cfg),
    });
  },

  logout() {
    Auth.isAuthenticated = false;
    Auth.user = null;
    _clearPersistedAuth({ clearProfile: true });
    if (_client) {
      _client.logout({ logoutParams: { returnTo: window.location.origin } });
    }
  },

  async getToken() {
    if (!Auth.isAuthenticated) return null;
    if (_client) {
      try {
        const accessToken = await _getAccessToken();
        if (accessToken) return accessToken;
      } catch (e) {
        console.warn('[Auth] getTokenSilently failed:', e.error || e.message);
      }
      const idToken = await _cacheIdToken();
      if (idToken) return idToken;
    }
    return _getAnyCachedToken();
  },

  getUser() { return Auth.user; },
};

export default Auth;

setTimeout(() => Auth.init(), 0);
