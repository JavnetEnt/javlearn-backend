const { verifyToken } = require('../utils/jwt');

/**
 * Requires a valid "Authorization: Bearer <token>" header.
 * On success, attaches { id, role } to req.user.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Requires req.user.role to be one of the given roles.
 * Must run after requireAuth.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Like requireAuth, but never rejects the request. If a valid Bearer token
 * is present, req.user is set; otherwise the request just continues as
 * anonymous (req.user stays undefined). Useful for routes that show more
 * to a logged-in owner/enrolled user but still work for the public.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token) {
    try {
      const payload = verifyToken(token);
      req.user = { id: payload.sub, role: payload.role };
    } catch (err) {
      // Invalid/expired token on an optional route - just treat as anonymous
      // rather than failing the request.
    }
  }
  next();
}

module.exports = { requireAuth, requireRole, optionalAuth };
