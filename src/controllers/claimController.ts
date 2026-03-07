import { Request, Response, NextFunction } from 'express';
import { Claim } from '../models/Claim';
import { Policy } from '../models/Policy';
import { Client } from '../models/Client';
import { ClaimService } from '../services/claimService';
import { AppError } from '../middleware/errorHandler';

export const submitClaim = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { policyId, clientId, claimAmount, description } = req.body;

    // Validate required fields
    if (!policyId || !clientId || !claimAmount || !description) {
      return next(new AppError('Missing required fields: policyId, clientId, claimAmount, and description are required', 400));
    }

    // Check if policy exists
    const policy = await Policy.findOne({ policyId });
    if (!policy) {
      return next(new AppError('Policy not found', 404));
    }

    // Check if client exists
    const client = await Client.findOne({ clientId });
    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    // Verify policy belongs to client
    if (policy.clientId !== clientId) {
      return next(new AppError('This policy does not belong to the specified client', 400));
    }

    // Check if policy is active
    if (policy.status !== 'active') {
      return next(new AppError(`Cannot submit claim for ${policy.status} policy`, 400));
    }

    // Check if policy is still valid
    const currentDate = new Date();
    if (currentDate > policy.endDate) {
      return next(new AppError('Cannot submit claim for expired policy', 400));
    }

    // Validate claim amount doesn't exceed coverage
    if (claimAmount > policy.coverageAmount) {
      return next(new AppError(
        `Claim amount (${claimAmount}) exceeds policy coverage amount (${policy.coverageAmount})`,
        400
      ));
    }

    // Create the claim
    const claim = new Claim({
      policyId,
      clientId,
      claimAmount,
      description,
      status: 'submitted'
    });

    await claim.save();

    res.status(201).json({
      success: true,
      message: 'Claim submitted successfully',
      data: {
        claimId: claim.claimId,
        policyId: claim.policyId,
        clientId: claim.clientId,
        claimAmount: claim.claimAmount,
        status: claim.status,
        description: claim.description,
        claimDate: claim.claimDate
      }
    });
  } catch (error) {
    next(error);
  }
};

export const processClaim = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const claimId = req.params.claimId as string;
    const { status } = req.body;

    // Validate status
    if (!status || (status !== 'approved' && status !== 'rejected')) {
      return next(new AppError('Status must be either "approved" or "rejected"', 400));
    }

    // Find the claim
    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return next(new AppError('Claim not found', 404));
    }

    // Check if claim can be processed
    if (claim.status !== 'submitted') {
      return next(new AppError(`Claim cannot be processed as it is already ${claim.status}`, 400));
    }

    // Find the associated policy
    const policy = await Policy.findOne({ policyId: claim.policyId });
    if (!policy) {
      return next(new AppError('Associated policy not found', 404));
    }

    // Process based on decision
    if (status === 'approved') {
      // Check if policy is active
      if (policy.status !== 'active') {
        return next(new AppError(
          `Claim cannot be approved because policy is ${policy.status}`,
          400
        ));
      }

      // Check if policy is still valid
      const currentDate = new Date();
      if (currentDate > policy.endDate) {
        return next(new AppError('Claim cannot be approved because policy has expired', 400));
      }

      // Calculate disbursement amount
      const disbursementAmount = ClaimService.calculateDisbursement(claim.claimAmount, policy);

      claim.status = 'approved';
      claim.disbursementAmount = disbursementAmount;
      claim.processedAt = new Date();
    } else {
      claim.status = 'rejected';
      claim.processedAt = new Date();
    }

    await claim.save();

    res.status(200).json({
      success: true,
      message: `Claim ${status} successfully`,
      data: {
        claimId: claim.claimId,
        status: claim.status,
        disbursementAmount: claim.disbursementAmount,
        processedAt: claim.processedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getClientClaims = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const clientId = req.params.clientId as string;

    // Check if client exists
    const client = await Client.findOne({ clientId });
    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    // Aggregation pipeline to fetch and group claims by status
    const claims = await Claim.aggregate([
      {
        $match: { clientId: clientId }
      },
      {
        $lookup: {
          from: 'policies',
          localField: 'policyId',
          foreignField: 'policyId',
          as: 'policyDetails'
        }
      },
      {
        $unwind: {
          path: '$policyDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: '$status',
          claims: {
            $push: {
              claimId: '$claimId',
              policyId: '$policyId',
              policyType: '$policyDetails.policyType',
              claimDate: '$claimDate',
              claimAmount: '$claimAmount',
              status: '$status',
              description: '$description',
              disbursementAmount: '$disbursementAmount',
              processedAt: '$processedAt'
            }
          },
          totalAmount: { $sum: '$claimAmount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      },
      {
        $group: {
          _id: null,
          statusGroups: {
            $push: {
              status: '$_id',
              count: '$count',
              totalAmount: '$totalAmount',
              claims: '$claims'
            }
          },
          overallTotal: { $sum: '$totalAmount' },
          overallCount: { $sum: '$count' }
        }
      },
      {
        $project: {
          _id: 0,
          clientId: clientId,
          statusGroups: 1,
          overallTotal: 1,
          overallCount: 1
        }
      }
    ]);

    const result = claims.length > 0 ? claims[0] : {
      clientId,
      statusGroups: [],
      overallTotal: 0,
      overallCount: 0
    };

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getClaim = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const claimId = req.params.claimId as string;

    const claim = await Claim.findOne({ claimId });
    
    if (!claim) {
      return next(new AppError('Claim not found', 404));
    }

    res.status(200).json({
      success: true,
      data: claim
    });
  } catch (error) {
    next(error);
  }
};

export const getTotalClaimsByPolicyType = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Aggregation pipeline to get total claims grouped by policy type
    const result = await Claim.aggregate([
      {
        $lookup: {
          from: 'policies',
          localField: 'policyId',
          foreignField: 'policyId',
          as: 'policy'
        }
      },
      {
        $unwind: '$policy'
      },
      {
        $group: {
          _id: '$policy.policyType',
          totalClaims: { $sum: 1 },
          totalClaimAmount: { $sum: '$claimAmount' },
          averageClaimAmount: { $avg: '$claimAmount' },
          minClaimAmount: { $min: '$claimAmount' },
          maxClaimAmount: { $max: '$claimAmount' },
          claimsByStatus: {
            $push: {
              status: '$status',
              amount: '$claimAmount'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          policyType: '$_id',
          totalClaims: 1,
          totalClaimAmount: { $round: ['$totalClaimAmount', 2] },
          averageClaimAmount: { $round: ['$averageClaimAmount', 2] },
          minClaimAmount: 1,
          maxClaimAmount: 1,
          claimsByStatus: 1
        }
      },
      {
        $sort: { policyType: 1 }
      }
    ]);

    // Calculate totals across all policy types
    const totals = result.reduce(
      (acc, curr) => {
        acc.totalClaims += curr.totalClaims;
        acc.totalAmount += curr.totalClaimAmount;
        return acc;
      },
      { totalClaims: 0, totalAmount: 0 }
    );

    res.status(200).json({
      success: true,
      data: {
        breakdown: result,
        summary: {
          totalClaimsAcrossAllTypes: totals.totalClaims,
          totalAmountAcrossAllTypes: totals.totalAmount,
          numberOfPolicyTypes: result.length
        }
      }
    });
  } catch (error) {
    next(error);
  }
};