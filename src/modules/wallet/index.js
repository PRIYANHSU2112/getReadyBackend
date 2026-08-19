import { WalletModel, WalletTransactionModel } from './wallet.model.js';
import { WalletRepository, WalletTransactionRepository } from './wallet.repository.js';
import { WalletService } from './wallet.service.js';
import { WalletController } from './wallet.controller.js';
import { createWalletRoutes } from './wallet.routes.js';
import { walletDocs } from './wallet.docs.js';

/**
 * Wallet module factory
 * @param {{
 *   authenticate: Function,
 *   cacheService?: object|null,
 *   config?: object,
 * }} deps
 */
export function createWalletModule({
  authenticate,
  cacheService = null,
  config = {},
}) {
  const walletRepository = new WalletRepository(WalletModel);
  const transactionRepository = new WalletTransactionRepository(WalletTransactionModel);
  const service = new WalletService(
    walletRepository,
    transactionRepository,
    cacheService,
    config,
  );
  const controller = new WalletController(service);

  return {
    service,
    repository: walletRepository,
    transactionRepository,
    routes: createWalletRoutes(controller, { authenticate }),
    docs: walletDocs,
  };
}

export { walletDocs } from './wallet.docs.js';
export { walletValidator } from './wallet.validation.js';
export { WalletModel, WalletTransactionModel } from './wallet.model.js';
export {
  WalletTransactionType,
  WalletTransactionCategory,
  WalletTransactionStatus,
} from './wallet.enum.js';
export { toWalletDto, toWalletTransactionDto } from './wallet.mapper.js';
