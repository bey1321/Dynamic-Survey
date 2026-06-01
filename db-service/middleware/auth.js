import jwt from 'jsonwebtoken'

/**
 * Require a valid Bearer token.
 * Attaches req.user on success. Returns 401 otherwise.
 */
export const authenticate = (req, res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Unauthorized — no token provided' })
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

/**
 * Attach req.user if a valid token is present, but never block the request.
 * Used on public share endpoints that work for both logged-in and anonymous users.
 */
export const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET)
    } catch {}
  }
  next()
}
