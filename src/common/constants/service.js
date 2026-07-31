/**
 * Service-domain limits, cache TTL, public fields, and change-request diff keys.
 */
export const SERVICE_PUBLIC_CACHE_TTL_SECONDS = 300;

export const SERVICE_SORT_FIELDS = Object.freeze([
  'displayOrder',
  'name',
  'price',
  'discountedPrice',
  'ratingAvg',
  'createdAt',
  'updatedAt',
]);

export const DEFAULT_SERVICE_SORT = 'displayOrder';

export const MAX_SERVICE_NAME_LENGTH = 150;
export const MAX_SERVICE_SLUG_LENGTH = 160;
export const MAX_SERVICE_SHORT_DESCRIPTION_LENGTH = 300;
export const MAX_SERVICE_DESCRIPTION_LENGTH = 5000;
export const MAX_SERVICE_IMAGES = 5;
export const MAX_SERVICE_TAGS = 20;
export const MAX_SERVICE_INCLUSIONS = 50;
export const MAX_REJECTION_REASON_LENGTH = 500;
export const MIN_REJECTION_REASON_LENGTH = 5;

/** Fields beautician may include in a change request. */
export const SERVICE_CHANGE_DIFFABLE_FIELDS = Object.freeze([
  'name',
  'slug',
  'shortDescription',
  'description',
  'categoryId',
  'images',
  'thumbnail',
  'video',
  'durationMinMinutes',
  'durationMaxMinutes',
  'approxPrice',
  'badges',
  'isPopular',
  'isTrending',
  'isFeatured',
  'inclusions',
  'isHomeServiceAvailable',
  'homeVisitFee',
  'rewardPointsMultiplier',
  'tags',
  'gender',
  'displayOrder',
  'metadata',
]);

/** Pricing fields stripped for beautician. */
export const SERVICE_ADMIN_ONLY_PRICE_FIELDS = Object.freeze([
  'price',
  'discountType',
  'discountValue',
  'discountedPrice',
]);

export const SERVICE_PUBLIC_FIELDS = Object.freeze([
  'id',
  'name',
  'slug',
  'shortDescription',
  'description',
  'categoryId',
  'images',
  'thumbnail',
  'video',
  'durationMinMinutes',
  'durationMaxMinutes',
  'price',
  'discountType',
  'discountValue',
  'discountedPrice',
  'badges',
  'isPopular',
  'isTrending',
  'isFeatured',
  'inclusions',
  'isHomeServiceAvailable',
  'homeVisitFee',
  'rewardPointsMultiplier',
  'ratingAvg',
  'ratingCount',
  'tags',
  'gender',
  'displayOrder',
]);

export const SERVICE_DIFF_FIELD_META = Object.freeze({
  name: { label: 'Name', type: 'string' },
  slug: { label: 'Slug', type: 'string' },
  shortDescription: { label: 'Short description', type: 'string' },
  description: { label: 'Description', type: 'string' },
  categoryId: { label: 'Category', type: 'string' },
  images: { label: 'Images', type: 'image' },
  thumbnail: { label: 'Thumbnail', type: 'image' },
  video: { label: 'Video', type: 'object' },
  durationMinMinutes: { label: 'Duration min (minutes)', type: 'number' },
  durationMaxMinutes: { label: 'Duration max (minutes)', type: 'number' },
  approxPrice: { label: 'Approx price', type: 'number' },
  badges: { label: 'Badges', type: 'array' },
  isPopular: { label: 'Popular', type: 'boolean' },
  isTrending: { label: 'Trending', type: 'boolean' },
  isFeatured: { label: 'Featured', type: 'boolean' },
  inclusions: { label: 'Inclusions', type: 'array' },
  isHomeServiceAvailable: { label: 'Home service', type: 'boolean' },
  homeVisitFee: { label: 'Home visit fee', type: 'number' },
  rewardPointsMultiplier: { label: 'Reward points multiplier', type: 'number' },
  tags: { label: 'Tags', type: 'array' },
  gender: { label: 'Gender', type: 'string' },
  displayOrder: { label: 'Display order', type: 'number' },
  metadata: { label: 'Metadata', type: 'object' },
});
