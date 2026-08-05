/**
 * Swagger UI helper: capture tokens from login/OTP/refresh and refresh on 401.
 * Kept defensive so Try it out never hangs (Request-safe, originalFetch for refresh).
 */
(function salonSwaggerAuthHelper() {
  const ACCESS_KEY = 'salon_swagger_access_token';
  const REFRESH_KEY = 'salon_swagger_refresh_token';
  const REFRESH_PATH = '/api/v1/auth/refresh';
  const originalFetch = window.fetch.bind(window);

  /** @type {Promise<object|null>|null} */
  let refreshInFlight = null;

  function getUrl(input) {
    try {
      if (typeof input === 'string') return input;
      if (input && typeof input.url === 'string') return input.url;
    } catch {
      // ignore
    }
    return '';
  }

  function toPathname(url) {
    try {
      return new URL(url, window.location.origin).pathname;
    } catch {
      return '';
    }
  }

  function isApiUrl(url) {
    const path = toPathname(url);
    return path.includes('/api/v1/');
  }

  function isAuthTokenResponseUrl(url) {
    const path = toPathname(url);
    return (
      path.endsWith('/auth/admin/login') ||
      path.endsWith('/auth/login') ||
      path.endsWith('/auth/mobile/verify-otp') ||
      path.endsWith('/auth/refresh')
    );
  }

  function isRefreshUrl(url) {
    return toPathname(url).endsWith('/auth/refresh');
  }

  function authorizeBearer(accessToken) {
    if (!accessToken) return;
    // Defer so we never interrupt Swagger's in-flight Try-it-out render
    setTimeout(() => {
      try {
        if (!window.ui?.authActions?.authorize) return;
        window.ui.authActions.authorize({
          bearerAuth: {
            name: 'bearerAuth',
            schema: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            value: accessToken,
          },
        });
      } catch (err) {
        console.warn('[swagger-auth] authorize failed', err);
      }
    }, 0);
  }

  function persistTokens(accessToken, refreshToken) {
    if (accessToken) {
      localStorage.setItem(ACCESS_KEY, accessToken);
      authorizeBearer(accessToken);
    }
    if (refreshToken) {
      localStorage.setItem(REFRESH_KEY, refreshToken);
    }
  }

  async function captureTokensFromResponse(response) {
    if (!response?.ok) return;
    try {
      const body = await response.clone().json();
      const data = body?.data;
      if (data?.accessToken) {
        persistTokens(data.accessToken, data.refreshToken || null);
      }
    } catch {
      // ignore non-JSON
    }
  }

  function buildRefreshUrl(requestUrl) {
    try {
      const parsed = new URL(requestUrl, window.location.origin);
      return `${parsed.origin}${REFRESH_PATH}`;
    } catch {
      return `${window.location.origin}${REFRESH_PATH}`;
    }
  }

  async function refreshAccessToken(requestUrl) {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return null;

    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        // IMPORTANT: use originalFetch to avoid re-entering this wrapper
        const res = await originalFetch(buildRefreshUrl(requestUrl), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (!res.ok) {
          localStorage.removeItem(ACCESS_KEY);
          localStorage.removeItem(REFRESH_KEY);
          return null;
        }

        const body = await res.json().catch(() => null);
        const accessToken = body?.data?.accessToken || null;
        const nextRefresh = body?.data?.refreshToken || null;
        if (accessToken) {
          persistTokens(accessToken, nextRefresh);
          return { accessToken, refreshToken: nextRefresh };
        }
        return null;
      })()
        .catch((err) => {
          console.warn('[swagger-auth] refresh failed', err);
          return null;
        })
        .finally(() => {
          refreshInFlight = null;
        });
    }

    return refreshInFlight;
  }

  /**
   * Attach Authorization without breaking Request bodies (Swagger UI often passes Request).
   */
  function withAccessToken(input, init, accessToken) {
    if (!accessToken) return { input, init };

    if (typeof Request !== 'undefined' && input instanceof Request) {
      if (input.headers.has('Authorization')) {
        return { input, init };
      }
      const headers = new Headers(input.headers);
      headers.set('Authorization', `Bearer ${accessToken}`);
      return { input: new Request(input, { headers }), init };
    }

    const baseInit = init ? { ...init } : {};
    const headers = new Headers(baseInit.headers || {});
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
    baseInit.headers = headers;
    return { input, init: baseInit };
  }

  window.fetch = async function salonSwaggerFetch(input, init) {
    try {
      const url = getUrl(input);

      // Never interfere with Swagger UI assets / non-API calls
      if (!url || !isApiUrl(url)) {
        return init === undefined ? originalFetch(input) : originalFetch(input, init);
      }

      const alreadyRetried =
        Boolean(init && init.__salonSwaggerRetried) ||
        (typeof Request !== 'undefined' &&
          input instanceof Request &&
          input.headers.get('X-Salon-Swagger-Retry') === '1');

      let nextInput = input;
      let nextInit = init;

      if (!isRefreshUrl(url)) {
        const storedAccess = localStorage.getItem(ACCESS_KEY);
        const attached = withAccessToken(nextInput, nextInit, storedAccess);
        nextInput = attached.input;
        nextInit = attached.init;
      }

      let response =
        nextInit === undefined
          ? await originalFetch(nextInput)
          : await originalFetch(nextInput, nextInit);

      if (isAuthTokenResponseUrl(url)) {
        // Fire-and-forget capture so Execute response is never delayed/lost
        captureTokensFromResponse(response).catch(() => {});
        return response;
      }

      if (response.status === 401 && !alreadyRetried && !isRefreshUrl(url)) {
        const refreshed = await refreshAccessToken(url);
        if (refreshed?.accessToken) {
          if (typeof Request !== 'undefined' && nextInput instanceof Request) {
            const headers = new Headers(nextInput.headers);
            headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
            headers.set('X-Salon-Swagger-Retry', '1');
            const retryReq = new Request(nextInput, { headers });
            response = await originalFetch(retryReq);
          } else {
            const headers = new Headers((nextInit && nextInit.headers) || {});
            headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
            response = await originalFetch(nextInput, {
              ...(nextInit || {}),
              headers,
              __salonSwaggerRetried: true,
            });
          }
        }
      }

      return response;
    } catch (err) {
      console.error('[swagger-auth] fetch wrapper error', err);
      // Fall back to native fetch so Try it out still works
      return init === undefined ? originalFetch(input) : originalFetch(input, init);
    }
  };

  function restoreOnReady() {
    const token = localStorage.getItem(ACCESS_KEY);
    if (token) authorizeBearer(token);
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (window.ui || attempts > 40) {
      clearInterval(timer);
      restoreOnReady();
    }
  }, 250);

  window.addEventListener('load', () => {
    setTimeout(restoreOnReady, 500);
  });
})();
