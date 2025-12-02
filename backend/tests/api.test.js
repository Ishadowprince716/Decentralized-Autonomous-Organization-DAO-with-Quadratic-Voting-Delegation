const request = require('supertest');
const express = require('express');

// Mock app setup for testing
function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // Mock routes for testing
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });
  
  app.get('/api/proposals', (req, res) => {
    res.json({
      success: true,
      proposals: [
        {
          id: 1,
          title: 'Test Proposal',
          description: 'This is a test proposal',
          status: 'active',
          forVotes: 100,
          againstVotes: 50,
        },
      ],
    });
  });
  
  app.post('/api/proposals', (req, res) => {
    const { title, description, votingPeriod } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Title and description are required',
      });
    }
    
    res.status(201).json({
      success: true,
      proposal: {
        id: 2,
        title,
        description,
        votingPeriod: votingPeriod || 100,
        status: 'active',
      },
    });
  });
  
  app.get('/api/proposals/:id', (req, res) => {
    const { id } = req.params;
    
    if (id === '999') {
      return res.status(404).json({
        success: false,
        error: 'Proposal not found',
      });
    }
    
    res.json({
      success: true,
      proposal: {
        id: parseInt(id),
        title: 'Test Proposal',
        description: 'This is a test proposal',
        status: 'active',
      },
    });
  });
  
  app.post('/api/votes', (req, res) => {
    const { proposalId, support, voterAddress } = req.body;
    
    if (!proposalId || support === undefined || !voterAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }
    
    res.status(201).json({
      success: true,
      vote: {
        proposalId,
        support,
        voterAddress,
        timestamp: new Date().toISOString(),
      },
    });
  });
  
  app.get('/api/members', (req, res) => {
    res.json({
      success: true,
      members: [
        {
          address: '0x1234567890123456789012345678901234567890',
          stake: '100',
          delegatedWeight: '10',
          joinedAt: new Date().toISOString(),
        },
      ],
      totalMembers: 1,
    });
  });
  
  app.get('/api/delegates/:address', (req, res) => {
    const { address } = req.params;
    
    res.json({
      success: true,
      delegate: {
        address,
        totalWeight: '50',
        delegators: ['0xabc...', '0xdef...'],
      },
    });
  });
  
  return app;
}

