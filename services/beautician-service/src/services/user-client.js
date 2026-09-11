import { getPropagationHeaders } from '@getready/tracing';
import { logger } from '@getready/logger';

export class UserClient {
  /**
   * @param {string} baseUrl - e.g. "http://localhost:3002"
   */
  constructor(baseUrl = 'http://localhost:3002') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async findOrCreateBeauticianUser(userData) {
    try {
      // 1. Try to find or create mobile user with role 'beautician'
      const payload = {
        name: userData.name || 'Professional Partner',
        phone: userData.phone,
        email: userData.email || undefined,
        role: 'beautician',
        gender: userData.gender || 'FEMALE',
        dob: userData.dob || undefined,
        languages: userData.languages || ['Hindi', 'English'],
        profileImage: userData.profilePhoto || undefined,
      };

      const res = await fetch(`${this.baseUrl}/api/v1/users/internal/find-or-create-mobile`, {
        method: 'POST',
        headers: getPropagationHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        return json.data;
      }

      // If already exists or error, try fetching user by id or create directly
      const createRes = await fetch(`${this.baseUrl}/api/v1/users`, {
        method: 'POST',
        headers: getPropagationHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      if (createRes.ok) {
        const json = await createRes.json();
        return json.data;
      }

      const err = await res.json().catch(() => ({}));
      logger.warn({ err, phone: userData.phone }, 'UserClient: findOrCreateBeauticianUser fallback');
      return null;
    } catch (err) {
      logger.error({ err, phone: userData.phone }, 'UserClient: findOrCreateBeauticianUser network error');
      return null;
    }
  }

  async getUserById(userId) {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/users/${userId}`, {
        method: 'GET',
        headers: getPropagationHeaders({ 'x-user-id': userId }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data || null;
    } catch (err) {
      logger.error({ err, userId }, 'UserClient: getUserById failed');
      return null;
    }
  }
}
