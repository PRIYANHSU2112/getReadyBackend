export const BEAUTICIANS_INDEX = 'beauticians-v1';

export const beauticiansIndexDefinition = {
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
      userId: { type: 'keyword' },
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
      bio: { type: 'text' },
      services: {
        type: 'text',
        fields: {
          keyword: { type: 'keyword' },
        },
      },
      serviceIds: { type: 'keyword' },
      rating: { type: 'half_float' },
      ratingCount: { type: 'integer' },
      price: { type: 'float' },
      location: { type: 'geo_point' },
      city: { type: 'keyword' },
      address: { type: 'text' },
      operationalStatus: { type: 'keyword' },
      isAvailable: { type: 'boolean' },
      isActive: { type: 'boolean' },
      experienceYears: { type: 'integer' },
      avatarUrl: { type: 'keyword', index: false },
      updatedAt: { type: 'date' },
    },
  },
};
