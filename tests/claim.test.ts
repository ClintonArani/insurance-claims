import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { Client } from '../src/models/Client';
import { Policy } from '../src/models/Policy';
import { Claim } from '../src/models/Claim';

describe('Claim API Tests', () => {
  let testClientId: string;
  let testPolicyId: string;
  let testClaimId: string;

  beforeAll(async () => {
    const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/insurance_claims_test';
    await mongoose.connect(url);
  });

  beforeEach(async () => {
    // Clean up database
    await Client.deleteMany({});
    await Policy.deleteMany({});
    await Claim.deleteMany({});

    // Create a test client
    const clientData = {
      name: 'Claim Test Client',
      email: 'claim.test@example.com',
      dateOfBirth: '1990-01-01',
      address: '123 Claim St'
    };

    const clientResponse = await request(app)
      .post('/api/clients')
      .send(clientData);
    
    expect(clientResponse.status).toBe(201);
    testClientId = clientResponse.body.data.clientId;

    // Create a test policy with FUTURE dates (not expired)
    const futureStartDate = new Date();
    futureStartDate.setDate(futureStartDate.getDate() + 1); // Tomorrow
    
    const futureEndDate = new Date();
    futureEndDate.setFullYear(futureEndDate.getFullYear() + 1); // 1 year from now

    const policyData = {
      clientId: testClientId,
      policyNumber: 'POL-CLM-001',
      policyType: 'health',
      startDate: futureStartDate.toISOString().split('T')[0],
      endDate: futureEndDate.toISOString().split('T')[0],
      premiumAmount: 300,
      coverageAmount: 50000,
      status: 'active'
    };

    const policyResponse = await request(app)
      .post('/api/policies')
      .send(policyData);
    
    expect(policyResponse.status).toBe(201);
    testPolicyId = policyResponse.body.data.policyId;
  });

  afterAll(async () => {
    await Client.deleteMany({});
    await Policy.deleteMany({});
    await Claim.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/claims', () => {
    it('should submit a claim successfully', async () => {
      const claimData = {
        policyId: testPolicyId,
        clientId: testClientId,
        claimAmount: 5000,
        description: 'Medical emergency hospitalization'
      };

      const response = await request(app)
        .post('/api/claims')
        .send(claimData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Claim submitted successfully');
      expect(response.body.data).toHaveProperty('claimId');
      expect(response.body.data.policyId).toBe(testPolicyId);
      expect(response.body.data.clientId).toBe(testClientId);
      expect(response.body.data.claimAmount).toBe(claimData.claimAmount);
      expect(response.body.data.status).toBe('submitted');
      expect(response.body.data.description).toBe(claimData.description);
      
      testClaimId = response.body.data.claimId;
    });

    it('should return 404 for non-existent policy', async () => {
      const claimData = {
        policyId: 'nonexistent-policy-id',
        clientId: testClientId,
        claimAmount: 5000,
        description: 'Test claim'
      };

      const response = await request(app)
        .post('/api/claims')
        .send(claimData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Policy not found');
    });

    it('should return 404 for non-existent client', async () => {
      const claimData = {
        policyId: testPolicyId,
        clientId: 'nonexistent-client-id',
        claimAmount: 5000,
        description: 'Test claim'
      };

      const response = await request(app)
        .post('/api/claims')
        .send(claimData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Client not found');
    });

    it('should return 400 when claim amount exceeds policy coverage', async () => {
      const claimData = {
        policyId: testPolicyId,
        clientId: testClientId,
        claimAmount: 100000, // Exceeds 50000 coverage
        description: 'Excessive claim'
      };

      const response = await request(app)
        .post('/api/claims')
        .send(claimData)
        .expect(400);

      expect(response.body.success).toBe(false);
      // Check for any error message related to coverage or amount
      const errorMsg = response.body.message || '';
      expect(
        errorMsg.includes('exceeds') || 
        errorMsg.includes('coverage') || 
        errorMsg.includes('amount')
      ).toBe(true);
    });

    it('should return 400 when policy does not belong to client', async () => {
      // Create another client
      const otherClientData = {
        name: 'Other Client',
        email: 'other@example.com',
        dateOfBirth: '1992-01-01',
        address: '456 Other St'
      };

      const otherClientResponse = await request(app)
        .post('/api/clients')
        .send(otherClientData)
        .expect(201);

      const otherClientId = otherClientResponse.body.data.clientId;

      const claimData = {
        policyId: testPolicyId,
        clientId: otherClientId,
        claimAmount: 5000,
        description: 'Unauthorized claim'
      };

      const response = await request(app)
        .post('/api/claims')
        .send(claimData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('does not belong');
    });

    it('should return 400 when policy is not active', async () => {
      // Create a cancelled policy
      const futureStartDate = new Date();
      futureStartDate.setDate(futureStartDate.getDate() + 1);
      
      const futureEndDate = new Date();
      futureEndDate.setFullYear(futureEndDate.getFullYear() + 1);

      const cancelledPolicyData = {
        clientId: testClientId,
        policyNumber: 'POL-CLM-002',
        policyType: 'auto',
        startDate: futureStartDate.toISOString().split('T')[0],
        endDate: futureEndDate.toISOString().split('T')[0],
        premiumAmount: 400,
        coverageAmount: 30000,
        status: 'cancelled'
      };

      const cancelledPolicyResponse = await request(app)
        .post('/api/policies')
        .send(cancelledPolicyData)
        .expect(201);

      const cancelledPolicyId = cancelledPolicyResponse.body.data.policyId;

      const claimData = {
        policyId: cancelledPolicyId,
        clientId: testClientId,
        claimAmount: 5000,
        description: 'Claim on cancelled policy'
      };

      const response = await request(app)
        .post('/api/claims')
        .send(claimData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('cancelled');
    });

    it('should return 400 when policy is expired', async () => {
      // Create an expired policy
      const pastStartDate = new Date();
      pastStartDate.setFullYear(pastStartDate.getFullYear() - 2);
      
      const pastEndDate = new Date();
      pastEndDate.setFullYear(pastEndDate.getFullYear() - 1);

      const expiredPolicyData = {
        clientId: testClientId,
        policyNumber: 'POL-CLM-003',
        policyType: 'home',
        startDate: pastStartDate.toISOString().split('T')[0],
        endDate: pastEndDate.toISOString().split('T')[0],
        premiumAmount: 600,
        coverageAmount: 200000,
        status: 'expired'
      };

      const expiredPolicyResponse = await request(app)
        .post('/api/policies')
        .send(expiredPolicyData)
        .expect(201);

      const expiredPolicyId = expiredPolicyResponse.body.data.policyId;

      const claimData = {
        policyId: expiredPolicyId,
        clientId: testClientId,
        claimAmount: 5000,
        description: 'Claim on expired policy'
      };

      const response = await request(app)
        .post('/api/claims')
        .send(claimData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('expired');
    });

    it('should return 400 for missing required fields', async () => {
      const invalidClaim = {
        policyId: testPolicyId,
        // missing clientId
        claimAmount: 5000
        // missing description
      };

      const response = await request(app)
        .post('/api/claims')
        .send(invalidClaim)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/claims/:claimId/process', () => {
    beforeEach(async () => {
      // Create a claim for processing tests
      const claimData = {
        policyId: testPolicyId,
        clientId: testClientId,
        claimAmount: 5000,
        description: 'Claim to be processed'
      };

      const claimResponse = await request(app)
        .post('/api/claims')
        .send(claimData)
        .expect(201);

      testClaimId = claimResponse.body.data.claimId;
    });

    it('should approve a claim successfully', async () => {
      const processData = {
        status: 'approved'
      };

      const response = await request(app)
        .post(`/api/claims/${testClaimId}/process`)
        .send(processData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Claim approved successfully');
      expect(response.body.data.status).toBe('approved');
      expect(response.body.data).toHaveProperty('disbursementAmount');
      expect(response.body.data).toHaveProperty('processedAt');
    });

    it('should reject a claim successfully', async () => {
      const processData = {
        status: 'rejected'
      };

      const response = await request(app)
        .post(`/api/claims/${testClaimId}/process`)
        .send(processData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Claim rejected successfully');
      expect(response.body.data.status).toBe('rejected');
      expect(response.body.data).toHaveProperty('processedAt');
    });

    it('should return 404 for non-existent claim', async () => {
      const processData = {
        status: 'approved'
      };

      const response = await request(app)
        .post('/api/claims/nonexistent-claim-id/process')
        .send(processData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Claim not found');
    });

    it('should return 400 for invalid status value', async () => {
      const processData = {
        status: 'invalid-status'
      };

      const response = await request(app)
        .post(`/api/claims/${testClaimId}/process`)
        .send(processData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 when processing already processed claim', async () => {
      // First approve the claim
      await request(app)
        .post(`/api/claims/${testClaimId}/process`)
        .send({ status: 'approved' })
        .expect(200);

      // Try to process again
      const response = await request(app)
        .post(`/api/claims/${testClaimId}/process`)
        .send({ status: 'rejected' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already approved');
    });

    it('should calculate correct disbursement amount for approved claim', async () => {
      const processData = {
        status: 'approved'
      };

      const response = await request(app)
        .post(`/api/claims/${testClaimId}/process`)
        .send(processData)
        .expect(200);

      // Health insurance should be 90% of claim amount (5000 * 0.9 = 4500)
      expect(response.body.data.disbursementAmount).toBe(4500);
    });
  });

  describe('GET /api/claims/client/:clientId', () => {
    beforeEach(async () => {
      // Create multiple claims with different statuses
      const claims = [
        {
          policyId: testPolicyId,
          clientId: testClientId,
          claimAmount: 1000,
          description: 'Claim 1'
        },
        {
          policyId: testPolicyId,
          clientId: testClientId,
          claimAmount: 2000,
          description: 'Claim 2'
        },
        {
          policyId: testPolicyId,
          clientId: testClientId,
          claimAmount: 3000,
          description: 'Claim 3'
        }
      ];

      const claimIds = [];
      for (const claim of claims) {
        const response = await request(app)
          .post('/api/claims')
          .send(claim)
          .expect(201);
        claimIds.push(response.body.data.claimId);
      }

      // Process claims to different statuses
      await request(app)
        .post(`/api/claims/${claimIds[0]}/process`)
        .send({ status: 'approved' })
        .expect(200);

      await request(app)
        .post(`/api/claims/${claimIds[1]}/process`)
        .send({ status: 'rejected' })
        .expect(200);

      // Third claim remains submitted
    });

    it('should return claims grouped by status', async () => {
      const response = await request(app)
        .get(`/api/claims/client/${testClientId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('statusGroups');
      expect(response.body.data.statusGroups).toHaveLength(3);
      expect(response.body.data.overallCount).toBe(3);
    });

    it('should return correct totals for each status group', async () => {
      const response = await request(app)
        .get(`/api/claims/client/${testClientId}`)
        .expect(200);

      const statusGroups = response.body.data.statusGroups;
      
      const submittedGroup = statusGroups.find((g: any) => g.status === 'submitted');
      const approvedGroup = statusGroups.find((g: any) => g.status === 'approved');
      const rejectedGroup = statusGroups.find((g: any) => g.status === 'rejected');

      expect(submittedGroup).toBeDefined();
      expect(approvedGroup).toBeDefined();
      expect(rejectedGroup).toBeDefined();
      expect(submittedGroup.count).toBe(1);
      expect(approvedGroup.count).toBe(1);
      expect(rejectedGroup.count).toBe(1);
    });

    it('should return 404 for non-existent client', async () => {
      const response = await request(app)
        .get('/api/claims/client/nonexistent-client-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Client not found');
    });

    it('should return empty groups for client with no claims', async () => {
      // Create a new client with no claims
      const newClientData = {
        name: 'No Claims Client',
        email: 'noclaims@example.com',
        dateOfBirth: '1995-01-01',
        address: '456 No Claims St'
      };

      const clientResponse = await request(app)
        .post('/api/clients')
        .send(newClientData)
        .expect(201);

      const newClientId = clientResponse.body.data.clientId;

      const response = await request(app)
        .get(`/api/claims/client/${newClientId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.statusGroups).toHaveLength(0);
      expect(response.body.data.overallCount).toBe(0);
    });
  });

  describe('GET /api/claims/:claimId', () => {
    it('should return a claim by claimId', async () => {
      const claimData = {
        policyId: testPolicyId,
        clientId: testClientId,
        claimAmount: 2500,
        description: 'Individual claim test'
      };

      const createResponse = await request(app)
        .post('/api/claims')
        .send(claimData)
        .expect(201);

      const claimId = createResponse.body.data.claimId;

      const getResponse = await request(app)
        .get(`/api/claims/${claimId}`)
        .expect(200);

      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data.claimId).toBe(claimId);
    });

    it('should return 404 for non-existent claim', async () => {
      const response = await request(app)
        .get('/api/claims/nonexistent-claim-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Claim not found');
    });
  });

  describe('GET /api/claims/policy-type-summary', () => {
    beforeEach(async () => {
      const policyTypes = ['life', 'health', 'auto', 'home'];
      
      for (let i = 0; i < policyTypes.length; i++) {
        // Create a policy for each type
        const futureStartDate = new Date();
        futureStartDate.setDate(futureStartDate.getDate() + 1);
        
        const futureEndDate = new Date();
        futureEndDate.setFullYear(futureEndDate.getFullYear() + 1);

        const policyData = {
          clientId: testClientId,
          policyNumber: `POL-SUM-00${i+1}`,
          policyType: policyTypes[i],
          startDate: futureStartDate.toISOString().split('T')[0],
          endDate: futureEndDate.toISOString().split('T')[0],
          premiumAmount: 500,
          coverageAmount: 100000,
          status: 'active'
        };

        const policyResponse = await request(app)
          .post('/api/policies')
          .send(policyData)
          .expect(201);

        const policyId = policyResponse.body.data.policyId;

        // Create a claim for each policy
        const claimData = {
          policyId,
          clientId: testClientId,
          claimAmount: 5000 * (i + 1),
          description: `Claim for ${policyTypes[i]} policy`
        };

        await request(app)
          .post('/api/claims')
          .send(claimData)
          .expect(201);
      }
    });

    it('should return claims grouped by policy type', async () => {
      const response = await request(app)
        .get('/api/claims/policy-type-summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('breakdown');
      expect(response.body.data.breakdown).toHaveLength(4);
    });

    it('should return correct totals for each policy type', async () => {
      const response = await request(app)
        .get('/api/claims/policy-type-summary')
        .expect(200);

      const breakdown = response.body.data.breakdown;
      
      breakdown.forEach((item: any) => {
        expect(item.totalClaims).toBe(1);
      });

      expect(response.body.data.summary.totalClaimsAcrossAllTypes).toBe(4);
    });

    it('should return empty breakdown when no claims exist', async () => {
      await Claim.deleteMany({});

      const response = await request(app)
        .get('/api/claims/policy-type-summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.breakdown).toHaveLength(0);
      expect(response.body.data.summary.totalClaimsAcrossAllTypes).toBe(0);
    });
  });
});