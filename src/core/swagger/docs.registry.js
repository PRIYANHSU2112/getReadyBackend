import { userDocs } from '../../modules/user/user.docs.js';
import { authDocs } from '../../modules/auth/auth.docs.js';
import { notificationDocs } from '../../modules/notification/notification.docs.js';
import { rbacDocs } from '../../modules/rbac/rbac.docs.js';
import { addressDocs } from '../../modules/address/address.docs.js';
import { bannerDocs } from '../../modules/banner/banner.docs.js';
import { filterDocs } from '../../modules/filter/filter.docs.js';
import { categoryDocs } from '../../modules/category/category.docs.js';
import { serviceDocs } from '../../modules/service/service.docs.js';
import { packageDocs } from '../../modules/package/package.docs.js';
import { skillDocs } from '../../modules/skill/skill.docs.js';
import { beauticianProfileDocs } from '../../modules/beautician-profile/beautician-profile.docs.js';
import { bankDetailDocs } from '../../modules/bank-detail/bank-detail.docs.js';
import { walletDocs } from '../../modules/wallet/wallet.docs.js';

import { cartDocs } from '../../modules/cart/cart.docs.js';
import { memberDocs } from '../../modules/member/member.docs.js';
import { slotDocs } from '../../modules/slot/slot.docs.js';
import { blogDocs } from '../../modules/blog/blog.docs.js';
import { hygieneKitDocs } from '../../modules/hygiene-kit/hygiene-kit.docs.js';
import { healthDocs } from './health.docs.js';

/**
 * Central Swagger docs registry.
 * Add a module's docs here when creating a new feature module.
 */
export const swaggerDocs = [
  healthDocs,
  authDocs,
  userDocs,
  notificationDocs,
  rbacDocs,
  addressDocs,
  bannerDocs,
  filterDocs,
  categoryDocs,
  serviceDocs,
  packageDocs,
  skillDocs,
  beauticianProfileDocs,
  bankDetailDocs,
  walletDocs,
  memberDocs,
  cartDocs,
  slotDocs,
  blogDocs,
  hygieneKitDocs,
];