describe('Backend API Tests', () => {
  let app;
  
  beforeEach(() => {
    app = createTestApp();
  });
  
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
  
  describe('GET /api/proposals', () => {
    it('should return list of proposals', async () => {
      const response = await request(app)
        .get('/api/proposals')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('proposals');
      expect(Array.isArray(response.body.proposals)).toBe(true);
    });
    
    it('should return proposals with correct structure', async () => {
      const response = await request(app)
        .get('/api/proposals')
        .expect(200);
      
      const proposal = response.body.proposals[0];
      expect(proposal).toHaveProperty('id');
      expect(proposal).toHaveProperty('title');
      expect(proposal).toHaveProperty('description');
      expect(proposal).toHaveProperty('status');
      expect(proposal).toHaveProperty('forVotes');
      expect(proposal).toHaveProperty('againstVotes');
    });
  });
  
  describe('POST /api/proposals', () => {
    it('should create a new proposal', async () => {
      const newProposal = {
        title: 'New Proposal',
        description: 'This is a new proposal',
        votingPeriod: 200,
      };
      
      const response = await request(app)
        .post('/api/proposals')
        .send(newProposal)
        .expect(201);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.proposal).toHaveProperty('title', newProposal.title);
      expect(response.body.proposal).toHaveProperty('description', newProposal.description);
      expect(response.body.proposal).toHaveProperty('id');
    });
    
    it('should return 400 if title is missing', async () => {
      const invalidProposal = {
        description: 'Missing title',
      };
      
      const response = await request(app)
        .post('/api/proposals')
        .send(invalidProposal)
        .expect(400);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
    
    it('should return 400 if description is missing', async () => {
      const invalidProposal = {
        title: 'Missing description',
      };
      
      const response = await request(app)
        .post('/api/proposals')
        .send(invalidProposal)
        .expect(400);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('GET /api/proposals/:id', () => {
    it('should return a specific proposal', async () => {
      const response = await request(app)
        .get('/api/proposals/1')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.proposal).toHaveProperty('id', 1);
      expect(response.body.proposal).toHaveProperty('title');
      expect(response.body.proposal).toHaveProperty('description');
    });
    
    it('should return 404 for non-existent proposal', async () => {
      const response = await request(app)
        .get('/api/proposals/999')
        .expect(404);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Proposal not found');
    });
  });
  
  describe('POST /api/votes', () => {
    it('should cast a vote successfully', async () => {
      const vote = {
        proposalId: 1,
        support: true,
        voterAddress: '0x1234567890123456789012345678901234567890',
      };
      
      const response = await request(app)
        .post('/api/votes')
        .send(vote)
        .expect(201);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.vote).toHaveProperty('proposalId', vote.proposalId);
      expect(response.body.vote).toHaveProperty('support', vote.support);
      expect(response.body.vote).toHaveProperty('voterAddress', vote.voterAddress);
    });
    
    it('should return 400 if proposalId is missing', async () => {
      const invalidVote = {
        support: true,
        voterAddress: '0x1234567890123456789012345678901234567890',
      };
      
      const response = await request(app)
        .post('/api/votes')
        .send(invalidVote)
        .expect(400);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
    
    it('should return 400 if support is missing', async () => {
      const invalidVote = {
        proposalId: 1,
        voterAddress: '0x1234567890123456789012345678901234567890',
      };
      
      const response = await request(app)
        .post('/api/votes')
        .send(invalidVote)
        .expect(400);
      
      expect(response.body).toHaveProperty('success', false);
    });
  });
  
  describe('GET /api/members', () => {
    it('should return list of DAO members', async () => {
      const response = await request(app)
        .get('/api/members')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('members');
      expect(response.body).toHaveProperty('totalMembers');
      expect(Array.isArray(response.body.members)).toBe(true);
    });
    
    it('should return members with correct structure', async () => {
      const response = await request(app)
        .get('/api/members')
        .expect(200);
      
      const member = response.body.members[0];
      expect(member).toHaveProperty('address');
      expect(member).toHaveProperty('stake');
      expect(member).toHaveProperty('delegatedWeight');
      expect(member).toHaveProperty('joinedAt');
    });
  });
  
  describe('GET /api/delegates/:address', () => {
    it('should return delegate information', async () => {
      const testAddress = '0x1234567890123456789012345678901234567890';
      
      const response = await request(app)
        .get(`/api/delegates/${testAddress}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.delegate).toHaveProperty('address', testAddress);
      expect(response.body.delegate).toHaveProperty('totalWeight');
      expect(response.body.delegate).toHaveProperty('delegators');
    });
  });
});

// Rate limiting tests
describe('Rate Limiting', () => {
  let app;
  
  beforeEach(() => {
    app = createTestApp();
  });
  
  it('should handle multiple requests gracefully', async () => {
    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push(
        request(app)
          .get('/api/health')
          .expect(200)
      );
    }
    
    const responses = await Promise.all(requests);
    expect(responses).toHaveLength(10);
  });
});

// Error handling tests
describe('Error Handling', () => {
  let app;
  
  beforeEach(() => {
    app = createTestApp();
  });
  
  it('should return 404 for non-existent routes', async () => {
    await request(app)
      .get('/api/nonexistent')
      .expect(404);
  });
  
  it('should handle malformed JSON', async () => {
    await request(app)
      .post('/api/proposals')
      .set('Content-Type', 'application/json')
      .send('{ invalid json }')
      .expect(400);
  });
});

module.exports = { createTestApp };
