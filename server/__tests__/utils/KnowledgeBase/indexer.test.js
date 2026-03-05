/* eslint-env jest */

// Mock the Prisma client
jest.mock('../../../utils/KnowledgeBase/db', () => ({
  prisma: {
    kb_files: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    kb_operations: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    system_settings: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const { prisma } = require('../../../utils/KnowledgeBase/db');
const { KBIndexer } = require('../../../utils/KnowledgeBase/indexer');

describe('KnowledgeBase Indexer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('upsertFile', () => {
    it('should create a new file when it does not exist', async () => {
      const testFile = {
        file_path: '/test/path/file.txt',
        file_name: 'file.txt',
        file_size: 1024,
      };

      prisma.kb_files.findUnique.mockResolvedValue(null);
      prisma.kb_files.create.mockResolvedValue({ id: 'test-id', ...testFile });

      const result = await KBIndexer.upsertFile(testFile);

      expect(prisma.kb_files.findUnique).toHaveBeenCalledWith({
        where: { file_path: testFile.file_path },
      });
      expect(prisma.kb_files.create).toHaveBeenCalled();
      expect(result).toBe('test-id');
    });

    it('should update an existing file when it exists', async () => {
      const testFile = {
        file_path: '/test/path/file.txt',
        file_name: 'file.txt',
        file_size: 2048,
      };

      prisma.kb_files.findUnique.mockResolvedValue({ id: 'existing-id' });
      prisma.kb_files.update.mockResolvedValue({ id: 'existing-id', ...testFile });

      const result = await KBIndexer.upsertFile(testFile);

      expect(prisma.kb_files.findUnique).toHaveBeenCalledWith({
        where: { file_path: testFile.file_path },
      });
      expect(prisma.kb_files.update).toHaveBeenCalled();
      expect(result).toBe('existing-id');
    });
  });

  describe('getFileByPath', () => {
    it('should return a file by path with parsed keywords', async () => {
      const testFile = {
        id: 'test-id',
        file_path: '/test/path/file.txt',
        file_name: 'file.txt',
        keywords: '["tag1", "tag2"]',
      };

      prisma.kb_files.findUnique.mockResolvedValue(testFile);

      const result = await KBIndexer.getFileByPath('/test/path/file.txt');

      expect(prisma.kb_files.findUnique).toHaveBeenCalledWith({
        where: { file_path: '/test/path/file.txt' },
      });
      expect(result.keywords).toEqual(['tag1', 'tag2']);
    });

    it('should return null when file does not exist', async () => {
      prisma.kb_files.findUnique.mockResolvedValue(null);

      const result = await KBIndexer.getFileByPath('/non/existent/file.txt');

      expect(result).toBeNull();
    });
  });

  describe('getAllFiles', () => {
    it('should return files with pagination', async () => {
      const mockFiles = [
        { id: '1', file_name: 'file1.txt', keywords: '[]' },
        { id: '2', file_name: 'file2.txt', keywords: '[]' },
      ];

      prisma.kb_files.findMany.mockResolvedValue(mockFiles);
      prisma.kb_files.count.mockResolvedValue(2);

      const result = await KBIndexer.getAllFiles({ limit: 10, page: 1 });

      expect(prisma.kb_files.findMany).toHaveBeenCalled();
      expect(prisma.kb_files.count).toHaveBeenCalled();
      expect(result.files).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter files by status', async () => {
      const mockFiles = [
        { id: '1', file_name: 'file1.txt', status: 'indexed', keywords: '[]' },
      ];

      prisma.kb_files.findMany.mockResolvedValue(mockFiles);
      prisma.kb_files.count.mockResolvedValue(1);

      await KBIndexer.getAllFiles({ status: 'indexed' });

      expect(prisma.kb_files.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'indexed' },
        })
      );
    });
  });

  describe('updateFileStatus', () => {
    it('should update file status', async () => {
      prisma.kb_files.update.mockResolvedValue({
        id: 'test-id',
        status: 'indexed',
      });

      await KBIndexer.updateFileStatus('test-id', 'indexed');

      expect(prisma.kb_files.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: expect.objectContaining({ status: 'indexed' }),
      });
    });
  });

  describe('logOperation', () => {
    it('should create an operation log', async () => {
      const operation = 'rename';
      const fileId = 'test-id';
      const oldValue = 'old.txt';
      const newValue = 'new.txt';

      prisma.kb_operations.create.mockResolvedValue({ id: 'op-id' });

      await KBIndexer.logOperation(operation, fileId, oldValue, newValue);

      expect(prisma.kb_operations.create).toHaveBeenCalled();
    });
  });

  describe('Config operations', () => {
    it('should get config value', async () => {
      prisma.system_settings.findUnique.mockResolvedValue({
        label: 'kb_test_key',
        value: 'test_value',
      });

      const result = await KBIndexer.getConfig('test_key');

      expect(prisma.system_settings.findUnique).toHaveBeenCalledWith({
        where: { label: 'kb_test_key' },
      });
      expect(result).toBe('test_value');
    });

    it('should set config value', async () => {
      await KBIndexer.setConfig('test_key', 'test_value');

      expect(prisma.system_settings.upsert).toHaveBeenCalled();
    });
  });

  describe('Categories', () => {
    it('should get all categories', async () => {
      prisma.kb_files.findMany.mockResolvedValue([
        { category: 'cat1', sub_category: 'sub1' },
        { category: 'cat1', sub_category: 'sub2' },
        { category: 'cat2', sub_category: null },
      ]);

      const result = await KBIndexer.getCategories();

      expect(prisma.kb_files.findMany).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
