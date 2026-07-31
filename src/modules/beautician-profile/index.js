import { BeauticianProfileModel } from './beautician-profile.model.js';
import { WorkHistoryModel } from './work-history.model.js';
import { CertificateModel } from './certificate.model.js';
import {
  BeauticianProfileRepository,
  WorkHistoryRepository,
  CertificateRepository,
} from './beautician-profile.repository.js';
import { BeauticianProfileService } from './beautician-profile.service.js';
import { BeauticianProfileController } from './beautician-profile.controller.js';
import { createBeauticianProfileRoutes } from './beautician-profile.routes.js';
import { beauticianProfileDocs } from './beautician-profile.docs.js';

/**
 * Beautician Profile module factory — includes work history & certificates.
 * @param {{
 *   authenticate: Function,
 *   checkPermission: Function,
 *   cacheService?: object|null,
 *   storageService?: object|null,
 * }} deps
 */
export function createBeauticianProfileModule({
  authenticate,
  checkPermission,
  cacheService = null,
  storageService = null,
}) {
  const profileRepo = new BeauticianProfileRepository(BeauticianProfileModel);
  const workHistoryRepo = new WorkHistoryRepository(WorkHistoryModel);
  const certificateRepo = new CertificateRepository(CertificateModel);

  const service = new BeauticianProfileService(
    profileRepo,
    workHistoryRepo,
    certificateRepo,
    storageService,
    cacheService,
  );

  const controller = new BeauticianProfileController(service);

  return {
    profileRepo,
    service,
    routes: createBeauticianProfileRoutes(controller, { authenticate, checkPermission }),
    docs: beauticianProfileDocs,
  };
}

export { beauticianProfileDocs } from './beautician-profile.docs.js';
export { BeauticianProfileModel } from './beautician-profile.model.js';
export { WorkHistoryModel } from './work-history.model.js';
export { CertificateModel } from './certificate.model.js';
export { beauticianProfileValidator } from './beautician-profile.validation.js';
