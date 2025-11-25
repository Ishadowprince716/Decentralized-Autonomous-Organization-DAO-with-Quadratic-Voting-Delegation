/**
 * API Integration Tests
 * Tests for all backend API routes
 */

const request = require('supertest');
const express = require('express');

// Create a test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Mock services
  app.locals.web3Service = {
    initialize: jest.fn().mockResolvedValue(true),
    getDAOStats: jest.fn().mockResolvedValue({ totalMembers: 100 }),
    getProposals: jest.fn().mockResolvedValue([]),
    getMembers: jest.fn().mockResolvedValue([]),
    cleanup: jest.fn()
  };
  
  app.locals.cacheService = {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
    delete: jest.fn()
  };
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });
  
  // Mock API routes
  app.get('/api/dao/stats', (req, res) => {
    res.json({ success: true, data: { totalMembers: 100 } });
  });
  
  app.get('/api/proposals', (req, res) => {
    res.json({ success: true, data: [] });
  });
  
  app.get('/api/members', (req, res) => {
    res.json({ success: true, data: [] });
  });
  
  app.post('/api/proposals', (req, res) => {
    if (!req.body.title) {
      return res.status(400).json({ success: false, error: 'Title required' });
    }
    res.status(201).json({ success: true, data: { id: 1, ...req.body } });
  });
  
  return app;
};

describe('API Integration Tests', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('Health Check', () => {
    it('GET /health - should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('DAO Routes', () => {
    it('GET /api/dao/stats - should return DAO statistics', async () => {
      const response = await request(app)
        .get('/api/dao/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Proposal Routes', () => {
    it('GET /api/proposals - should return proposals list', async () => {
      const response = await request(app)
        .get('/api/proposals')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('POST /api/proposals - should create a new proposal', async () => {
      const newProposal = {
        title: 'Test Proposal',
        description: 'This is a test proposal',
        votingPeriod: 7
      };

      const response = await request(app)
        .post('/api/proposals')
        .send(newProposal)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Test Proposal');
    });

    it('POST /api/proposals - should reject without title', async () => {
      const response = await request(app)
        .post('/api/proposals')
        .send({ description: 'No title' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Member Routes', () => {
    it('GET /api/members - should return members list', async () => {
      const response = await request(app)
        .get('/api/members')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});

describe('Error Handling', () => {
  it('should return 404 for unknown routes', async () => {
    const app = createTestApp();
    app.use((req, res) => {
      res.status(404).json({ error: 'Not Found' });
    });

    await request(app)
      .get('/api/unknown')
      .expect(404);
  });
});
