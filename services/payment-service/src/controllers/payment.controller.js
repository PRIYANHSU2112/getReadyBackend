import { ApiResponse, HttpStatus } from '@getready/errors';

export class PaymentController {
  constructor(paymentService) {
    this.paymentService = paymentService;
  }

  createOrder = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const result = await this.paymentService.createOrder({
      ...req.body,
      userId,
    });
    return ApiResponse.success(res, result, 'Payment order created successfully', HttpStatus.CREATED);
  };

  verifyPayment = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const payment = await this.paymentService.verifyPayment({
      ...req.body,
      userId,
    });
    return ApiResponse.success(res, payment, 'Payment verified successfully');
  };

  handleWebhook = async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const result = await this.paymentService.processWebhook(req.body, signature);
    return res.status(HttpStatus.OK).json(result);
  };

  refundPayment = async (req, res) => {
    const { id } = req.params;
    const result = await this.paymentService.refundPayment(id, req.body);
    return ApiResponse.success(res, result, 'Payment refunded successfully');
  };

  getPayment = async (req, res) => {
    const { id } = req.params;
    const payment = await this.paymentService.getPaymentById(id);
    return ApiResponse.success(res, payment, 'Payment retrieved successfully');
  };

  listPayments = async (req, res) => {
    const result = await this.paymentService.listPayments(req.query);
    return ApiResponse.paginated(
      res,
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNext: result.page < result.totalPages,
        hasPrevious: result.page > 1,
      },
      'Payments fetched successfully',
    );
  };

  getKpis = async (req, res) => {
    const kpis = await this.paymentService.getKpis();
    return ApiResponse.success(res, kpis, 'Payment KPIs retrieved successfully');
  };

  createPayment = async (req, res) => {
    const payment = await this.paymentService.createPaymentManual(req.body);
    return ApiResponse.created(res, payment, 'Payment recorded successfully');
  };

  updatePayment = async (req, res) => {
    const { id } = req.params;
    const payment = await this.paymentService.updatePayment(id, req.body);
    return ApiResponse.success(res, payment, 'Payment updated successfully');
  };

  deletePayment = async (req, res) => {
    const { id } = req.params;
    const result = await this.paymentService.deletePayment(id);
    return ApiResponse.success(res, result, 'Payment cancelled successfully');
  };
}
