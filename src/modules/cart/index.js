import { CartModel } from './cart.model.js';
import { CartRepository } from './cart.repository.js';
import { CartService } from './cart.service.js';
import { CartController } from './cart.controller.js';
import { createCartRoutes } from './cart.routes.js';
import { cartDocs } from './cart.docs.js';
import {
  StubCouponProvider,
  StubPointsProvider,
  StubCashbackProvider,
  StubMembershipProvider,
} from './cart.benefit-providers.js';

/**
 * Cart module factory — auth-only (no RBAC permission checks).
 * @param {{
 *   authenticate: Function,
 *   cacheService?: object|null,
 *   serviceRepository: object,
 *   packageRepository: object,
 *   memberRepository?: object|null,
 *   pointsProvider?: object,
 *   couponProvider?: object,
 *   cashbackProvider?: object,
 *   membershipProvider?: object,
 * }} deps
 */
export function createCartModule({
  authenticate,
  cacheService = null,
  serviceRepository,
  packageRepository,
  memberRepository = null,
  pointsProvider = new StubPointsProvider(),
  couponProvider = new StubCouponProvider(),
  cashbackProvider = new StubCashbackProvider(),
  membershipProvider = new StubMembershipProvider(),
}) {
  const repository = new CartRepository(CartModel);
  const service = new CartService(
    repository,
    serviceRepository,
    packageRepository,
    cacheService,
    {
      pointsProvider,
      couponProvider,
      cashbackProvider,
      membershipProvider,
    },
    memberRepository,
  );
  const controller = new CartController(service);

  return {
    service,
    repository,
    routes: createCartRoutes(controller, { authenticate }),
    docs: cartDocs,
  };
}

export { cartDocs } from './cart.docs.js';
export { cartValidator } from './cart.validation.js';
export { CartModel } from './cart.model.js';
export { computeCartPricing, CartPricingEngine } from './cart.pricing-engine.js';
export { toCartDto } from './cart.mapper.js';
