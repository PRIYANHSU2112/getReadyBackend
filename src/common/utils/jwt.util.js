import jwt from 'jsonwebtoken';

export class JwtUtil {
  /**
   * @param {string} secret
   * @param {string} [expiresIn]
   * @param {string} [refreshSecret]
   * @param {string} [refreshExpiresIn]
   */
  constructor(secret, expiresIn = '1d', refreshSecret = null, refreshExpiresIn = '7d') {
    this.secret = secret;
    this.expiresIn = expiresIn;
    this.refreshSecret = refreshSecret || secret;
    this.refreshExpiresIn = refreshExpiresIn;
  }

  sign(payload, options = {}) {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      ...options,
    });
  }

  verify(token) {
    return jwt.verify(token, this.secret);
  }

  signAccessToken(payload, options = {}) {
    return this.sign({ ...payload, tokenType: 'access' }, options);
  }

  verifyAccessToken(token) {
    return this.verify(token);
  }

  signRefreshToken(payload, options = {}) {
    return jwt.sign({ ...payload, tokenType: 'refresh' }, this.refreshSecret, {
      expiresIn: this.refreshExpiresIn,
      ...options,
    });
  }

  verifyRefreshToken(token) {
    return jwt.verify(token, this.refreshSecret);
  }
}
