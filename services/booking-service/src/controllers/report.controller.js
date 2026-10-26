import { ApiResponse, HttpStatus, AppError, ErrorCodes } from '@getready/errors';

export class ReportController {
  constructor(reportService) {
    this.reportService = reportService;
  }

  /**
   * List archived reports
   */
  listReports = async (req, res) => {
    const { items, meta } = await this.reportService.listReports(req.query);
    return ApiResponse.paginated(res, items, meta, 'Reports fetched successfully');
  };

  /**
   * Get direct report data preview
   */
  getReportData = async (req, res) => {
    const { templateId = 'bookings_master', datePreset = 'month', startDate, endDate } = req.query;
    const data = await this.reportService.fetchReportData(templateId, datePreset, startDate, endDate);
    return ApiResponse.success(res, data, 'Report data retrieved successfully');
  };

  /**
   * Generate and archive a report
   */
  generateReport = async (req, res) => {
    const {
      templateId = 'bookings_master',
      format = 'CSV',
      datePreset = 'month',
      startDate,
      endDate,
    } = req.body || {};

    const generatedBy =
      req.headers['x-user-name'] || req.headers['x-user-email'] || req.user?.name || 'Super Admin';

    const result = await this.reportService.generateReport({
      templateId,
      format,
      datePreset,
      startDate,
      endDate,
      generatedBy,
    });

    return ApiResponse.success(res, result, 'Report generated successfully', HttpStatus.CREATED);
  };

  /**
   * Get report by ID
   */
  getReportById = async (req, res) => {
    const { id } = req.params;
    const report = await this.reportService.getReportById(id);
    if (!report) {
      throw new AppError('Report not found in archive', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }
    return ApiResponse.success(res, report, 'Report retrieved successfully');
  };

  /**
   * Download or stream report archive file
   */
  downloadReport = async (req, res) => {
    const { id } = req.params;
    const report = await this.reportService.getReportById(id);
    if (!report) {
      throw new AppError('Report not found in archive', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    if (req.query.stream === 'csv') {
      const data = report.dataSnapshot || [];
      const columns = report.columns || [];
      const headers = columns.map((c) => `"${(c.header || c.key).replace(/"/g, '""')}"`).join(',');
      const rows = data.map((row) =>
        columns
          .map((c) => {
            const val = row[c.key];
            const str = val === undefined || val === null ? '' : String(val);
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(','),
      );
      const csv = '\uFEFF' + [headers, ...rows].join('\r\n');

      const filename = `${report.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csv);
    }

    return ApiResponse.success(res, report, 'Report ready for download');
  };

  /**
   * Delete report by ID
   */
  deleteReport = async (req, res) => {
    const { id } = req.params;
    const deleted = await this.reportService.deleteReport(id);
    if (!deleted) {
      throw new AppError('Report not found or already deleted', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }
    return ApiResponse.success(res, { id }, 'Report deleted from archive');
  };
}

export default ReportController;
