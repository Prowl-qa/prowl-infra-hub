import { NextResponse } from 'next/server';

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Prowl Infra Hub API',
    description: 'API for discovering and downloading verified infrastructure automation playbooks.',
    version: '1.0.0',
  },
  servers: [
    { url: 'https://infra.prowlqa.dev', description: 'Production' },
    { url: 'http://localhost:3004', description: 'Local development' },
  ],
  paths: {
    '/api/playbooks': {
      get: {
        summary: 'Full playbook catalog',
        description: 'Returns all verified playbooks with full YAML content.',
        responses: {
          '200': {
            description: 'Playbook catalog',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    generatedAt: { type: 'string', format: 'date-time' },
                    playbooks: { type: 'array', items: { $ref: '#/components/schemas/PlaybookRecord' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/playbooks/search': {
      get: {
        summary: 'Search playbooks',
        description: 'Search and filter playbooks with server-side filtering.',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Full-text search query' },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category' },
          { name: 'tags', in: 'query', schema: { type: 'string' }, description: 'Comma-separated tags' },
          { name: 'tool', in: 'query', schema: { type: 'string', enum: ['ansible', 'terraform', 'docker-compose', 'k8s'] } },
          { name: 'cloud_provider', in: 'query', schema: { type: 'string', enum: ['aws', 'gcp', 'azure', 'agnostic'] } },
          { name: 'risk_level', in: 'query', schema: { type: 'string', enum: ['low', 'medium', 'high'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    query: { type: 'string' },
                    total: { type: 'integer' },
                    limit: { type: 'integer' },
                    offset: { type: 'integer' },
                    results: { type: 'array', items: { $ref: '#/components/schemas/PlaybookSummary' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/playbooks/{id}': {
      get: {
        summary: 'Get single playbook',
        description: 'Returns full metadata and YAML content for a single playbook by ID.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Playbook details with content' },
          '404': { description: 'Playbook not found' },
        },
      },
    },
    '/api/playbooks/file': {
      get: {
        summary: 'Download playbook YAML',
        description: 'Returns raw YAML content as a downloadable file.',
        parameters: [
          { name: 'path', in: 'query', required: true, schema: { type: 'string' }, description: 'Playbook file path (e.g. patching/rolling-os-update.yml)' },
          { name: 'preview', in: 'query', schema: { type: 'string', enum: ['1'] }, description: 'Set to 1 to skip download tracking' },
        ],
        responses: {
          '200': { description: 'YAML file content', content: { 'application/x-yaml': {} } },
          '400': { description: 'Missing path parameter' },
          '404': { description: 'Playbook not found' },
        },
      },
    },
  },
  components: {
    schemas: {
      PlaybookSummary: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          tool: { type: 'string' },
          cloud_provider: { type: 'string' },
          os_family: { type: 'string' },
          risk_level: { type: 'string' },
          compliance_tags: { type: 'array', items: { type: 'string' } },
          taskCount: { type: 'integer' },
          downloadUrl: { type: 'string' },
        },
      },
      PlaybookRecord: {
        allOf: [
          { $ref: '#/components/schemas/PlaybookSummary' },
          {
            type: 'object',
            properties: {
              content: { type: 'string' },
              updatedAt: { type: 'string', format: 'date-time' },
              isVerified: { type: 'boolean' },
            },
          },
        ],
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
    },
  });
}
