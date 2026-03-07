import { Policy, IPolicy } from '../models/Policy';
import { Claim, IClaim } from '../models/Claim';
import { AppError } from '../middleware/errorHandler';

export class ClaimService {
  
  // Calculate disbursement amount based on claim and policy
   
  static calculateDisbursement(claimAmount: number, policy: IPolicy): number {
    let disbursementAmount = claimAmount;
    
    switch(policy.policyType) {
      case 'life':
        disbursementAmount = claimAmount;
        break;
      case 'health':
        disbursementAmount = claimAmount * 0.9; // 90% coverage
        break;
      case 'auto':
        disbursementAmount = claimAmount * 0.8; // 80% coverage
        break;
      case 'home':
        disbursementAmount = claimAmount * 0.85; // 85% coverage
        break;
    }
    
    // Ensure we don't exceed coverage amount
    return Math.min(disbursementAmount, policy.coverageAmount);
  }

  
  //Validate if claim amount doesn't exceed policy coverage
  
  static async validateClaimAmount(policyId: string, claimAmount: number): Promise<IPolicy> {
    const policy = await Policy.findOne({ policyId });
    
    if (!policy) {
      throw new AppError('Policy not found', 404);
    }

    if (claimAmount > policy.coverageAmount) {
      throw new AppError(
        `Claim amount (${claimAmount}) exceeds policy coverage amount (${policy.coverageAmount})`,
        400
      );
    }

    return policy;
  }

  
  // Process claim - approve or reject based on business rules
  static async processClaim(claimId: string, decision: 'approved' | 'rejected'): Promise<IClaim> {
    const claim = await Claim.findOne({ claimId });
    
    if (!claim) {
      throw new AppError('Claim not found', 404);
    }

    if (claim.status !== 'submitted') {
      throw new AppError(`Claim cannot be processed as it is already ${claim.status}`, 400);
    }

    const policy = await Policy.findOne({ policyId: claim.policyId });
    
    if (!policy) {
      throw new AppError('Associated policy not found', 404);
    }

    if (decision === 'approved') {
      // Check if policy is active
      if (policy.status !== 'active') {
        throw new AppError(
          `Claim cannot be approved because policy is ${policy.status}`,
          400
        );
      }

      // Check if policy is still valid
      const currentDate = new Date();
      if (currentDate > policy.endDate) {
        throw new AppError('Claim cannot be approved because policy has expired', 400);
      }

      const disbursementAmount = this.calculateDisbursement(claim.claimAmount, policy);

      claim.status = 'approved';
      claim.disbursementAmount = disbursementAmount;
      claim.processedAt = new Date();
    } else {
      claim.status = 'rejected';
      claim.processedAt = new Date();
    }

    await claim.save();
    return claim;
  }
}