import { NextResponse } from 'next/server';
import os from 'os';
import fs from 'fs';

export async function GET() {
  const totalMem = os.totalmem();
  const freeMem  = os.freemem();
  const usedMem  = totalMem - freeMem;

  let cpu = 0;
  try {
    const loadavg = fs.readFileSync('/proc/loadavg', 'utf8');
    const load1m  = parseFloat(loadavg.split(' ')[0]);
    cpu = Math.min(100, (load1m / os.cpus().length) * 100);
  } catch {
    cpu = os.loadavg()[0] * 10;
  }

  let diskUsed = 0, diskTotal = 0;
  try {
    const { execSync } = await import('child_process');
    const df = execSync("df / --output=used,size -k | tail -1").toString().trim().split(/\s+/);
    diskUsed  = parseInt(df[0]) * 1024;
    diskTotal = parseInt(df[1]) * 1024;
  } catch { /* skip */ }

  return NextResponse.json({
    cpu: Math.round(cpu * 10) / 10,
    ramUsed: usedMem,
    ramTotal: totalMem,
    diskUsed,
    diskTotal,
  });
}
