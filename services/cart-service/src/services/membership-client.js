import axios from 'axios';
import { logger } from '@getready/logger';
import { config } from '../config/index.js';

export class MembershipClient {
  constructor(baseUrl = config.membershipServiceUrl || 'http://localhost:3011') {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 3000,
    });
    this.cache = new Map();
  }

  async getActivePlan(planCode = 'GLOW_CLUB_MONTHLY') {
    const cleanCode = String(planCode).trim().toUpperCase();
    const cacheKey = `plan:${cleanCode}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      const response = await this.client.get('/api/v1/memberships/plans');
      const plans = response.data?.data || [];
      const plan = plans.find((p) => p.planCode === cleanCode) || plans[0] || null;
      if (plan) {
        this.cache.set(cacheKey, { data: plan, expiresAt: Date.now() + 60000 });
      }
      return plan;
    } catch (err) {
      logger.debug({ err: err.message }, 'Failed to fetch plan from Membership Service; using local fallback');
      return null;
    }
  }

  async checkUserMembership(userId) {
    if (!userId) return null;
    const cacheKey = `user:${userId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      const response = await this.client.get('/api/v1/memberships/my-status', {
        headers: { 'x-user-id': String(userId) },
      });
      const data = response.data?.data;
      if (data) {
        this.cache.set(cacheKey, { data, expiresAt: Date.now() + 30000 });
      }
      return data;
    } catch (err) {
      logger.debug({ err: err.message }, 'Failed to check user membership status; using local fallback');
      return null;
    }
  }
}

export const membershipClient = new MembershipClient();
export default membershipClient;
