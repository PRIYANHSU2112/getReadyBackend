import axios from 'axios';
import { logger } from '@getready/logger';
import { config } from '../config/index.js';
import { NotFoundError } from '@getready/errors';

export class CatalogClient {
  constructor(baseUrl = config.catalogServiceUrl) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 5000,
    });
  }

  async getServiceById(serviceId) {
    try {
      const response = await this.client.get(`/api/v1/catalog/services/${serviceId}`);
      return response.data?.data || response.data;
    } catch (err) {
      if (err.response?.status === 404) {
        throw new NotFoundError('Service not found');
      }
      logger.error({ err, serviceId }, 'Failed to fetch service from Catalog Service');
      throw err;
    }
  }

  async getPackageById(packageId) {
    try {
      const response = await this.client.get(`/api/v1/catalog/packages/${packageId}`);
      return response.data?.data || response.data;
    } catch (err) {
      if (err.response?.status === 404) {
        throw new NotFoundError('Package not found');
      }
      logger.error({ err, packageId }, 'Failed to fetch package from Catalog Service');
      throw err;
    }
  }

  async getHygieneKit() {
    try {
      const response = await this.client.get('/api/v1/catalog/hygiene-kits');
      const kits = response.data?.data || response.data;
      return Array.isArray(kits) ? kits[0] : kits;
    } catch (err) {
      logger.warn({ err }, 'Could not fetch hygiene kit from Catalog Service');
      return null;
    }
  }
}
