export const SERVICES_INDEX = 'services-v1';

export const servicesIndexDefinition = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
    analysis: {
      analyzer: {
        autocomplete_analyzer: {
          type: 'custom',
          tokenizer: 'edge_ngram_tokenizer',
          filter: ['lowercase'],
        },
        autocomplete_search: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase'],
        },
      },
      tokenizer: {
        edge_ngram_tokenizer: {
          type: 'edge_ngram',
          min_gram: 2,
          max_gram: 15,
          token_chars: ['letter', 'digit'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      name: {
        type: 'text',
        analyzer: 'standard',
        fields: {
          autocomplete: {
            type: 'text',
            analyzer: 'autocomplete_analyzer',
            search_analyzer: 'autocomplete_search',
          },
          keyword: { type: 'keyword' },
        },
      },
      category: {
        type: 'text',
        fields: {
          keyword: { type: 'keyword' },
        },
      },
      categoryId: { type: 'keyword' },
      description: { type: 'text' },
      price: { type: 'float' },
      discountedPrice: { type: 'float' },
      duration: { type: 'integer' },
      rating: { type: 'half_float' },
      ratingCount: { type: 'integer' },
      isActive: { type: 'boolean' },
      status: { type: 'keyword' },
      gender: { type: 'keyword' },
      bestseller: { type: 'boolean' },
      imageUrl: { type: 'keyword', index: false },
      badges: { type: 'keyword' },
      updatedAt: { type: 'date' },
    },
  },
};
