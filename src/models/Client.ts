import mongoose, { Document, Schema } from 'mongoose';

export interface IClient extends Document {
  clientId: string;
  name: string;
  email: string;
  dateOfBirth: Date;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema = new Schema<IClient>(
  {
    clientId: {
      type: String,
      required: true,
      unique: true,
      default: () => `CLI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required']
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true
    }
  },
  {
    timestamps: true
  }
);

export const Client = mongoose.model<IClient>('Client', ClientSchema);