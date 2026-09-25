import { Worker } from 'bullmq';
import { jobs, redis } from './queue';
import { inTransaction, pool } from '../db/pool';
import { env } from '../config/env';
import { calculatePriority, WeightConfig } from '../domain/priority-engine';

export async function startWorkers(){
  const worker=new Worker('science-resource-gap',async job=>{
    if(job.name==='auto-close') return closeCompleted();
    if(job.name==='recompute-priority') return recompute(job.data.kind,job.data.categoryId);
  },{connection:redis,concurrency:2});
  await worker.waitUntilReady();
  await jobs.upsertJobScheduler('requirement-auto-close',{pattern:'0 * * * *'},{name:'auto-close',data:{},opts:{removeOnComplete:true}});
  return worker;
}

async function closeCompleted(){
  await inTransaction(async(c)=>{
    const due=await c.query(`SELECT requirement_id,status,assigned_org_id FROM requirements WHERE status='COMPLETED' AND completed_at <= now()-($1::text||' days')::interval FOR UPDATE SKIP LOCKED`,[env.autoCloseDays]);
    for(const r of due.rows){
      await c.query("UPDATE requirements SET status='CLOSED',version=version+1 WHERE requirement_id=$1",[r.requirement_id]);
      await c.query("INSERT INTO requirement_status_events(requirement_id,old_status,new_status,actor_id) VALUES($1,'COMPLETED','CLOSED',NULL)",[r.requirement_id]);
      await c.query("INSERT INTO interventions(requirement_id,org_id,action_description,status_at_entry,updated_by,comments) VALUES($1,$2,'Automatically closed after confirmation window','CLOSED',NULL,'System generated')",[r.requirement_id,r.assigned_org_id]);
      await c.query("INSERT INTO audit_logs(entity_type,entity_id,action,old_value,new_value) VALUES('Requirement',$1,'AUTO_CLOSE',jsonb_build_object('status','COMPLETED'),jsonb_build_object('status','CLOSED'))",[r.requirement_id]);
    }
  });
}

async function recompute(kind:'all'|'category',categoryId?:string){
  await inTransaction(async(c)=>{
    const configQ=await c.query('SELECT * FROM weight_configs WHERE is_active=true'); if(!configQ.rowCount)return;
    const config=configQ.rows[0] as WeightConfig;
    const categoryFilter=kind==='category'?' AND rc.category_id=$1':'';
    const args=kind==='category'?[categoryId]:[];
    const rows=await c.query(`SELECT sr.*,g.gap_id,g.gap_qty,g.gap_ratio,r.category_id,rc.importance_weight,s.student_strength_total
      FROM gap_records g JOIN school_resources sr USING(school_resource_id) JOIN resources r USING(resource_id) JOIN resource_categories rc USING(category_id)
      JOIN assessments a USING(assessment_id) JOIN schools s USING(school_id)
      WHERE a.status='VERIFIED' AND a.verified_at=(SELECT max(a2.verified_at) FROM assessments a2 WHERE a2.school_id=s.school_id AND a2.status='VERIFIED') AND g.gap_qty>0 ${categoryFilter}`,
      args);
    const maxStudents=Math.max(0,...rows.rows.map(r=>Number(r.students_affected??r.student_strength_total)));
    for(const r of rows.rows){
      const score=calculatePriority({gapRatio:Number(r.gap_ratio),importance:Number(r.importance_weight),studentsAffected:Number(r.students_affected??r.student_strength_total),maxStudentsAffected:maxStudents,alternative:r.has_alternative,condition:r.condition_rating,config});
      const saved=await c.query(`INSERT INTO priority_scores(school_resource_id,weight_config_id,severity_score,importance_score,students_score,alternative_score,condition_score,final_score,priority_class,computed_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now()) RETURNING score_id`,[r.school_resource_id,config.config_id,score.severity,score.importance,score.students,score.alternative,score.condition,score.finalScore,score.priorityClass]);
      await c.query(`UPDATE requirements SET score_id=$2,version=version+1 WHERE gap_id=$1 AND status IN ('OPEN','UNDER_REVIEW')`,[r.gap_id,saved.rows[0].score_id]);
    }
  });
}
