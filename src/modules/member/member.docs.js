import {
  bearerSecurity,
  OBJECT_ID,
  paginationMeta,
  jsonBody,
  okResponse,
  createdResponse,
  noContentResponse,
  withErrors,
  successExample,
  pageQueryParams,
} from '../../core/swagger/swagger.common.js';
import { MemberRelationship, MemberSkinType } from '../../common/constants/enums.js';
import {
  MAX_MEMBERS_PER_USER,
  MAX_MEMBER_NAME_LENGTH,
  MAX_MEDICAL_NOTES_LENGTH,
  DEFAULT_MEMBER_SORT,
  MEMBER_SORT_FIELDS,
} from '../../common/constants/member.js';

const authOnly =
  '**Auth:** Bearer JWT required.\n\n**Access:** Own family/friends members only (no RBAC).';

const memberExample = {
  id: '64f0c2a1b4e1c2d3e4f50801',
  userId: OBJECT_ID,
  name: 'Navya Verma',
  relationship: MemberRelationship.SISTER,
  age: 28,
  phone: '+919876543210',
  avatarUrl: null,
  skinType: MemberSkinType.DRY,
  medicalNotes: 'Sensitive to fragrance',
  deletedAt: null,
  createdAt: '2026-08-05T05:00:00.000Z',
  updatedAt: '2026-08-05T05:00:00.000Z',
};

const createSchema = {
  type: 'object',
  required: ['name', 'relationship'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 2, maxLength: MAX_MEMBER_NAME_LENGTH, example: 'Navya Verma' },
    relationship: { type: 'string', enum: Object.values(MemberRelationship) },
    age: { type: 'integer', minimum: 1, maximum: 120, nullable: true, example: 28 },
    phone: { type: 'string', pattern: '^\\+?[1-9]\\d{7,14}$', nullable: true, example: '+919876543210' },
    avatarUrl: { type: 'string', format: 'uri', nullable: true },
    skinType: { type: 'string', enum: Object.values(MemberSkinType), nullable: true },
    medicalNotes: {
      type: 'string',
      maxLength: MAX_MEDICAL_NOTES_LENGTH,
      nullable: true,
      example: 'Allergic to fragrance',
    },
  },
  example: {
    name: 'Navya Verma',
    relationship: MemberRelationship.SISTER,
    age: 28,
    phone: '+919876543210',
    skinType: MemberSkinType.DRY,
    medicalNotes: 'Sensitive to fragrance',
  },
};

const sortEnum = MEMBER_SORT_FIELDS.flatMap((field) => [field, `-${field}`]);

export const memberDocs = {
  paths: {
    '/api/v1/members': {
      get: {
        tags: ['Members'],
        summary: 'List my family & friends members',
        description: `${authOnly}\n\nMax ${MAX_MEMBERS_PER_USER} active members per user.`,
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams({ page: 1, limit: 20 }),
          {
            name: 'sort',
            in: 'query',
            schema: { type: 'string', default: DEFAULT_MEMBER_SORT, enum: sortEnum },
          },
        ],
        responses: {
          ...okResponse(
            successExample([memberExample], {
              ...paginationMeta,
              total: 1,
            }),
          ),
          ...withErrors(401, 422, 500),
        },
      },
      post: {
        tags: ['Members'],
        summary: 'Add a family/friends member',
        description: authOnly,
        security: bearerSecurity,
        requestBody: jsonBody(createSchema, createSchema.example),
        responses: {
          ...createdResponse(successExample(memberExample)),
          ...withErrors(400, 401, 422, 500),
        },
      },
    },
    '/api/v1/members/{id}': {
      get: {
        tags: ['Members'],
        summary: 'Get member by id',
        description: authOnly,
        security: bearerSecurity,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
        ],
        responses: {
          ...okResponse(successExample(memberExample)),
          ...withErrors(401, 404, 422, 500),
        },
      },
      patch: {
        tags: ['Members'],
        summary: 'Update member',
        description: authOnly,
        security: bearerSecurity,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
        ],
        requestBody: jsonBody({
          type: 'object',
          additionalProperties: false,
          minProperties: 1,
          properties: createSchema.properties,
        }),
        responses: {
          ...okResponse(successExample(memberExample)),
          ...withErrors(401, 404, 422, 500),
        },
      },
      delete: {
        tags: ['Members'],
        summary: 'Soft-delete member',
        description: authOnly,
        security: bearerSecurity,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
        ],
        responses: {
          ...noContentResponse(),
          ...withErrors(401, 404, 500),
        },
      },
    },
  },
};
