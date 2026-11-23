import assert from 'node:assert/strict';
export function approvalWindow(now=Date.now(),durationMs=1800000){
 assert(Number.isSafeInteger(now)&&Number.isSafeInteger(durationMs)&&durationMs>0&&durationMs<=1800000);
 return {notBefore:new Date(now).toISOString(),notAfter:new Date(now+durationMs).toISOString()};
}
export function shortenOverlongWindow(record,maximumMs=1800000){
 const start=Date.parse(record.notBefore),end=Date.parse(record.notAfter);assert(Number.isFinite(start)&&Number.isFinite(end)&&end>start);assert(end-start>maximumMs);
 return {...record,notAfter:new Date(start+maximumMs).toISOString()};
}
