import { Router } from 'express';
import { pool } from '../../db/pool';
import { authenticate,allow,canAccessSchool } from '../../middleware/auth';
import { ApiError } from '../../shared/errors';
import { pagination,paged } from '../../shared/pagination';

export const reportRouter=Router();reportRouter.use(authenticate);
const verifiedScope=`JOIN schools s USING(school_id) JOIN assessments a ON a.school_id=s.school_id AND a.assessment_id=(SELECT a2.assessment_id FROM assessments a2 WHERE a2.school_id=s.school_id AND a2.status='VERIFIED' ORDER BY a2.verified_at DESC LIMIT 1) JOIN gap_records g USING(gap_id) JOIN priority_scores ps ON ps.score_id=requirements.score_id`;

reportRouter.get('/reports/summary',allow('NGO','ADMIN'),async(req,res,next)=>{try{
  const role=req.principal!.role; const extra=role==='NGO'?` AND EXISTS(SELECT 1 FROM organizations o WHERE o.user_id=$1 AND o.verification_status IS NOT NULL)`:'';
  const schoolScope=role==='NGO'?`s.verification_status='VERIFIED' AND `:'';
  const bind=role==='NGO'?[req.principal!.userId]:[];
  const [byPriority,byStatus,byDistrictCategory]=await Promise.all([
    pool.query(`SELECT ps.priority_class,count(*)::int AS count FROM requirements ${verifiedScope} WHERE ${schoolScope}requirements.status<>'CLOSED'${extra} GROUP BY ps.priority_class ORDER BY ps.priority_class`,bind),
    pool.query(`SELECT requirements.status,count(*)::int AS count FROM requirements ${verifiedScope} WHERE ${schoolScope}true${extra} GROUP BY requirements.status ORDER BY requirements.status`,bind),
    pool.query(`SELECT s.district,rc.name AS resource_category,ps.priority_class,count(*)::int AS count FROM requirements ${verifiedScope} JOIN resources r USING(resource_id) JOIN resource_categories rc USING(category_id) WHERE ${schoolScope}requirements.status<>'CLOSED'${extra} GROUP BY s.district,rc.name,ps.priority_class ORDER BY s.district,rc.name,ps.priority_class`,bind)
  ]);
  res.json({open_by_priority:byPriority.rows,status_funnel:byStatus.rows,open_by_district_and_category:byDistrictCategory.rows});
}catch(e){next(e);}});

reportRouter.get('/reports/turnaround',allow('ADMIN'),async(_req,res,next)=>{try{
  const {page,pageSize,offset}=pagination(_req);
  const sql=`SELECT o.org_id,o.org_name,rc.category_id,rc.name AS resource_category,
    round(avg(extract(epoch FROM (end_event.created_at-start_event.created_at))/86400)::numeric,2) AS average_days,count(*)::int AS completed_count
    FROM requirement_status_events start_event JOIN requirements req USING(requirement_id)
    JOIN organizations o ON o.org_id=req.assigned_org_id JOIN resources r USING(resource_id) JOIN resource_categories rc USING(category_id)
    JOIN LATERAL (SELECT created_at FROM requirement_status_events e WHERE e.requirement_id=req.requirement_id AND e.new_status IN ('COMPLETED','CLOSED') AND e.created_at>=start_event.created_at ORDER BY e.created_at LIMIT 1) end_event ON true
    WHERE start_event.new_status='ACCEPTED' GROUP BY o.org_id,o.org_name,rc.category_id,rc.name`;
  const [rows,count]=await Promise.all([pool.query(`${sql} ORDER BY o.org_name,rc.name LIMIT $1 OFFSET $2`,[pageSize,offset]),pool.query(`SELECT count(*) FROM (${sql}) grouped`,[])]);
  res.json(paged(rows.rows,page,pageSize,count.rows[0].count));
}catch(e){next(e);}});

reportRouter.get('/reports/school/:id/history',allow('SCHOOL','ADMIN'),async(req,res,next)=>{try{
  if(!(await canAccessSchool(req.principal!.userId,req.principal!.role,req.params.id)))throw new ApiError(403,'FORBIDDEN','You cannot view this school history.');
  const school=await pool.query('SELECT * FROM schools WHERE school_id=$1',[req.params.id]);if(!school.rowCount)throw new ApiError(404,'NOT_FOUND','School not found.');
  const [assessments,requirements]=await Promise.all([
    pool.query(`SELECT a.*,json_agg(jsonb_build_object('school_resource',sr,'gap',g,'resource_state',CASE WHEN g.gap_qty=0 THEN 'Adequate' WHEN g.gap_qty>0 THEN 'Gap' ELSE NULL END)) FILTER(WHERE sr.school_resource_id IS NOT NULL) AS resources FROM assessments a LEFT JOIN school_resources sr USING(assessment_id) LEFT JOIN gap_records g USING(school_resource_id) WHERE a.school_id=$1 GROUP BY a.assessment_id ORDER BY a.created_at DESC`,[req.params.id]),
    pool.query(`SELECT r.*,res.name AS resource_name,g.gap_qty,g.gap_ratio,ps.final_score,ps.priority_class,(SELECT json_agg(i ORDER BY i.created_at) FROM interventions i WHERE i.requirement_id=r.requirement_id) AS interventions,(SELECT json_agg(f ORDER BY f.created_at) FROM feedback f WHERE f.requirement_id=r.requirement_id) AS feedback FROM requirements r JOIN resources res USING(resource_id) JOIN gap_records g USING(gap_id) JOIN priority_scores ps ON ps.score_id=r.score_id WHERE r.school_id=$1 ORDER BY r.created_at DESC`,[req.params.id])
  ]);
  res.json({school:school.rows[0],assessments:assessments.rows,requirements:requirements.rows});
}catch(e){next(e);}});

reportRouter.get('/reports/coverage',allow('ADMIN'),async(_req,res,next)=>{try{const r=await pool.query(`SELECT CASE WHEN count(*)=0 THEN 0 ELSE round(100.0*count(*) FILTER(WHERE EXISTS(SELECT 1 FROM assessments a WHERE a.school_id=s.school_id AND a.status='VERIFIED' AND a.verified_at>=now()-interval '12 months'))/count(*),2) END AS coverage_percent,count(*)::int AS verified_schools FROM schools s WHERE verification_status='VERIFIED'`);res.json(r.rows[0]);}catch(e){next(e);}});
