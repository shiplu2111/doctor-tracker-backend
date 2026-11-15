import { UserModel } from './user.schema';
import { IUser, SafeUser } from './user.types';
import { Types } from 'mongoose';

export class UserRepository {
  async findByEmail(email: string): Promise<SafeUser | null> {
    return UserModel.findOne({ email }).lean<SafeUser>();
  }

  async findByEmailWithPassword(email: string): Promise<IUser | null> {
    return UserModel.findOne({ email }).select('+passwordHash').exec();
  }

  async findById(id: string | Types.ObjectId): Promise<SafeUser | null> {
    return UserModel.findById(id).lean<SafeUser>();
  }

  async create(data: {
    name: string;
    email: string;
    passwordHash: string;
    role: IUser['role'];
  }): Promise<SafeUser> {
    const user = await UserModel.create(data);
    const userObj = user.toObject() as unknown as Record<string, unknown>;
    delete userObj.passwordHash;
    return userObj as unknown as SafeUser;
  }

  async recordFailedLogin(userId: Types.ObjectId, failedCount: number, lockUntil?: Date | null): Promise<void> {
    await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          failedLoginCount: failedCount,
          ...(lockUntil !== undefined ? { lockUntil } : {}),
        },
      },
    );
  }

  async recordSuccessfulLogin(userId: Types.ObjectId): Promise<void> {
    await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          failedLoginCount: 0,
          lockUntil: null,
          lastLoginAt: new Date(),
        },
      },
    );
  }
}

export const userRepository = new UserRepository();
