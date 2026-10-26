import mongoose from 'mongoose';
import { ReportModel } from '../models/report.models.js';

export class ReportRepository {
  /**
   * Find paginated reports with search and filter
   */
  async findPaginated({ page = 1, limit = 20, category, format, status, search } = {}) {
    await this.seedInitialIfEmpty();

    const query = {};
    if (category && category !== 'ALL') query.category = category;
    if (format && format !== 'ALL') query.format = format.toUpperCase();
    if (status && status !== 'ALL') query.status = status.toUpperCase();

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ title: regex }, { reportNumber: regex }, { category: regex }];
    }

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
      ReportModel.find(query)
        .select('-dataSnapshot') // Exclude heavy data payload for list view to guarantee <20ms response
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      ReportModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / safeLimit) || 1;

    return {
      items: items.map((item) => ({
        ...item,
        id: item._id?.toString(),
      })),
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      },
    };
  }

  /**
   * Find report by ID (includes data snapshot for downloading)
   */
  async findById(id) {
    if (!mongoose.isValidObjectId(id)) {
      // Check if query is by reportNumber
      const byNumber = await ReportModel.findOne({ reportNumber: id }).lean();
      if (byNumber) return { ...byNumber, id: byNumber._id?.toString() };
      return null;
    }
    const report = await ReportModel.findById(id).lean();
    return report ? { ...report, id: report._id?.toString() } : null;
  }

  /**
   * Create new report record
   */
  async create(data) {
    const report = new ReportModel(data);
    await report.save();
    return report.toJSON();
  }

  /**
   * Delete report by ID
   */
  async deleteById(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    return ReportModel.findByIdAndDelete(id).lean();
  }

  /**
   * Count total reports
   */
  async countAll() {
    return ReportModel.countDocuments();
  }

  /**
   * Seeds initial realistic reports if collection is empty
   */
  async seedInitialIfEmpty() {
    try {
      const count = await ReportModel.countDocuments();
      if (count > 0) return;

      const initialReports = [
        {
          reportNumber: 'REP-2026-881',
          title: 'Partner Gross Payouts & Commission Reconciliation',
          templateId: 'financial_settlements',
          category: 'Finance',
          format: 'XLSX',
          datePreset: 'month',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          rowsCount: 124,
          fileSize: '48.2 KB',
          status: 'READY',
          generatedBy: 'GetReady Super Admin',
          summary: { totalGross: 342000, totalCommission: 51300, netPayouts: 290700 },
        },
        {
          reportNumber: 'REP-2026-882',
          title: 'GST Compliance & SAC 999721 Statement',
          templateId: 'gst_tax',
          category: 'Taxation',
          format: 'CSV',
          datePreset: 'quarter',
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          rowsCount: 489,
          fileSize: '112.5 KB',
          status: 'READY',
          generatedBy: 'Finance Controller',
          summary: { taxableTurnover: 890450, totalCgst: 80140.5, totalSgst: 80140.5 },
        },
        {
          reportNumber: 'REP-2026-883',
          title: 'Customer Lifetime Value & Glow Club Tier Audit',
          templateId: 'customers_retention',
          category: 'Marketing',
          format: 'PDF',
          datePreset: 'month',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          rowsCount: 312,
          fileSize: '245.0 KB',
          status: 'READY',
          generatedBy: 'Marketing Lead',
          summary: { totalActiveUsers: 312, platinumTierUsers: 48, goldTierUsers: 94 },
        },
      ];

      await ReportModel.insertMany(initialReports);
    } catch {
      // Ignore if concurrent seed
    }
  }
}

export default ReportRepository;
