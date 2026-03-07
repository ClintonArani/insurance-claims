import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

// Client validation schema
export const validateClient = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 100 characters',
      'any.required': 'Name is required'
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    dateOfBirth: Joi.date().max(new Date(new Date().setFullYear(new Date().getFullYear() - 18))).required().messages({
      'date.max': 'Client must be at least 18 years old',
      'any.required': 'Date of birth is required'
    }),
    address: Joi.string().required().messages({
      'any.required': 'Address is required'
    })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => detail.message)
    });
  }
  next();
};

// Policy validation schema
export const validatePolicy = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    clientId: Joi.string().required().messages({
      'any.required': 'Client ID is required'
    }),
    policyNumber: Joi.string().required().messages({
      'any.required': 'Policy number is required'
    }),
    policyType: Joi.string().valid('life', 'health', 'auto', 'home').required().messages({
      'any.only': 'Policy type must be one of: life, health, auto, home',
      'any.required': 'Policy type is required'
    }),
    startDate: Joi.date().required().messages({
      'any.required': 'Start date is required'
    }),
    endDate: Joi.date().greater(Joi.ref('startDate')).required().messages({
      'date.greater': 'End date must be after start date',
      'any.required': 'End date is required'
    }),
    premiumAmount: Joi.number().min(0).required().messages({
      'number.min': 'Premium amount must be positive',
      'any.required': 'Premium amount is required'
    }),
    coverageAmount: Joi.number().min(0).required().messages({
      'number.min': 'Coverage amount must be positive',
      'any.required': 'Coverage amount is required'
    }),
    status: Joi.string().valid('active', 'expired', 'cancelled').default('active')
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => detail.message)
    });
  }
  next();
};

// Claim validation schema
export const validateClaim = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    policyId: Joi.string().required().messages({
      'any.required': 'Policy ID is required'
    }),
    clientId: Joi.string().required().messages({
      'any.required': 'Client ID is required'
    }),
    claimAmount: Joi.number().min(0.01).required().messages({
      'number.min': 'Claim amount must be greater than 0',
      'any.required': 'Claim amount is required'
    }),
    description: Joi.string().max(500).required().messages({
      'string.max': 'Description cannot exceed 500 characters',
      'any.required': 'Description is required'
    })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => detail.message)
    });
  }
  next();
};

// Process claim validation schema
export const validateProcessClaim = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    status: Joi.string().valid('approved', 'rejected').required().messages({
      'any.only': 'Status must be either approved or rejected',
      'any.required': 'Status is required'
    })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => detail.message)
    });
  }
  next();
};