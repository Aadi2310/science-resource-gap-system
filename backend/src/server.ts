import { app } from './app';
import { env } from './config/env';
import { pool } from './db/pool';
import { startWorkers } from './jobs/worker';
import { jobs,redis } from './jobs/queue';

async function start(){
  const worker=await startWorkers();
  const server=app.listen(env.port,()=>process.stdout.write(`API listening on port ${env.port}\n`));
  const shutdown=async()=>{server.close();await worker.close();await jobs.close();await redis.quit();await pool.end();process.exit(0);};
  process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
}
start().catch(error=>{console.error(error);process.exitCode=1;});
