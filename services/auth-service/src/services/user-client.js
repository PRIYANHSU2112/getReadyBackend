import { getPropagationHeaders } from '@getready/tracing';
import { logger } from '@getready/logger';

export class UserClient {
  /**
   * @param {string} baseUrl - e.g. "http://localhost:3002"
   */
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async findByEmailForAuth(email) {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/users/internal/auth-lookup-email`, {
        method: 'POST',
        headers: getPropagationHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ email }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data || null;
    } catch (err) {
      logger.error({ err, email }, 'UserClient: findByEmailForAuth failed');
      return null;
    }
  }

  async findOrCreateMobileUser(data) {
    const res = await fetch(`${this.baseUrl}/api/v1/users/internal/find-or-create-mobile`, {
      method: 'POST',
      headers: getPropagationHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to find or create mobile user');
    }
    const json = await res.json();
    return json.data;
  }

  async updateLastLogin(userId, extra = {}) {
    const res = await fetch(`${this.baseUrl}/api/v1/users/internal/${userId}/last-login`, {
      method: 'PATCH',
      headers: getPropagationHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(extra),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  }

  async setPasswordByEmail(email, newPassword) {
    const res = await fetch(`${this.baseUrl}/api/v1/users/internal/set-password-by-email`, {
      method: 'PATCH',
      headers: getPropagationHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email, newPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to set password');
    }
    const json = await res.json();
    return json.data;
  }

  async getMe(userId) {
    const res = await fetch(`${this.baseUrl}/api/v1/users/${userId}`, {
      method: 'GET',
      headers: getPropagationHeaders({ 'x-user-id': userId }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  }

  async findById(userId) {
    return this.getMe(userId);
  }
}
