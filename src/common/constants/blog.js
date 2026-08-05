/** Public blog list/home/detail cache TTL (seconds). */
export const BLOG_CACHE_TTL_SECONDS = 30;

export const MAX_BLOG_TITLE_LENGTH = 200;
export const MAX_BLOG_SLUG_LENGTH = 220;
export const MAX_BLOG_EXCERPT_LENGTH = 400;
export const MAX_BLOG_CONTENT_LENGTH = 100_000;
export const MAX_BLOG_AUTHOR_NAME_LENGTH = 120;

export const DEFAULT_POPULAR_LIMIT = 10;
export const MAX_POPULAR_LIMIT = 50;

/** Words per minute for readTimeMin estimation. */
export const BLOG_WORDS_PER_MINUTE = 200;

export const BLOG_SORT_FIELDS = Object.freeze([
  'publishedAt',
  'likesCount',
  'createdAt',
  'title',
]);

export const DEFAULT_BLOG_SORT = '-publishedAt';

export const BLOG_LIST_SELECT =
  'title slug excerpt categoryId categoryName categorySlug coverImage thumbnail status isFeatured publishedAt readTimeMin likesCount viewCount authorName createdAt updatedAt';

export const BLOG_DETAIL_SELECT = `${BLOG_LIST_SELECT} content`;
