import { RefreshTokenModel, IRefreshToken } from './refresh-token.schema';
import { Types } from 'mongoose';

export class RefreshTokenRepository {
  async create(data: {
    userId: Types.ObjectId;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    userAgent?: string;
    ip?: string;
  }): Promise<IRefreshToken> {
    return RefreshTokenModel.create(data);
  }

  async findByTokenHash(tokenHash: string): Promise<IRefreshToken | null> {
    return RefreshTokenModel.findOne({ tokenHash }).exec();
  }

  async revokeById(id: Types.ObjectId): Promise<void> {
    await RefreshTokenModel.updateOne({ _id: id }, { $set: { revokedAt: new Date() } });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await RefreshTokenModel.updateMany(
      { familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  async deleteAllForUser(userId: Types.ObjectId): Promise<void> {
    await RefreshTokenModel.deleteMany({ userId });
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
