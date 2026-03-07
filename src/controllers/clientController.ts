import { Request, Response, NextFunction } from 'express';
import { Client } from '../models/Client';
import { AppError } from '../middleware/errorHandler';
import mongoose from 'mongoose';
import { Policy } from '../models/Policy';

export const createClient = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, email, dateOfBirth, address } = req.body;

    // Check if client with this email already exists
    const existingClient = await Client.findOne({ email });
    if (existingClient) {
      return next(new AppError('Client with this email already exists', 400));
    }

    const client = new Client({
      name,
      email,
      dateOfBirth,
      address
    });

    await client.save();

    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: {
        clientId: client.clientId,
        name: client.name,
        email: client.email,
        dateOfBirth: client.dateOfBirth,
        address: client.address
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getClient = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { clientId } = req.params;

    const client = await Client.findOne({ clientId });
    
    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    res.status(200).json({
      success: true,
      data: client
    });
  } catch (error) {
    next(error);
  }
};

export const getAllClients = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const clients = await Client.find().select('-__v');
    
    res.status(200).json({
      success: true,
      count: clients.length,
      data: clients
    });
  } catch (error) {
    next(error);
  }
};

export const getTotalPremiumByClient = async (
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

    // Aggregation pipeline to calculate total premium
    const result = await Policy.aggregate([
      {
        $match: { clientId: clientId }
      },
      {
        $group: {
          _id: '$clientId',
          totalPremium: { $sum: '$premiumAmount' },
          policyCount: { $sum: 1 },
          averagePremium: { $avg: '$premiumAmount' },
          policies: {
            $push: {
              policyId: '$policyId',
              policyNumber: '$policyNumber',
              policyType: '$policyType',
              premiumAmount: '$premiumAmount',
              status: '$status'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          clientId: '$_id',
          totalPremium: 1,
          policyCount: 1,
          averagePremium: { $round: ['$averagePremium', 2] },
          policies: 1
        }
      }
    ]);

    if (result.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No policies found for this client',
        data: {
          clientId,
          totalPremium: 0,
          policyCount: 0,
          averagePremium: 0,
          policies: []
        }
      });
    }

    res.status(200).json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    next(error);
  }
};