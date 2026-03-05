/* eslint-env jest */

// Mock dependencies
jest.mock('../../../utils/KnowledgeBase/db', () => ({
  prisma: {
    kb_files: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../../utils/helpers', () => ({
  getVectorDbClass: jest.fn(),
  getEmbeddingEngineSelection: jest.fn(),
}));

const { prisma } = require('../../../utils/KnowledgeBase/db');
const { getVectorDbClass, getEmbeddingEngineSelection } = require('../../../utils/helpers');
const { search, keywordSearch, semanticSearch } = require('../../../utils/KnowledgeBase/searcher');

describe('KnowledgeBase Searcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('keywordSearch', () => {
    it('should search files by keyword in name', async () => {
      const mockFiles = [
        { id: '1', file_name: 'test-report.pdf', category: 'reports', summary: null, keywords: '[]', indexed_at: new Date() },
        { id: '2', file_name: 'test-data.xlsx', category: 'data', summary: null, keywords: '[]', indexed_at: new Date() },
      ];

      prisma.kb_files.findMany.mockResolvedValue(mockFiles);

      const results = await keywordSearch('test');

      expect(prisma.kb_files.findMany).toHaveBeenCalled();
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('match_type', 'keyword');
    });

    it('should search files by keyword in summary', async () => {
      const mockFiles = [
        { id: '1', summary: 'This is a test document about AI', file_name: 'ai-doc.pdf', keywords: '[]', indexed_at: new Date() },
      ];

      prisma.kb_files.findMany.mockResolvedValue(mockFiles);

      const results = await keywordSearch('AI');

      expect(prisma.kb_files.findMany).toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });

    it('should filter by category when provided', async () => {
      const mockFiles = [
        { id: '1', file_name: 'report.pdf', category: 'reports', summary: null, keywords: '[]', indexed_at: new Date() },
      ];

      prisma.kb_files.findMany.mockResolvedValue(mockFiles);

      await keywordSearch('report', { category: 'reports' });

      const callArgs = prisma.kb_files.findMany.mock.calls[0][0];
      expect(callArgs.where.AND).toEqual(expect.arrayContaining([{ category: 'reports' }]));
    });
  });

  describe('semanticSearch', () => {
    it('should perform semantic search using vector database', async () => {
      const mockVectorDb = {
        hasNamespace: jest.fn().mockResolvedValue(true),
        performSimilaritySearch: jest.fn().mockResolvedValue({
          contextTexts: ['text1', 'text2'],
          sources: [
            { metadata: { url: 'file:///test1.pdf', title: 'Test 1' }, score: 0.9 },
            { metadata: { url: 'file:///test2.pdf', title: 'Test 2' }, score: 0.8 },
          ],
        }),
      };

      const mockEmbedder = {
        embedChunks: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
      };

      getVectorDbClass.mockReturnValue(mockVectorDb);
      getEmbeddingEngineSelection.mockReturnValue(mockEmbedder);

      prisma.kb_files.findMany.mockResolvedValue([
        { id: '1', file_path: '/test1.pdf', file_name: 'test1.pdf', category: null, sub_category: null, summary: null, keywords: '[]', status: 'embedded', indexed_at: new Date() },
      ]);

      const results = await semanticSearch('test query', { category: null, topN: 5 });

      expect(getVectorDbClass).toHaveBeenCalled();
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('search (hybrid)', () => {
    it('should return search results', async () => {
      prisma.kb_files.findMany.mockResolvedValue([]);
      
      const results = await search('test query', { mode: 'keyword' });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
