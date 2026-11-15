import { Types } from 'mongoose';
import { Role } from '@doctor-tracker/shared';

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  failedLoginCount: number;
  lockUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SafeUser = Omit<IUser, 'passwordHash'>;
