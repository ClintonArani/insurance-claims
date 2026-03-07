import mongoose, { Document, Schema } from 'mongoose';

export type ClaimStatus = 'submitted' | 'approved' | 'rejected' | 'paid';

export interface IClaim extends Document {
  claimId: string;
  policyId: string;
  clientId: string;
  claimDate: Date;
  claimAmount: number;
  status: ClaimStatus;
  description: string;
  disbursementAmount?: number;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ClaimSchema = new Schema<IClaim>(
  {
    claimId: {
      type: String,
      required: true,
      unique: true,
      default: () => `CLM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    },
    policyId: {
      type: String,
      required: [true, 'Policy ID is required'],
      ref: 'Policy'
    },
    clientId: {
      type: String,
      required: [true, 'Client ID is required'],
      ref: 'Client'
    },
    claimDate: {
      type: Date,
      required: [true, 'Claim date is required'],
      default: Date.now
    },
    claimAmount: {
      type: Number,
      required: [true, 'Claim amount is required'],
      min: [0.01, 'Claim amount must be greater than 0']
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['submitted', 'approved', 'rejected', 'paid'],
        message: 'Status must be one of: submitted, approved, rejected, paid'
      },
      default: 'submitted'
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    disbursementAmount: {
      type: Number,
      min: 0
    },
    processedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);


export const Claim = mongoose.model<IClaim>('Claim', ClaimSchema);