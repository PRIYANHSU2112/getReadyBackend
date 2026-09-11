import jwt from 'jsonwebtoken';

export class JwtService {
  constructor(secret, expiresIn, refreshSecret, refreshExpiresIn) {
    this.secret = secret;
    this.expiresIn = expiresIn;
    this.refreshSecret = refreshSecret || secret;
    this.refreshExpiresIn = refreshExpiresIn || '7d';
  }

  signAccessToken(payload, options = {}) {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      ...options,
    });
  }

  signRefreshToken(payload, options = {}) {
    return jwt.sign(payload, this.refreshSecret, {
      expiresIn: this.refreshExpiresIn,
      ...options,
    });
  }

  verifyAccessToken(token) {
    return jwt.verify(token, this.secret);
  }

  verifyRefreshToken(token) {
    return jwt.verify(token, this.refreshSecret);
  }
}
