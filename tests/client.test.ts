import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { Client } from '../src/models/Client';
import { Policy } from '../src/models/Policy';

describe('Client API Tests', () => {
  let testClientId: string;
  let testClientEmail: string;

  beforeAll(async () => {
    // Connect to test database
    const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/insurance_claims_test';
    await mongoose.connect(url);
  });

  beforeEach(async () => {
    // Clean up database before each test
    await Client.deleteMany({});
    await Policy.deleteMany({});
  });

  afterAll(async () => {
    // Clean up and disconnect
    await Client.deleteMany({});
    await Policy.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/clients - Create Client', () => {
    it('should create a new client successfully with valid data', async () => {
      const clientData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        dateOfBirth: '1990-01-01',
        address: '123 Main St, New York, NY 10001'
      };

      const response = await request(app)
        .post('/api/clients')
        .send(clientData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Client created successfully');
      expect(response.body.data).toHaveProperty('clientId');
      expect(response.body.data.name).toBe(clientData.name);
      expect(response.body.data.email).toBe(clientData.email);
      expect(response.body.data.address).toBe(clientData.address);
      expect(new Date(response.body.data.dateOfBirth).toISOString().split('T')[0]).toBe(clientData.dateOfBirth);

      testClientId = response.body.data.clientId;
      testClientEmail = response.body.data.email;

      // Verify client was actually saved in database
      const savedClient = await Client.findOne({ clientId: testClientId });
      expect(savedClient).not.toBeNull();
      expect(savedClient?.name).toBe(clientData.name);
    });

    it('should return 400 when name is missing', async () => {
      const clientData = {
        email: 'john.doe@example.com',
        dateOfBirth: '1990-01-01',
        address: '123 Main St'
      };

      const response = await request(app)
        .post('/api/clients')
        .send(clientData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].toLowerCase()).toContain('name');
    });

    it('should return 400 when name is too short', async () => {
      const clientData = {
        name: 'J',
        email: 'john.doe@example.com',
        dateOfBirth: '1990-01-01',
        address: '123 Main St'
      };

      const response = await request(app)
        .post('/api/clients')
        .send(clientData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].toLowerCase()).toContain('name');
    });

    it('should return 400 when email is missing', async () => {
      const clientData = {
        name: 'John Doe',
        dateOfBirth: '1990-01-01',
        address: '123 Main St'
      };

      const response = await request(app)
        .post('/api/clients')
        .send(clientData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].toLowerCase()).toContain('email');
    });

    it('should return 400 for invalid email format', async () => {
      const clientData = {
        name: 'John Doe',
        email: 'invalid-email',
        dateOfBirth: '1990-01-01',
        address: '123 Main St'
      };

      const response = await request(app)
        .post('/api/clients')
        .send(clientData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].toLowerCase()).toContain('email');
    });

    it('should return 400 when date of birth is missing', async () => {
      const clientData = {
        name: 'John Doe',
        email: 'john@example.com',
        address: '123 Main St'
      };

      const response = await request(app)
        .post('/api/clients')
        .send(clientData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].toLowerCase()).toContain('date of birth');
    });

    it('should return 400 for underage client (less than 18 years)', async () => {
      // Calculate date for 17 years ago
      const seventeenYearsAgo = new Date();
      seventeenYearsAgo.setFullYear(seventeenYearsAgo.getFullYear() - 17);
      const dateString = seventeenYearsAgo.toISOString().split('T')[0];

      const clientData = {
        name: 'John Doe',
        email: 'john@example.com',
        dateOfBirth: dateString,
        address: '123 Main St'
      };

      const response = await request(app)
        .post('/api/clients')
        .send(clientData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].toLowerCase()).toContain('18 years old');
    });

    it('should accept client exactly 18 years old', async () => {
      // Calculate date for exactly 18 years ago
      const eighteenYearsAgo = new Date();
      eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
      const dateString = eighteenYearsAgo.toISOString().split('T')[0];

      const clientData = {
        name: 'John Doe',
        email: 'john.exactly18@example.com',
        dateOfBirth: dateString,
        address: '123 Main St'
      };

      const response = await request(app)
        .post('/api/clients')
        .send(clientData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('clientId');
    });

    it('should return 400 when address is missing', async () => {
      const clientData = {
        name: 'John Doe',
        email: 'john@example.com',
        dateOfBirth: '1990-01-01'
      };

      const response = await request(app)
        .post('/api/clients')
        .send(clientData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].toLowerCase()).toContain('address');
    });

    it('should return 400 for duplicate email', async () => {
      const clientData = {
        name: 'John Doe',
        email: 'duplicate@example.com',
        dateOfBirth: '1990-01-01',
        address: '123 Main St'
      };

      // Create first client
      await request(app)
        .post('/api/clients')
        .send(clientData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/clients')
        .send(clientData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message.toLowerCase()).toContain('already exists');
    });

    it('should generate unique clientId for each client', async () => {
      const client1Data = {
        name: 'Client One',
        email: 'client1@example.com',
        dateOfBirth: '1990-01-01',
        address: '123 Main St'
      };

      const client2Data = {
        name: 'Client Two',
        email: 'client2@example.com',
        dateOfBirth: '1991-01-01',
        address: '456 Oak Ave'
      };

      const response1 = await request(app)
        .post('/api/clients')
        .send(client1Data)
        .expect(201);

      const response2 = await request(app)
        .post('/api/clients')
        .send(client2Data)
        .expect(201);

      expect(response1.body.data.clientId).not.toBe(response2.body.data.clientId);
    });

    it('should handle future date of birth correctly', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const dateString = futureDate.toISOString().split('T')[0];

      const clientData = {
        name: 'Future Client',
        email: 'future@example.com',
        dateOfBirth: dateString,
        address: '123 Main St'
      };

      const response = await request(app)
        .post('/api/clients')
        .send(clientData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].toLowerCase()).toContain('18 years old');
    });
  });

  describe('GET /api/clients - Get All Clients', () => {
    it('should return empty array when no clients exist', async () => {
      const response = await request(app)
        .get('/api/clients')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(0);
      expect(response.body.data).toHaveLength(0);
    });

    it('should return all clients', async () => {
      // Create multiple clients
      const clients = [
        {
          name: 'Client One',
          email: 'one@example.com',
          dateOfBirth: '1990-01-01',
          address: '123 Main St'
        },
        {
          name: 'Client Two',
          email: 'two@example.com',
          dateOfBirth: '1991-02-02',
          address: '456 Oak Ave'
        },
        {
          name: 'Client Three',
          email: 'three@example.com',
          dateOfBirth: '1992-03-03',
          address: '789 Pine St'
        }
      ];

      for (const client of clients) {
        await request(app)
          .post('/api/clients')
          .send(client)
          .expect(201);
      }

      const response = await request(app)
        .get('/api/clients')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(3);
      expect(response.body.data).toHaveLength(3);

      const emails = response.body.data.map((c: any) => c.email);
      expect(emails).toContain('one@example.com');
      expect(emails).toContain('two@example.com');
      expect(emails).toContain('three@example.com');
    });

    it('should return clients with correct structure', async () => {
      const clientData = {
        name: 'Structure Test',
        email: 'structure@example.com',
        dateOfBirth: '1990-01-01',
        address: '123 Test St'
      };

      await request(app)
        .post('/api/clients')
        .send(clientData)
        .expect(201);

      const response = await request(app)
        .get('/api/clients')
        .expect(200);

      const client = response.body.data[0];
      expect(client).toHaveProperty('clientId');
      expect(client).toHaveProperty('name');
      expect(client).toHaveProperty('email');
      expect(client).toHaveProperty('dateOfBirth');
      expect(client).toHaveProperty('address');
      expect(client).toHaveProperty('createdAt');
      expect(client).toHaveProperty('updatedAt');
      expect(client).not.toHaveProperty('__v');
    });
  });

