import { logger } from '@getready/logger';
import { esClient } from '../client/elasticsearch.client.js';
import { BEAUTICIANS_INDEX, beauticiansIndexDefinition } from '../indices/beauticians.index.js';
import { SERVICES_INDEX, servicesIndexDefinition } from '../indices/services.index.js';

export class IndexerService {
  constructor(client = esClient) {
    this.client = client;
  }

  async ensureIndices() {
    if (!this.client) return;

    try {
      // 1. Beauticians Index
      const beauticiansExist = await this.client.indices.exists({ index: BEAUTICIANS_INDEX });
      if (!beauticiansExist) {
        await this.client.indices.create({
          index: BEAUTICIANS_INDEX,
          body: beauticiansIndexDefinition,
        });
        logger.info({ index: BEAUTICIANS_INDEX }, 'Elasticsearch index created successfully');
      }

      // 2. Services Index
      const servicesExist = await this.client.indices.exists({ index: SERVICES_INDEX });
      if (!servicesExist) {
        await this.client.indices.create({
          index: SERVICES_INDEX,
          body: servicesIndexDefinition,
        });
        logger.info({ index: SERVICES_INDEX }, 'Elasticsearch index created successfully');
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to initialize Elasticsearch indices (ES may be offline)');
    }
  }

  async indexBeautician(doc) {
    if (!this.client || !doc.id) return false;
    try {
      await this.client.index({
        index: BEAUTICIANS_INDEX,
        id: String(doc.id),
        document: {
          id: String(doc.id),
          userId: String(doc.userId || doc.id),
          name: doc.name || 'Beautician',
          bio: doc.bio || '',
          services: Array.isArray(doc.services) ? doc.services.join(' ') : String(doc.services || ''),
          serviceIds: doc.serviceIds || [],
          rating: Number(doc.rating || 4.8),
          ratingCount: Number(doc.ratingCount || 0),
          price: Number(doc.price || 499),
          location: doc.location || { lat: 23.2599, lon: 77.4126 },
          city: doc.city || 'Bhopal',
          address: doc.address || '',
          operationalStatus: doc.operationalStatus || 'ONLINE',
          isAvailable: doc.isAvailable !== undefined ? Boolean(doc.isAvailable) : true,
          isActive: doc.isActive !== undefined ? Boolean(doc.isActive) : true,
          experienceYears: Number(doc.experienceYears || 2),
          avatarUrl: doc.avatarUrl || null,
          updatedAt: new Date().toISOString(),
        },
        refresh: 'wait_for',
      });
      return true;
    } catch (err) {
      logger.error({ err: err.message, id: doc.id }, 'Failed to index beautician in Elasticsearch');
      return false;
    }
  }

  async deleteBeautician(id) {
    if (!this.client || !id) return false;
    try {
      await this.client.delete({
        index: BEAUTICIANS_INDEX,
        id: String(id),
      });
      return true;
    } catch (err) {
      logger.warn({ err: err.message, id }, 'Failed to delete beautician from Elasticsearch');
      return false;
    }
  }

  async indexService(doc) {
    if (!this.client || !doc.id) return false;
    try {
      await this.client.index({
        index: SERVICES_INDEX,
        id: String(doc.id),
        document: {
          id: String(doc.id),
          name: doc.name || 'Service',
          category: doc.category || 'General',
          categoryId: String(doc.categoryId || ''),
          description: doc.description || '',
          price: Number(doc.price || 0),
          discountedPrice: doc.discountedPrice ? Number(doc.discountedPrice) : Number(doc.price || 0),
          duration: Number(doc.duration || 45),
          rating: Number(doc.rating || 4.8),
          ratingCount: Number(doc.ratingCount || 0),
          isActive: doc.isActive !== undefined ? Boolean(doc.isActive) : true,
          status: doc.status || 'APPROVED',
          gender: doc.gender || 'all',
          bestseller: Boolean(doc.bestseller || doc.rating >= 4.8),
          imageUrl: doc.imageUrl || null,
          badges: doc.badges || [],
          updatedAt: new Date().toISOString(),
        },
        refresh: 'wait_for',
      });
      return true;
    } catch (err) {
      logger.error({ err: err.message, id: doc.id }, 'Failed to index service in Elasticsearch');
      return false;
    }
  }

  async deleteService(id) {
    if (!this.client || !id) return false;
    try {
      await this.client.delete({
        index: SERVICES_INDEX,
        id: String(id),
      });
      return true;
    } catch (err) {
      logger.warn({ err: err.message, id }, 'Failed to delete service from Elasticsearch');
      return false;
    }
  }

  async bulkIndex(indexName, docs) {
    if (!this.client || !Array.isArray(docs) || docs.length === 0) return { indexed: 0 };
    const operations = docs.flatMap((doc) => [{ index: { _index: indexName, _id: String(doc.id) } }, doc]);
    try {
      const response = await this.client.bulk({ refresh: true, operations });
      return {
        indexed: docs.length,
        errors: response.errors,
      };
    } catch (err) {
      logger.error({ err: err.message, indexName }, 'Elasticsearch bulk index failed');
      return { indexed: 0, error: err.message };
    }
  }

  async reindexFromMongo(db) {
    if (!db) return { status: 'ERROR', message: 'No MongoDB connection available' };

    logger.info('Starting full MongoDB to Elasticsearch reindex...');
    await this.ensureIndices();

    let beauticiansCount = 0;
    let servicesCount = 0;

    try {
      // 1. Reindex Beauticians
      const beauticiansColl = db.collection('beautician_profiles');
      const beauticianDocs = await beauticiansColl.find({ isActive: true }).toArray();

      const bDocs = beauticianDocs.map((b) => ({
        id: b._id.toString(),
        userId: String(b.userId || b._id),
        name: b.name || b.fullName || 'Beautician',
        bio: b.bio || '',
        services: (b.skills || []).join(' '),
        serviceIds: b.eligibleServiceIds || [],
        rating: b.ratingAvg || 4.8,
        ratingCount: b.ratingCount || 0,
        price: 499,
        location: b.address?.location?.coordinates
          ? { lon: b.address.location.coordinates[0], lat: b.address.location.coordinates[1] }
          : { lat: 23.2599, lon: 77.4126 },
        city: b.address?.city || 'Bhopal',
        address: b.address?.line1 || '',
        operationalStatus: b.operationalStatus || 'ONLINE',
        isAvailable: b.isAvailable !== false,
        isActive: b.isActive !== false,
        experienceYears: b.experienceYears || 2,
        avatarUrl: b.profilePhoto?.url || null,
        updatedAt: new Date().toISOString(),
      }));

      if (bDocs.length > 0) {
        await this.bulkIndex(BEAUTICIANS_INDEX, bDocs);
        beauticiansCount = bDocs.length;
      }

      // 2. Reindex Services
      const servicesColl = db.collection('services');
      const serviceDocs = await servicesColl.find({ isActive: true, status: 'APPROVED', deletedAt: null }).toArray();

      const sDocs = serviceDocs.map((s) => ({
        id: s._id.toString(),
        name: s.name,
        category: s.categoryName || 'Salon Service',
        categoryId: s.categoryId?.toString() || '',
        description: s.description || '',
        price: s.price || 0,
        discountedPrice: s.discountedPrice || s.price || 0,
        duration: s.durationMinMinutes || 45,
        rating: s.ratingAvg || 4.8,
        ratingCount: s.ratingCount || 0,
        isActive: s.isActive !== false,
        status: s.status || 'APPROVED',
        gender: s.gender || 'all',
        bestseller: (s.ratingAvg || 0) >= 4.8,
        imageUrl: s.thumbnail?.url || null,
        badges: s.badges || [],
        updatedAt: new Date().toISOString(),
      }));

      if (sDocs.length > 0) {
        await this.bulkIndex(SERVICES_INDEX, sDocs);
        servicesCount = sDocs.length;
      }

      logger.info({ beauticiansCount, servicesCount }, 'Full reindex completed');
      return {
        status: 'SUCCESS',
        beauticiansIndexed: beauticiansCount,
        servicesIndexed: servicesCount,
      };
    } catch (err) {
      logger.error({ err }, 'Error during MongoDB reindex');
      return { status: 'ERROR', error: err.message };
    }
  }
}

export const indexerService = new IndexerService();
export default indexerService;
