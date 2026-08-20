export const HYGIENE_KIT_CACHE_TTL_SECONDS = 3600; // 1 hour
export const DEFAULT_HYGIENE_KIT_PRICE = 49;
export const MIN_HYGIENE_KIT_PRICE = 0;
export const MAX_HYGIENE_KIT_PRICE = 10000;
export const DEFAULT_HYGIENE_KIT_MIN_QTY = 1;
export const DEFAULT_HYGIENE_KIT_MAX_QTY = 10;
export const MAX_HYGIENE_KIT_TITLE_LENGTH = 150;
export const MAX_HYGIENE_KIT_CODE_LENGTH = 50;
export const MAX_HYGIENE_KIT_DESCRIPTION_LENGTH = 2000;
export const MAX_HYGIENE_KIT_INCLUDED_ITEMS = 50;

export const HYGIENE_KIT_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'sortOrder',
  'price',
  'title',
];

export const DEFAULT_HYGIENE_KIT_SORT = 'sortOrder';

export const HYGIENE_KIT_PUBLIC_SELECT =
  'title code price description includedItems image isDefault isRequired minQuantity maxQuantity status sortOrder createdAt updatedAt';

export const HYGIENE_KIT_ADMIN_SELECT = '-__v';
