import { Router } from 'express';
import { z } from 'zod';
import { pool, inTransaction } from '../../db/pool';
import { allow, authenticate, canAccessSchool } from '../../middleware/auth';
import { ApiError } from '../../shared/errors';
import { pagination, paged } from '../../shared/pagination';
import { verifyAssessment } from '../scoring/recompute';

export const schoolRouter = Router();
schoolRouter.use(authenticate);

const schoolInput = z.object({ school_name:z.string().min(1).max(255),udise_code:z.string().regex(/^\d{11}$/).optional(),school_type:z.enum(['GOVERNMENT','AIDED','PRIVATE']),district:z.string().min(1).max(100),state:z.string().min(1).max(100),address:z.string().optional(),latitude:z.number().min(-90).max(90).optional(),longitude:z.number().min(-180).max(180).optional(),student_strength_total:z.number().int().nonnegative(),contact_person:z.string().max(150).optional(),contact_phone:z.string().regex(/^\+[1-9]\d{1,14}$/).optional() }).refine(v => (v.latitude === undefined) === (v.longitude === undefined),{message:'Latitude and longitude must be provided together.'});

schoolRouter.post('/schools',allow('SCHOOL'),async(req,res,next)=>{
  try {
    const p=schoolInput.parse(req.body);
    const row=await inTransaction(async(c)=>{const r=await c.query(`INSERT INTO schools(user_id,school_name,udise_code,school_type,district,state,address,latitude,longitude,student_strength_total,contact_person,contact_phone)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[req.principal!.userId,p.school_name,p.udise_code??null,p.school_type,p.district,p.state,p.address??null,p.latitude??null,p.longitude??null,p.student_strength_total,p.contact_person??null,p.contact_phone??null]);
      await c.query("INSERT INTO audit_logs(entity_type,entity_id,action,performed_by,new_value) VALUES('School',$1,'CREATE',$2,to_jsonb($3::json))",[r.rows[0].school_id,req.principal!.userId,JSON.stringify({verification_status:'PENDING'})]);return r.rows[0];});
    res.status(201).json(row);
  }catch(e){next(e);}
});

schoolRouter.get('/schools/:id',async(req,res,next)=>{
  try {
    const ok=await canAccessSchool(req.principal!.userId,req.principal!.role,req.params.id);
    if(!ok) throw new ApiError(403,'FORBIDDEN','You cannot view this school.');
    const r=await pool.query('SELECT * FROM schools WHERE school_id=$1',[req.params.id]);
    if(!r.rowCount) throw new ApiError(404,'NOT_FOUND','School not found.');
    res.json(r.rows[0]);
  }catch(e){next(e);}
});

schoolRouter.patch('/schools/:id/verify',allow('ADMIN'),async(req,res,next)=>{
  try {
    const p=z.object({status:z.enum(['VERIFIED','REJECTED']),reason:z.string().min(1).optional()}).parse(req.body);
    if(p.status==='REJECTED'&&!p.reason) throw new ApiError(400,'VALIDATION_ERROR','reason is required when rejecting a school.');
    const r=await inTransaction(async(c)=>{
      const row=await c.query('SELECT verification_status FROM schools WHERE school_id=$1 FOR UPDATE',[req.params.id]);
      if(!row.rowCount) throw new ApiError(404,'NOT_FOUND','School not found.');
      await c.query('UPDATE schools SET verification_status=$2 WHERE school_id=$1',[req.params.id,p.status]);
      await c.query("INSERT INTO audit_logs(entity_type,entity_id,action,performed_by,old_value,new_value) VALUES('School',$1,'VERIFY',$2,jsonb_build_object('verification_status',$3),jsonb_build_object('verification_status',$4,'reason',$5))",[req.params.id,req.principal!.userId,row.rows[0].verification_status,p.status,p.reason??null]);
      return (await c.query('SELECT * FROM schools WHERE school_id=$1',[req.params.id])).rows[0];
    });
    res.json(r);
  }catch(e){next(e);}
});

schoolRouter.post('/schools/:id/assessments',allow('SCHOOL','FIELD_COORDINATOR'),async(req,res,next)=>{
  try {
    const p=z.object({idempotency_key:z.string().uuid(),assessment_date:z.string().date(),resources:z.array(z.object({resource_id:z.string().uuid(),required_qty:z.number().int().nonnegative(),available_qty:z.number().int().nonnegative(),functional_qty:z.number().int().nonnegative(),condition_rating:z.enum(['GOOD','FAIR','POOR','NOT_APPLICABLE']),has_alternative:z.enum(['NONE','PARTIAL','FULL']).default('NONE'),students_affected:z.number().int().nonnegative().optional(),notes:z.string().optional()}).refine(x=>x.functional_qty<=x.available_qty,{message:'functional_qty must not exceed available_qty'}).refine(x=>(x.available_qty===0)===(x.condition_rating==='NOT_APPLICABLE'),{message:'Condition rating must be NOT_APPLICABLE exactly when no units are available.'}))}).parse(req.body);
    if(!await canAccessSchool(req.principal!.userId,req.principal!.role,req.params.id)) throw new ApiError(403,'FORBIDDEN','You are not assigned to this school.');
    const r=await inTransaction(async(c)=>{
      const school=await c.query('SELECT * FROM schools WHERE school_id=$1 FOR UPDATE',[req.params.id]);
      if(!school.rowCount) throw new ApiError(404,'NOT_FOUND','School not found.');
      const duplicate=await c.query('SELECT * FROM assessments WHERE school_id=$1 AND idempotency_key=$2',[req.params.id,p.idempotency_key]);
      if(duplicate.rowCount) return {row:duplicate.rows[0],duplicate:true};
      const latest=await c.query('SELECT assessment_id,assessment_date FROM assessments WHERE school_id=$1 ORDER BY created_at DESC LIMIT 1',[req.params.id]);
      if(latest.rowCount && p.assessment_date < String(latest.rows[0].assessment_date).slice(0,10)) throw new ApiError(409,'CONFLICT','A newer assessment already exists. Discard or manually re-apply the offline draft.');
      const count=await c.query('SELECT coalesce(max(version_number),0)+1 AS n FROM assessments WHERE school_id=$1',[req.params.id]);
      const resourceIds=[...new Set(p.resources.map(x=>x.resource_id))];
      if(resourceIds.length){const active=await c.query(`SELECT count(*)::int AS n FROM resources r JOIN resource_categories c USING(category_id) WHERE r.resource_id=ANY($1::uuid[]) AND r.is_active=true AND c.is_active=true`,[resourceIds]);if(active.rows[0].n!==resourceIds.length)throw new ApiError(400,'INVALID_RESOURCE','Every assessment resource must be active.');}
      const created=await c.query("INSERT INTO assessments(school_id,submitted_by,assessment_date,idempotency_key,version_number,supersedes_assessment_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[req.params.id,req.principal!.userId,p.assessment_date,p.idempotency_key,count.rows[0].n,latest.rows[0]?.assessment_id??null]);
      for(const item of p.resources) await c.query('INSERT INTO school_resources(assessment_id,resource_id,required_qty,available_qty,functional_qty,condition_rating,has_alternative,students_affected,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[created.rows[0].assessment_id,item.resource_id,item.required_qty,item.available_qty,item.functional_qty,item.condition_rating,item.has_alternative,item.students_affected??null,item.notes??null]);
      await c.query("INSERT INTO audit_logs(entity_type,entity_id,action,performed_by,new_value) VALUES('Assessment',$1,'CREATE',$2,jsonb_build_object('status','DRAFT'))",[created.rows[0].assessment_id,req.principal!.userId]);
      return {row:created.rows[0],duplicate:false};
    });
    res.status(r.duplicate?200:201).json(r.row);
  }catch(e){next(e);}
});

schoolRouter.patch('/assessments/:id',async(req,res,next)=>{
  try{
    const p=z.object({expected_version:z.number().int().positive(),resources:z.array(z.object({resource_id:z.string().uuid(),required_qty:z.number().int().nonnegative(),available_qty:z.number().int().nonnegative(),functional_qty:z.number().int().nonnegative(),condition_rating:z.enum(['GOOD','FAIR','POOR','NOT_APPLICABLE']),has_alternative:z.enum(['NONE','PARTIAL','FULL']).default('NONE'),students_affected:z.number().int().nonnegative().optional(),notes:z.string().optional()}).refine(x=>x.functional_qty<=x.available_qty).refine(x=>(x.available_qty===0)===(x.condition_rating==='NOT_APPLICABLE')))}).parse(req.body);
    const row=await inTransaction(async(c)=>{
      const q=await c.query('SELECT a.*,s.school_id FROM assessments a JOIN schools s USING(school_id) WHERE assessment_id=$1 FOR UPDATE',[req.params.id]);
      if(!q.rowCount)throw new ApiError(404,'NOT_FOUND','Assessment not found.');
      const a=q.rows[0];if(a.submitted_by!==req.principal!.userId||!await canAccessSchool(req.principal!.userId,req.principal!.role,a.school_id))throw new ApiError(403,'FORBIDDEN','You cannot edit this assessment.');
      if(a.status!=='DRAFT')throw new ApiError(409,'ASSESSMENT_LOCKED','Only draft assessments can be edited.',{current_status:a.status});
      if(Number(a.version)!==p.expected_version)throw new ApiError(409,'VERSION_CONFLICT','Assessment changed since it was read.',{current:a});
      await c.query('DELETE FROM school_resources WHERE assessment_id=$1',[req.params.id]);
      for(const item of p.resources)await c.query('INSERT INTO school_resources(assessment_id,resource_id,required_qty,available_qty,functional_qty,condition_rating,has_alternative,students_affected,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[req.params.id,item.resource_id,item.required_qty,item.available_qty,item.functional_qty,item.condition_rating,item.has_alternative,item.students_affected??null,item.notes??null]);
      await c.query('UPDATE assessments SET version=version+1 WHERE assessment_id=$1',[req.params.id]);
      await c.query("INSERT INTO audit_logs(entity_type,entity_id,action,performed_by,old_value,new_value) VALUES('Assessment',$1,'UPDATE',$2,jsonb_build_object('version',$3),jsonb_build_object('version',$4))",[req.params.id,req.principal!.userId,a.version,Number(a.version)+1]);
      return (await c.query('SELECT * FROM assessments WHERE assessment_id=$1',[req.params.id])).rows[0];
    });res.json(row);
  }catch(e){next(e);}
});

schoolRouter.post('/assessments/:id/submit',async(req,res,next)=>{
  try {
    const body=z.object({expected_version:z.number().int().positive()}).parse(req.body);
    const r=await inTransaction(async(c)=>{
      const q=await c.query(`SELECT a.*,s.user_id,s.student_strength_total FROM assessments a JOIN schools s USING(school_id) WHERE assessment_id=$1 FOR UPDATE`,[req.params.id]);
      if(!q.rowCount) throw new ApiError(404,'NOT_FOUND','Assessment not found.');
      const a=q.rows[0];
      if(a.submitted_by!==req.principal!.userId) throw new ApiError(403,'FORBIDDEN','Only the assessment owner can submit it.');
      if(a.status!=='DRAFT') throw new ApiError(409,'INVALID_ASSESSMENT_STATE','Only draft assessments can be submitted.',{current_status:a.status});
      if(Number(a.version)!==body.expected_version) throw new ApiError(409,'VERSION_CONFLICT','Assessment changed since it was read.',{current:a});
      const count=await c.query('SELECT count(*)::int AS n FROM school_resources WHERE assessment_id=$1',[req.params.id]);
      if(Number(a.student_strength_total)===0||count.rows[0].n===0) throw new ApiError(400,'ASSESSMENT_INCOMPLETE','Submission requires a positive student count and at least one resource.');
      await c.query("UPDATE assessments SET status='SUBMITTED',version=version+1 WHERE assessment_id=$1",[req.params.id]);
      await c.query("INSERT INTO audit_logs(entity_type,entity_id,action,performed_by,old_value,new_value) VALUES('Assessment',$1,'SUBMIT',$2,jsonb_build_object('status','DRAFT'),jsonb_build_object('status','SUBMITTED'))",[req.params.id,req.principal!.userId]);
      return (await c.query('SELECT * FROM assessments WHERE assessment_id=$1',[req.params.id])).rows[0];
    });
    res.json(r);
  }catch(e){next(e);}
});

schoolRouter.patch('/assessments/:id/verify',allow('ADMIN'),async(req,res,next)=>{
  try {
    const p=z.object({status:z.enum(['VERIFIED','REJECTED']),reason:z.string().optional(),expected_version:z.number().int().positive()}).parse(req.body);
    const r=await inTransaction(async(c)=>{const current=await c.query('SELECT version FROM assessments WHERE assessment_id=$1 FOR UPDATE',[req.params.id]);if(!current.rowCount)throw new ApiError(404,'NOT_FOUND','Assessment not found.');if(Number(current.rows[0].version)!==p.expected_version)throw new ApiError(409,'VERSION_CONFLICT','Assessment changed since it was read.',{current:current.rows[0]});await verifyAssessment(c,req.params.id,req.principal!.userId,p.status,p.reason); return (await c.query('SELECT * FROM assessments WHERE assessment_id=$1',[req.params.id])).rows[0];});
    res.json(r);
  }catch(e){next(e);}
});

schoolRouter.get('/schools/:id/assessments',async(req,res,next)=>{
  try {
    if(!await canAccessSchool(req.principal!.userId,req.principal!.role,req.params.id)) throw new ApiError(403,'FORBIDDEN','You cannot view this school history.');
    const {page,pageSize,offset}=pagination(req);
    const [list,count]=await Promise.all([pool.query('SELECT * FROM assessments WHERE school_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',[req.params.id,pageSize,offset]),pool.query('SELECT count(*) FROM assessments WHERE school_id=$1',[req.params.id])]);
    res.json(paged(list.rows,page,pageSize,count.rows[0].count));
  }catch(e){next(e);}
});
