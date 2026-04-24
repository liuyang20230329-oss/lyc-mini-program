const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'lyc-dev-secret-change-in-production';

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function authenticateToken(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: '需要登录后继续访问。' });
    return;
  }
  try {
    req.auth = jwt.verify(token, SECRET);
    next();
  } catch (_) {
    res.status(401).json({ error: '登录态已失效，请重新登录。' });
  }
}

function authenticateAdmin(req, res, next) {
  const apiKey = req.headers['x-admin-key'];
  if (!apiKey || apiKey !== (process.env.ADMIN_API_KEY || 'lyc-admin-dev')) {
    res.status(403).json({ error: '无权访问管理接口。' });
    return;
  }
  next();
}

module.exports = { signToken, authenticateToken, authenticateAdmin };
