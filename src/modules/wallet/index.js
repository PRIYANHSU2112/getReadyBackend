import { WalletModel, WalletTransactionModel } from './wallet.model.js';
import { LoyaltyRuleModel } from './loyalty-rule.model.js';
import {
  WalletRepository,
  WalletTransactionRepository,
  LoyaltyRuleRepository,
} from './wallet.repository.js';
import { WalletService } from './wallet.service.js';
import { WalletController } from './wallet.controller.js';
import { createWalletRoutes } from './wallet.routes.js';
import { walletDocs } from './wallet.docs.js';

/**
 * Wallet module factory
 * @param {{
 *   authenticate: Function,
 *   checkPermission?: Function|null,
 *   cacheService?: object|null,
 *   config?: object,
 *   walletModel?: import('mongoose').Model,
 *   transactionModel?: import('mongoose').Model,
 *   loyaltyRuleModel?: import('mongoose').Model,
 * }} deps
 */
export function createWalletModule({
  authenticate,
  checkPermission = null,
  cacheService = null,
  config = {},
  walletModel = WalletModel,
  transactionModel = WalletTransactionModel,
  loyaltyRuleModel = LoyaltyRuleModel,
}) {
  const walletRepository = new WalletRepository(walletModel);
  const transactionRepository = new WalletTransactionRepository(transactionModel);
  const loyaltyRuleRepository = new LoyaltyRuleRepository(loyaltyRuleModel);

  const service = new WalletService(
    walletRepository,
    transactionRepository,
    loyaltyRuleRepository,
    cacheService,
    config,
  );
  const controller = new WalletController(service);

  return {
    service,
    repository: walletRepository,
    transactionRepository,
    loyaltyRuleRepository,
    routes: createWalletRoutes(controller, { authenticate, checkPermission }),
    docs: walletDocs,
  };
}

export { walletDocs } from './wallet.docs.js';
export { walletValidator } from './wallet.validation.js';
export { WalletModel, WalletTransactionModel } from './wallet.model.js';
export { LoyaltyRuleModel } from './loyalty-rule.model.js';
export {
  WalletRepository,
  WalletTransactionRepository,
  LoyaltyRuleRepository,
} from './wallet.repository.js';
export {
  WalletTransactionType,
  WalletTransactionCategory,
  WalletTransactionStatus,
} from './wallet.enum.js';
export {
  toWalletDto,
  toWalletTransactionDto,
  toLoyaltyRuleDto,
} from './wallet.mapper.js';

