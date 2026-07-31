import { BaseRepository } from '../../common/base/BaseRepository.js';

export class RefreshTokenRepository extends BaseRepository {
  constructor(refreshTokenModel) {
    super(refreshTokenModel);
  }

  async saveRefreshToken(payload) {
    return this.create(payload);
  }

  async findByToken(token) {
    return this.findOne({ token }, { lean: true });
  }

  async findByJti(jti) {
    return this.findOne({ jti }, { lean: true });
  }

  async revokeToken(token, { replacedByToken = null } = {}) {
    return this.model.findOneAndUpdate(
      { token },
      { $set: { isRevoked: true, replacedByToken } },
      { new: true },
    );
  }

  async revokeAllUserTokens(userId) {
    return this.model.updateMany(
      { userId, isRevoked: false },
      { $set: { isRevoked: true } },
    );
  }
}

export default RefreshTokenRepository;
