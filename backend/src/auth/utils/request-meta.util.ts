import type { Request } from 'express';

export function requestMeta(req: Request): { userAgent?: string; ip?: string } {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}
