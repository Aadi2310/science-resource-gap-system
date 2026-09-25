import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { pool } from '../db/pool';
import { ApiError } from '../shared/errors';

export type Role = 'SCHOOL' | 'NGO' | 'ADMIN' | 'FIELD_COORDINATOR';
export type Principal = { userId: string; role: Role };
declare global { namespace Express { interface Request { principal?: Principal } } }

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) throw new ApiError(401, 'UNAUTHENTICATED', 'A bearer access token is required.');
    const payload = jwt.verify(header.slice(7), env.accessSecret) as jwt.JwtPayload;
    const result = await pool.query('SELECT user_id,role,is_active FROM users WHERE user_id=$1', [payload.sub]);
    if (!result.rowCount) throw new ApiError(401, 'UNAUTHENTICATED', 'Access token is invalid.');
    if (!result.rows[0].is_active) throw new ApiError(403, 'INACTIVE_ACCOUNT', 'Account is inactive.');
    req.principal = { userId: result.rows[0].user_id, role: result.rows[0].role };
    next();
  } catch (error) { next(error instanceof jwt.JsonWebTokenError ? new ApiError(401, 'UNAUTHENTICATED', 'Access token is invalid or expired.') : error); }
}

export function allow(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.principal) return next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.'));
    if (!roles.includes(req.principal.role)) return next(new ApiError(403, 'FORBIDDEN', 'You are not allowed to perform this action.'));
    next();
  };
}

export async function canAccessSchool(userId: string, role: Role, schoolId: string) {
  if (role === 'ADMIN') return true;
  if (role === 'SCHOOL') {
    const r = await pool.query('SELECT 1 FROM schools WHERE school_id=$1 AND user_id=$2', [schoolId, userId]);
    return !!r.rowCount;
  }
  if (role === 'FIELD_COORDINATOR') {
    const r = await pool.query('SELECT 1 FROM field_coordinator_schools WHERE school_id=$1 AND coordinator_user_id=$2', [schoolId, userId]);
    return !!r.rowCount;
  }
  return false;
}
