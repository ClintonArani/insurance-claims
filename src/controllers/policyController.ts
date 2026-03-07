import { Request, Response, NextFunction } from 'express';
import { Policy } from '../models/Policy';
import { Client } from '../models/Client';
import { AppError } from '../middleware/errorHandler';

export const createPolicy = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      clientId,
      policyNumber,
      policyType,
      startDate,
      endDate,
      premiumAmount,
      coverageAmount,
      status
    } = req.body;

    // Check if client exists
    const client = await Client.findOne({ clientId });
    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    // Check if policy number is unique
    const existingPolicy = await Policy.findOne({ policyNumber });
    if (existingPolicy) {
      return next(new AppError('Policy number must be unique', 400));
    }

    // Validate dates at controller level
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return next(new AppError('Invalid date format', 400));
    }
    
    if (end <= start) {
      return next(new AppError('End date must be after start date', 400));
    }

    // Create policy without any middleware validation
    const policy = new Policy({
      clientId,
      policyNumber,
      policyType,
      startDate: start,
      endDate: end,
      premiumAmount,
      coverageAmount,
      status: status || 'active'
    });

    await policy.save();

    res.status(201).json({
      success: true,
      message: 'Policy created successfully',
      data: policy
    });
  } catch (error) {
    console.error('Error creating policy:', error);
    next(error);
  }
};

export const getPolicy = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { policyId } = req.params;

    const policy = await Policy.findOne({ policyId });
    
    if (!policy) {
      return next(new AppError('Policy not found', 404));
    }

    res.status(200).json({
      success: true,
      data: policy
    });
  } catch (error) {
    next(error);
  }
};

export const getClientPolicies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { clientId } = req.params;

    // Check if client exists
    const client = await Client.findOne({ clientId });
    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    const policies = await Policy.find({ clientId }).sort({ startDate: -1 });

    res.status(200).json({
      success: true,
      count: policies.length,
      data: policies
    });
  } catch (error) {
    next(error);
  }
};