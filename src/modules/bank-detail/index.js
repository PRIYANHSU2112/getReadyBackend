import { BankDetailModel } from './bank-detail.model.js';
import { BankDetailRepository } from './bank-detail.repository.js';
import { BankDetailService } from './bank-detail.service.js';
import { BankDetailController } from './bank-detail.controller.js';
import { createBankDetailRoutes } from './bank-detail.routes.js';
import { bankDetailDocs } from './bank-detail.docs.js';

/**
 * Bank Detail module factory — beautician payout details + admin verification.
 * @param {{
 *   authenticate: Function,
 *   checkPermission: Function,
 *   cacheService?: object|null,
 *   storageService?: object|null,
 *   beauticianProfileRepository: object,
 * }} deps
 */
export function createBankDetailModule({
  authenticate,
  checkPermission,
  cacheService = null,
  storageService = null,
  beauticianProfileRepository,
}) {
  const repository = new BankDetailRepository(BankDetailModel);
  const service = new BankDetailService(
    repository,
    beauticianProfileRepository,
    storageService,
    cacheService,
  );
  const controller = new BankDetailController(service);

  return {
    service,
    routes: createBankDetailRoutes(controller, { authenticate, checkPermission }),
    docs: bankDetailDocs,
  };
}

export { bankDetailDocs } from './bank-detail.docs.js';
export { BankDetailModel } from './bank-detail.model.js';
export { BankDetailRepository } from './bank-detail.repository.js';
export { bankDetailValidator } from './bank-detail.validation.js';