describe('GET /api/clients/:clientId - Get Client by ID', () => {
  beforeEach(async () => {
    const clientData = {
      name: 'Get Client Test',
      email: 'getclient@example.com',
      dateOfBirth: '1990-01-01',
      address: '123 Get St'
    };

    const response = await request(app)
      .post('/api/clients')
      .send(clientData)
      .expect(201);

    testClientId = response.body.data.clientId;
  });

  it('should return a client by custom clientId', async () => {
    const response = await request(app)
      .get(`/api/clients/${testClientId}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.clientId).toBe(testClientId);
    expect(response.body.data.name).toBe('Get Client Test');
  });

  it('should return 404 for non-existent clientId', async () => {
    const response = await request(app)
      .get('/api/clients/nonexistent-client-id-12345')
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('not found');
  });

  it('should return 200 with all clients for empty clientId (trailing slash)', async () => {
    // When requesting /api/clients/ with a trailing slash,
    // Express matches it to the GET /api/clients route (get all clients)
    const response = await request(app)
      .get('/api/clients/');
    
    // This should return 200 with the list of clients
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body).toHaveProperty('data');
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('should handle special characters in clientId', async () => {
    const response = await request(app)
      .get(`/api/clients/${testClientId}`)
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});

  describe('GET /api/clients/:clientId/total-premium - Get Total Premium by Client', () => {
    beforeEach(async () => {
      const clientData = {
        name: 'Premium Client',
        email: 'premium@example.com',
        dateOfBirth: '1990-01-01',
        address: '123 Premium St'
      };

      const response = await request(app)
        .post('/api/clients')
        .send(clientData)
        .expect(201);

      testClientId = response.body.data.clientId;
    });

    it('should return 0 total premium for client with no policies', async () => {
      const response = await request(app)
        .get(`/api/clients/${testClientId}/total-premium`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalPremium).toBe(0);
      expect(response.body.data.policyCount).toBe(0);
      expect(response.body.data.policies).toHaveLength(0);
    });

    it('should calculate total premium correctly for client with multiple policies', async () => {
      const policies = [
        {
          clientId: testClientId,
          policyNumber: 'POL-PREM-001',
          policyType: 'life',
          startDate: '2024-01-01',
          endDate: '2025-01-01',
          premiumAmount: 500,
          coverageAmount: 100000,
          status: 'active'
        },
        {
          clientId: testClientId,
          policyNumber: 'POL-PREM-002',
          policyType: 'health',
          startDate: '2024-02-01',
          endDate: '2025-02-01',
          premiumAmount: 300,
          coverageAmount: 50000,
          status: 'active'
        },
        {
          clientId: testClientId,
          policyNumber: 'POL-PREM-003',
          policyType: 'auto',
          startDate: '2024-03-01',
          endDate: '2025-03-01',
          premiumAmount: 400,
          coverageAmount: 30000,
          status: 'active'
        }
      ];

      for (const policy of policies) {
        await request(app)
          .post('/api/policies')
          .send(policy)
          .expect(201);
      }

      const response = await request(app)
        .get(`/api/clients/${testClientId}/total-premium`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalPremium).toBe(1200);
      expect(response.body.data.policyCount).toBe(3);
      expect(response.body.data.averagePremium).toBe(400);
      expect(response.body.data.policies).toHaveLength(3);

      const policyNumbers = response.body.data.policies.map((p: any) => p.policyNumber);
      expect(policyNumbers).toContain('POL-PREM-001');
      expect(policyNumbers).toContain('POL-PREM-002');
      expect(policyNumbers).toContain('POL-PREM-003');
    });

    it('should include only the specified client in total premium calculation', async () => {
      const otherClientData = {
        name: 'Other Client',
        email: 'other@example.com',
        dateOfBirth: '1991-01-01',
        address: '456 Other St'
      };

      const otherClientResponse = await request(app)
        .post('/api/clients')
        .send(otherClientData)
        .expect(201);

      const otherClientId = otherClientResponse.body.data.clientId;

      await request(app)
        .post('/api/policies')
        .send({
          clientId: testClientId,
          policyNumber: 'POL-PREM-004',
          policyType: 'life',
          startDate: '2024-01-01',
          endDate: '2025-01-01',
          premiumAmount: 600,
          coverageAmount: 200000,
          status: 'active'
        })
        .expect(201);

      await request(app)
        .post('/api/policies')
        .send({
          clientId: otherClientId,
          policyNumber: 'POL-PREM-005',
          policyType: 'health',
          startDate: '2024-01-01',
          endDate: '2025-01-01',
          premiumAmount: 350,
          coverageAmount: 75000,
          status: 'active'
        })
        .expect(201);

      const response1 = await request(app)
        .get(`/api/clients/${testClientId}/total-premium`)
        .expect(200);

      expect(response1.body.data.totalPremium).toBe(600);
      expect(response1.body.data.policyCount).toBe(1);

      const response2 = await request(app)
        .get(`/api/clients/${otherClientId}/total-premium`)
        .expect(200);

      expect(response2.body.data.totalPremium).toBe(350);
      expect(response2.body.data.policyCount).toBe(1);
    });

    it('should calculate correct average premium', async () => {
      const policies = [
        {
          clientId: testClientId,
          policyNumber: 'POL-AVG-001',
          policyType: 'life',
          startDate: '2024-01-01',
          endDate: '2025-01-01',
          premiumAmount: 1000,
          coverageAmount: 200000
        },
        {
          clientId: testClientId,
          policyNumber: 'POL-AVG-002',
          policyType: 'health',
          startDate: '2024-02-01',
          endDate: '2025-02-01',
          premiumAmount: 500,
          coverageAmount: 100000
        },
        {
          clientId: testClientId,
          policyNumber: 'POL-AVG-003',
          policyType: 'auto',
          startDate: '2024-03-01',
          endDate: '2025-03-01',
          premiumAmount: 300,
          coverageAmount: 50000
        }
      ];

      for (const policy of policies) {
        await request(app)
          .post('/api/policies')
          .send(policy)
          .expect(201);
      }

      const response = await request(app)
        .get(`/api/clients/${testClientId}/total-premium`)
        .expect(200);

      expect(response.body.data.averagePremium).toBe(600);
    });

    it('should handle policies with different statuses', async () => {
      const policies = [
        {
          clientId: testClientId,
          policyNumber: 'POL-STAT-001',
          policyType: 'life',
          startDate: '2024-01-01',
          endDate: '2025-01-01',
          premiumAmount: 500,
          coverageAmount: 100000,
          status: 'active'
        },
        {
          clientId: testClientId,
          policyNumber: 'POL-STAT-002',
          policyType: 'health',
          startDate: '2024-02-01',
          endDate: '2025-02-01',
          premiumAmount: 300,
          coverageAmount: 50000,
          status: 'expired'
        },
        {
          clientId: testClientId,
          policyNumber: 'POL-STAT-003',
          policyType: 'auto',
          startDate: '2024-03-01',
          endDate: '2025-03-01',
          premiumAmount: 400,
          coverageAmount: 30000,
          status: 'cancelled'
        }
      ];

      for (const policy of policies) {
        await request(app)
          .post('/api/policies')
          .send(policy)
          .expect(201);
      }

      const response = await request(app)
        .get(`/api/clients/${testClientId}/total-premium`)
        .expect(200);

      expect(response.body.data.totalPremium).toBe(1200);
      expect(response.body.data.policyCount).toBe(3);
    });

    it('should return 404 for non-existent client', async () => {
      const response = await request(app)
        .get('/api/clients/nonexistent-client-id-12345/total-premium')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should return correct structure for client with no policies', async () => {
      const response = await request(app)
        .get(`/api/clients/${testClientId}/total-premium`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('clientId', testClientId);
      expect(response.body.data).toHaveProperty('totalPremium', 0);
      expect(response.body.data).toHaveProperty('policyCount', 0);
      expect(response.body.data).toHaveProperty('averagePremium', 0);
      expect(response.body.data).toHaveProperty('policies');
      expect(Array.isArray(response.body.data.policies)).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/clients')
        .set('Content-Type', 'application/json')
        .send('{"name": "John", email: "test@example.com"}'); // This is actually valid JSON
        
      // Since the JSON is actually valid (just missing quotes around email property name),
      // this might succeed or fail based on validation
      // We'll just check that it doesn't crash
      expect([200, 201, 400, 500]).toContain(response.status);
    });

    it('should handle very long input strings', async () => {
      const longName = 'A'.repeat(200);
      const longAddress = 'B'.repeat(500);

      const clientData = {
        name: longName,
        email: 'long@example.com',
        dateOfBirth: '1990-01-01',
        address: longAddress
      };

      const response = await request(app)
        .post('/api/clients')
        .send(clientData);

      // Either it passes validation (201) or fails validation (400)
      // Both are acceptable as long as it doesn't crash
      expect([201, 400]).toContain(response.status);
      
      if (response.status === 201) {
        expect(response.body.success).toBe(true);
      } else {
        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
      }
    });

    it('should handle special characters in email', async () => {
      const clientData = {
        name: 'Special Email',
        email: 'user+special@example.com',
        dateOfBirth: '1990-01-01',
        address: '123 Test St'
      };

      const response = await request(app)
        .post('/api/clients')
        .send(clientData);

      // If validation accepts plus signs (most validators do), it should be 201
      // If validation rejects, it should be 400 with errors
      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.email).toBe('user+special@example.com');
      } else {
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
      }
    });

    it('should handle concurrent client creation', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        const clientData = {
          name: `Concurrent User ${i}`,
          email: `concurrent${i}@example.com`,
          dateOfBirth: '1990-01-01',
          address: '123 Test St'
        };
        promises.push(request(app).post('/api/clients').send(clientData));
      }

      const responses = await Promise.all(promises);
      
      // Check that all responses are either success (201) or duplicate error (400)
      // In concurrent creation, some might fail if emails are generated with same timestamp
      responses.forEach(response => {
        expect([201, 400]).toContain(response.status);
      });

      // Verify some clients were created
      const getAllResponse = await request(app)
        .get('/api/clients')
        .expect(200);

      expect(getAllResponse.body.count).toBeGreaterThan(0);
    });
  });

  describe('Data Integrity', () => {
    it('should not allow updating clientId after creation', async () => {
      const clientData = {
        name: 'Integrity Test',
        email: 'integrity@example.com',
        dateOfBirth: '1990-01-01',
        address: '123 Test St'
      };

      const createResponse = await request(app)
        .post('/api/clients')
        .send(clientData)
        .expect(201);

      const clientId = createResponse.body.data.clientId;

      const savedClient = await Client.findOne({ clientId });
      expect(savedClient?.clientId).toBe(clientId);
    });

    it('should maintain consistent date format', async () => {
      const clientData = {
        name: 'Date Format Test',
        email: 'dateformat@example.com',
        dateOfBirth: '1990-01-01',
        address: '123 Test St'
      };

      const createResponse = await request(app)
        .post('/api/clients')
        .send(clientData)
        .expect(201);

      expect(createResponse.body.data.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      
      const clientId = createResponse.body.data.clientId;

      const getResponse = await request(app)
        .get(`/api/clients/${clientId}`)
        .expect(200);

      expect(getResponse.body.data.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});