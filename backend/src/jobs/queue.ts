import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';

export const redis = new IORedis(env.redisUrl,{maxRetriesPerRequest:null});
export const jobs = new Queue('science-resource-gap', {connection:redis});
export function enqueueRecompute(kind:'all'|'category',categoryId?:string){ return jobs.add('recompute-priority',{kind,categoryId},{attempts:5,backoff:{type:'exponential',delay:1000},removeOnComplete:100,removeOnFail:500}); }
