import { v4 as uuidv4 } from 'uuid';

export function requestIdMiddleware(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const requestId = typeof incoming === 'string' && incoming ? incoming : uuidv4();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
