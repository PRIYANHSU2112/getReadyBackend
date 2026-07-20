import jwt from 'jsonwebtoken';

export class JwtUtil {
  
  constructor(secret, expiresIn = '1d') {
    this.secret = secret;
    this.expiresIn = expiresIn;
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
}
