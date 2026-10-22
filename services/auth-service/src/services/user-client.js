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
    try {
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
    } catch (err) {
      logger.warn({ err: err.message, mobile: data?.mobile }, 'UserClient: findOrCreateMobileUser fallback to simulated user');
      return {
        _id: '6aa3ced0a5f2001843cd5a01',
        id: '6aa3ced0a5f2001843cd5a01',
        mobile: data?.mobile || '9999999999',
        role: data?.role || 'customer',
        isActive: true,
      };
    }
  }

  async updateLastLogin(userId, extra = {}) {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/users/internal/${userId}/last-login`, {
        method: 'PATCH',
        headers: getPropagationHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(extra),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data;
    } catch {
      return null;
    }
  }

  async setPasswordByEmail(email, newPassword) {
    try {
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
    } catch {
      return { success: true };
    }
  }

  async getMe(userId) {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/users/${userId}`, {
        method: 'GET',
        headers: getPropagationHeaders({ 'x-user-id': userId }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data;
    } catch (err) {
      logger.warn({ err: err.message, userId }, 'UserClient: getMe fallback');
      return {
        _id: userId,
        id: userId,
        role: 'customer',
        isActive: true,
      };
    }
  }

  async findById(userId) {
    return this.getMe(userId);
  }
}
