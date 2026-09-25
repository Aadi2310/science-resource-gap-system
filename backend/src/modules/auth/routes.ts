import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { pool, inTransaction } from '../../db/pool';
import { env } from '../../config/env';
import { ApiError } from '../../shared/errors';
import { authenticate } from '../../middleware/auth';

export const authRouter = Router();
const email = z.string().email().max(255).transform((v) => v.trim().toLowerCase());
const password = z.string().min(10).regex(/[A-Za-z]/).regex(/[0-9]/);
const passwordLogin = z.string().min(1);
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = z.object({ email, password, full_name: z.string().min(1).max(150), phone: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(), role: z.enum(['SCHOOL','NGO']), profile: z.record(z.unknown()) }).parse(req.body);
    const result = await inTransaction(async (c) => {
      const user = await c.query('INSERT INTO users(email,password_hash,role,full_name,phone) VALUES($1,$2,$3,$4,$5) RETURNING user_id', [body.email, await bcrypt.hash(body.password, 12), body.role, body.full_name, body.phone ?? null]);
      const id = user.rows[0].user_id;
      if (body.role === 'SCHOOL') {
        const p = z.object({ school_name:z.string().min(1),school_type:z.enum(['GOVERNMENT','AIDED','PRIVATE']),district:z.string().min(1),state:z.string().min(1),student_strength_total:z.number().int().nonnegative(),udise_code:z.string().regex(/^\d{11}$/).optional(),address:z.string().optional(),latitude:z.number().min(-90).max(90).optional(),longitude:z.number().min(-180).max(180).optional() }).parse(body.profile);
        await c.query('INSERT INTO schools(user_id,school_name,school_type,district,state,student_strength_total,udise_code,address,latitude,longitude) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [id,p.school_name,p.school_type,p.district,p.state,p.student_strength_total,p.udise_code ?? null,p.address ?? null,p.latitude ?? null,p.longitude ?? null]);
      }
      if (body.role === 'NGO') {
        const p = z.object({ org_name:z.string().min(1),registration_number:z.string().optional(),focus_areas:z.array(z.string()).optional(),service_districts:z.array(z.string()).optional() }).parse(body.profile);
        await c.query('INSERT INTO organizations(user_id,org_name,registration_number,focus_areas,service_districts) VALUES($1,$2,$3,$4,$5)', [id,p.org_name,p.registration_number ?? null,p.focus_areas ?? null,p.service_districts ?? null]);
      }
      await c.query("INSERT INTO audit_logs(entity_type,entity_id,action,performed_by,new_value) VALUES('User',$1,'CREATE',$1,jsonb_build_object('role',$2))", [id,body.role]);
      return id;
    });
    res.status(201).json({ user_id: result, role: body.role });
  } catch (e) { next(e); }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email().transform(v => v.trim().toLowerCase()), password: passwordLogin }).parse(req.body);
    const found = await pool.query('SELECT user_id,email,password_hash,role,is_active FROM users WHERE lower(email)=$1', [body.email]);
    if (!found.rowCount || !(await bcrypt.compare(body.password, found.rows[0].password_hash))) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
    const user = found.rows[0];
    if (!user.is_active) throw new ApiError(403, 'INACTIVE_ACCOUNT', 'Account is inactive.');
    const access = jwt.sign({ role: user.role }, env.accessSecret, { subject: user.user_id, expiresIn: '30m' });
    const refresh = jwt.sign({ token_type: 'refresh' }, env.refreshSecret, { subject: user.user_id, expiresIn: '14d' });
    await pool.query('INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval \'14 days\')', [user.user_id,hashToken(refresh)]);
    await pool.query('UPDATE users SET last_login_at=now() WHERE user_id=$1', [user.user_id]);
    res.json({ access_token: access, refresh_token: refresh, role: user.role });
  } catch (e) { next(e); }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const token = z.string().parse(req.body?.refresh_token);
    const decoded = jwt.verify(token, env.refreshSecret) as jwt.JwtPayload;
    if (decoded.token_type !== 'refresh' || !decoded.sub) throw new ApiError(401,'INVALID_REFRESH_TOKEN','Refresh token is invalid.');
    const rotated = await inTransaction(async (c) => {
      const old = await c.query('SELECT token_id,user_id FROM refresh_tokens WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now() FOR UPDATE', [hashToken(token)]);
      if (!old.rowCount || old.rows[0].user_id !== decoded.sub) throw new ApiError(401,'INVALID_REFRESH_TOKEN','Refresh token is invalid or has already been used.');
      const user = await c.query('SELECT role,is_active FROM users WHERE user_id=$1', [decoded.sub]);
      if (!user.rowCount || !user.rows[0].is_active) throw new ApiError(403,'INACTIVE_ACCOUNT','Account is inactive.');
      const accessToken = jwt.sign({ role:user.rows[0].role },env.accessSecret,{subject:decoded.sub,expiresIn:'30m'});
      const refreshToken = jwt.sign({token_type:'refresh'},env.refreshSecret,{subject:decoded.sub,expiresIn:'14d'});
      const row = await c.query("INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '14 days') RETURNING token_id",[decoded.sub,hashToken(refreshToken)]);
      await c.query('UPDATE refresh_tokens SET revoked_at=now(),replaced_by=$2 WHERE token_id=$1',[old.rows[0].token_id,row.rows[0].token_id]);
      return {accessToken,refreshToken,role:user.rows[0].role};
    });
    res.json({access_token:rotated.accessToken,refresh_token:rotated.refreshToken,role:rotated.role});
  } catch (e) { next(e instanceof jwt.JsonWebTokenError ? new ApiError(401,'INVALID_REFRESH_TOKEN','Refresh token is invalid or expired.') : e); }
});

authRouter.post('/logout', authenticate, async (req, res, next) => {
  try {
    const token = z.string().parse(req.body?.refresh_token);
    await pool.query('UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND token_hash=$2 AND revoked_at IS NULL',[req.principal!.userId,hashToken(token)]);
    res.status(204).end();
  } catch(e) { next(e); }
});
