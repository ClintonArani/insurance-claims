import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { Client } from '../src/models/Client';
import { Policy } from '../src/models/Policy';

describe('Policy API Tests', () => {
  let testClientId: string;
  let testPolicyId: string;

  beforeAll(async () => {
    // Connect to test database
    const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/insurance_claims_test';
    await mongoose.connect(url);
  });

  beforeEach(async () => {
    // Clean up and create a test client before each test
    await Client.deleteMany({});
    await Policy.deleteMany({});

    // Create a test client
    const clientData = {
      name: 'Policy Test Client',
      email: 'policy.test@example.com',
      dateOfBirth: '1990-01-01',
      address: '123 Test St'
    };

    const clientResponse = await request(app)
      .post('/api/clients')
      .send(clientData);

    testClientId = clientResponse.body.data.clientId;
  });

  afterAll(async () => {
    // Clean up and disconnect
    await Client.deleteMany({});
    await Policy.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/policies', () => {
    it('should create a new policy successfully', async () => {
      const policyData = {
        clientId: testClientId,
        policyNumber: 'POL001',
        policyType: 'life',
        startDate: '2024-01-01',
        endDate: '2025-01-01',
        premiumAmount: 500,
        coverageAmount: 100000,
        status: 'active'
      };

      const response = await request(app)
        .post('/api/policies')
        .send(policyData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Policy created successfully');
      expect(response.body.data).toHaveProperty('policyId');
      expect(response.body.data.policyNumber).toBe(policyData.policyNumber);
      expect(response.body.data.policyType).toBe(policyData.policyType);
      expect(response.body.data.premiumAmount).toBe(policyData.premiumAmount);
      expect(response.body.data.coverageAmount).toBe(policyData.coverageAmount);
      
      testPolicyId = response.body.data.policyId;
    });

    it('should return 404 if client does not exist', async () => {
      const policyData = {
        clientId: 'nonexistent-client-id',
        policyNumber: 'POL002',
        policyType: 'health',
        startDate: '2024-01-01',
        endDate: '2025-01-01',
        premiumAmount: 300,
        coverageAmount: 50000
      };

      const response = await request(app)
        .post('/api/policies')
        .send(policyData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Client not found');
    });

    it('should return 400 for duplicate policy number', async () => {
      // Create first policy
      const policyData = {
        clientId: testClientId,
        policyNumber: 'POL001',
        policyType: 'life',
        startDate: '2024-01-01',
        endDate: '2025-01-01',
        premiumAmount: 500,
        coverageAmount: 100000
      };

      await request(app)
        .post('/api/policies')
        .send(policyData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/policies')
        .send(policyData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Policy number must be unique');
    });

    it('should return 400 for invalid policy type', async () => {
      const policyData = {
        clientId: testClientId,
        policyNumber: 'POL003',
        policyType: 'invalid-type',
        startDate: '2024-01-01',
        endDate: '2025-01-01',
        premiumAmount: 500,
        coverageAmount: 100000
      };

      const response = await request(app)
        .post('/api/policies')
        .send(policyData)
        .expect(400);

      expect(response.body.success).toBe(false);
      
      // Check if errors array exists (from validation middleware)
      if (response.body.errors) {
        expect(response.body.errors[0].toLowerCase()).toContain('policy type');
      } else {
        // Or check the message
        expect(response.body.message.toLowerCase()).toContain('policy type');
      }
    });

    it('should return 400 when end date is before start date', async () => {
      const policyData = {
        clientId: testClientId,
        policyNumber: 'POL004',
        policyType: 'auto',
        startDate: '2025-01-01',
        endDate: '2024-01-01', // End date before start date
        premiumAmount: 400,
        coverageAmount: 30000
      };

      const response = await request(app)
        .post('/api/policies')
        .send(policyData)
        .expect(400);

      expect(response.body.success).toBe(false);
      
      // Check various possible error message formats
      const errorMessage = response.body.message || '';
      const errorMessages = response.body.errors || [];
      
      const hasExpectedError = 
        errorMessage.includes('End date must be after start date') ||
        errorMessage.includes('end date') ||
        errorMessage.toLowerCase().includes('end date must be after') ||
        errorMessage.toLowerCase().includes('end date must be greater') ||
        errorMessage.toLowerCase().includes('end date must be later') ||
        errorMessages.some((msg: string) => 
          msg.includes('End date must be after start date') ||
          msg.toLowerCase().includes('end date must be after')
        );
      
      expect(hasExpectedError).toBe(true);
    });

    it('should return 400 for negative premium amount', async () => {
      const policyData = {
        clientId: testClientId,
        policyNumber: 'POL005',
        policyType: 'home',
        startDate: '2024-01-01',
        endDate: '2025-01-01',
        premiumAmount: -100,
        coverageAmount: 200000
      };

      const response = await request(app)
        .post('/api/policies')
        .send(policyData)
        .expect(400);

      expect(response.body.success).toBe(false);
      
      if (response.body.errors) {
        expect(response.body.errors[0].toLowerCase()).toContain('premium');
      } else {
        expect(response.body.message.toLowerCase()).toContain('premium');
      }
    });

    it('should create policy with default status "active"', async () => {
      const policyData = {
        clientId: testClientId,
        policyNumber: 'POL006',
        policyType: 'life',
        startDate: '2024-01-01',
        endDate: '2025-01-01',
        premiumAmount: 600,
        coverageAmount: 150000
        // status not provided
      };

      const response = await request(app)
        .post('/api/policies')
        .send(policyData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('active');
    });

    it('should create policy with custom status', async () => {
      const policyData = {
        clientId: testClientId,
        policyNumber: 'POL007',
        policyType: 'health',
        startDate: '2024-01-01',
        endDate: '2025-01-01',
        premiumAmount: 350,
        coverageAmount: 75000,
        status: 'cancelled'
      };

      const response = await request(app)
        .post('/api/policies')
        .send(policyData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
    });
  });

  describe('GET /api/policies/:policyId', () => {
    it('should return a policy by policyId', async () => {
      // First create a policy
      const policyData = {
        clientId: testClientId,
        policyNumber: 'POL008',
        policyType: 'auto',
        startDate: '2024-01-01',
        endDate: '2025-01-01',
        premiumAmount: 450,
        coverageAmount: 40000
      };

      const createResponse = await request(app)
        .post('/api/policies')
        .send(policyData)
        .expect(201);

      const policyId = createResponse.body.data.policyId;

      const getResponse = await request(app)
        .get(`/api/policies/${policyId}`)
        .expect(200);

      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data.policyId).toBe(policyId);
      expect(getResponse.body.data.policyNumber).toBe(policyData.policyNumber);
      expect(getResponse.body.data.policyType).toBe(policyData.policyType);
    });

    it('should return 404 for non-existent policy', async () => {
      const response = await request(app)
        .get('/api/policies/nonexistent-policy-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('GET /api/policies/client/:clientId', () => {
    it('should return all policies for a client', async () => {
      // Create multiple policies for the client
      const policies = [
        {
          clientId: testClientId,
          policyNumber: 'POL009',
          policyType: 'life',
          startDate: '2024-01-01',
          endDate: '2025-01-01',
          premiumAmount: 500,
          coverageAmount: 100000
        },
        {
          clientId: testClientId,
          policyNumber: 'POL010',
          policyType: 'health',
          startDate: '2024-02-01',
          endDate: '2025-02-01',
          premiumAmount: 300,
          coverageAmount: 50000
        },
        {
          clientId: testClientId,
          policyNumber: 'POL011',
          policyType: 'auto',
          startDate: '2024-03-01',
          endDate: '2025-03-01',
          premiumAmount: 400,
          coverageAmount: 30000
        }
      ];

      for (const policy of policies) {
        await request(app)
          .post('/api/policies')
          .send(policy)
          .expect(201);
      }

      const response = await request(app)
        .get(`/api/policies/client/${testClientId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(3);
      expect(response.body.data).toHaveLength(3);
    });

    it('should return empty array for client with no policies', async () => {
      // Create a new client with no policies
      const newClientData = {
        name: 'No Policies Client',
        email: 'nopolicies@example.com',
        dateOfBirth: '1995-01-01',
        address: '456 No Policy St'
      };

      const clientResponse = await request(app)
        .post('/api/clients')
        .send(newClientData)
        .expect(201);

      const newClientId = clientResponse.body.data.clientId;

      const response = await request(app)
        .get(`/api/policies/client/${newClientId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(0);
      expect(response.body.data).toHaveLength(0);
    });

    it('should return 404 for non-existent client', async () => {
      const response = await request(app)
        .get('/api/policies/client/nonexistent-client-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Client not found');
    });
  });
});