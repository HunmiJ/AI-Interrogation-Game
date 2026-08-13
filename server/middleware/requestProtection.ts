import type { NextFunction, Request, Response } from 'express'

interface WindowEntry {
  count: number
  resetAt: number
}

export function createRateLimit(options: { windowMs: number; max: number; code: string; message: string }) {
  const entries = new Map<string, WindowEntry>()

  return (request: Request, response: Response, next: NextFunction) => {
    const now = Date.now()
    const key = request.ip || request.socket.remoteAddress || 'local'
    const current = entries.get(key)
    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : current

    entry.count += 1
    entries.set(key, entry)
    response.setHeader('RateLimit-Limit', String(options.max))
    response.setHeader('RateLimit-Remaining', String(Math.max(0, options.max - entry.count)))
    response.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count > options.max) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))))
      response.status(429).json({ error: { code: options.code, message: options.message, retryable: true } })
      return
    }
    next()
  }
}

export function setSecurityHeaders(_request: Request, response: Response, next: NextFunction) {
  response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
}
