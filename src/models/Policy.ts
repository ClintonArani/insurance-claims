import mongoose, { Document, Schema } from 'mongoose';

export type PolicyType = 'life' | 'health' | 'auto' | 'home';
export type PolicyStatus = 'active' | 'expired' | 'cancelled';

export interface IPolicy extends Document {
  policyId: string;
  clientId: string;
  policyNumber: string;
  policyType: PolicyType;
  startDate: Date;
  endDate: Date;
  premiumAmount: number;
  coverageAmount: number;
  status: PolicyStatus;
  createdAt: Date;
  updatedAt: Date;
}

const PolicySchema = new Schema<IPolicy>(
  {
    policyId: {
      type: String,
      required: true,
      unique: true,
      default: () => `POL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    },
    clientId: {
      type: String,
      required: [true, 'Client ID is required'],
      ref: 'Client'
    },
    policyNumber: {
      type: String,
      required: [true, 'Policy number is required'],
      unique: true,
      trim: true
    },
    policyType: {
      type: String,
      required: [true, 'Policy type is required'],
      enum: {
        values: ['life', 'health', 'auto', 'home'],
        message: 'Policy type must be one of: life, health, auto, home'
      }
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required']
      // REMOVED all validation from here
    },
    premiumAmount: {
      type: Number,
      required: [true, 'Premium amount is required'],
      min: [0, 'Premium amount must be positive']
    },
    coverageAmount: {
      type: Number,
      required: [true, 'Coverage amount is required'],
      min: [0, 'Coverage amount must be positive']
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['active', 'expired', 'cancelled'],
        message: 'Status must be one of: active, expired, cancelled'
      },
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);


export const Policy = mongoose.model<IPolicy>('Policy', PolicySchema);