import { RefreshTokenModel } from '../models/refresh-token.model.js';

export class RefreshTokenRepository {
  async saveRefreshToken(data) {
    return RefreshTokenModel.create(data);
  }

  async findByToken(token) {
    return RefreshTokenModel.findOne({ token }).lean();
  }

  async revokeToken(token, { replacedByToken = null } = {}) {
    return RefreshTokenModel.updateOne(
      { token },
      {
        $set: {
          isRevoked: true,
          revokedAt: new Date(),
          replacedByToken,
        },
      },
    );
  }

  async revokeAllUserTokens(userId) {
    return RefreshTokenModel.updateMany(
      { userId, isRevoked: false },
      {
        $set: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      },
    );
  }
}
