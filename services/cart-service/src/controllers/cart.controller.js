import { ApiResponse, HttpStatus } from '@getready/errors';

export class CartController {
  constructor(cartService) {
    this.cartService = cartService;
  }

  getCart = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const cart = await this.cartService.getCart(userId);
    return ApiResponse.success(res, cart, 'Cart retrieved successfully');
  };

  clear = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const cart = await this.cartService.clearCart(userId);
    return ApiResponse.success(res, cart, 'Cart cleared successfully');
  };

  addItem = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const cart = await this.cartService.addItem(userId, req.body);
    return ApiResponse.success(res, cart, 'Item added to cart successfully', HttpStatus.OK);
  };

  updateItemQuantity = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const { lineId } = req.params;
    const { quantity } = req.body;
    const cart = await this.cartService.updateItemQuantity(userId, lineId, quantity);
    return ApiResponse.success(res, cart, 'Cart item updated successfully');
  };

  removeItem = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const { lineId } = req.params;
    const cart = await this.cartService.removeItem(userId, lineId);
    return ApiResponse.success(res, cart, 'Cart item removed successfully');
  };

  updateInstructions = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const { specialInstructions } = req.body;
    const cart = await this.cartService.updateInstructions(userId, specialInstructions);
    return ApiResponse.success(res, cart, 'Special instructions updated successfully');
  };

  updateBenefits = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const cart = await this.cartService.updateBenefits(userId, req.body);
    return ApiResponse.success(res, cart, 'Benefits updated successfully');
  };

  updateHygieneKit = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const { count } = req.body;
    const cart = await this.cartService.updateHygieneKit(userId, count);
    return ApiResponse.success(res, cart, 'Hygiene kit updated successfully');
  };

  syncCart = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const { items } = req.body;
    const cart = await this.cartService.syncCart(userId, items);
    return ApiResponse.success(res, cart, 'Cart synchronized successfully');
  };

  updatePackageSelections = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const { lineId } = req.params;
    const { selectedServices } = req.body;
    const cart = await this.cartService.updatePackageSelections(userId, lineId, selectedServices);
    return ApiResponse.success(res, cart, 'Package selections updated successfully');
  };

  updateRecipient = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const { lineId } = req.params;
    const { forMemberId } = req.body;
    const cart = await this.cartService.updateRecipient(userId, lineId, forMemberId);
    return ApiResponse.success(res, cart, 'Recipient updated successfully');
  };

  bookForOthers = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const cart = await this.cartService.bookForOthers(userId, req.body);
    return ApiResponse.success(res, cart, 'Booking recipient set successfully');
  };
}
