import {it,expect} from 'vitest';
import {executeOfflineOnboarding} from '../support/onboarding-assembled-failure-fixture';
it.each(['preservation','worker','provider','recipient','smtp','receipt','owner','cleanup'])('OFFLINE assembled failure: %s stops, retains consumed budgets and never reports acceptance',async fault=>{
 const r=await executeOfflineOnboarding(fault);
 expect(r.result.status).toBe('FAILED');expect(r.result.hostedAcceptanceCompleted).toBe(false);expect(r.counts).toEqual(r.reconstructedCounts);expect(r.status.connected).toBe(false);expect(r.status.controlsDisabled).toBe(true);expect(r.status.enabled).toBe(false);
 expect(r.counts.authRequests??0).toBeLessThanOrEqual(200);expect(r.counts.newAccounts??0).toBeLessThanOrEqual(1);expect(r.counts.newFactors??0).toBeLessThanOrEqual(1);expect(r.counts.newWorkspaces??0).toBeLessThanOrEqual(1);
 if(['preservation','worker','provider','cleanup'].includes(fault)){expect(r.smtpAttempts).toBe(0);expect(r.users).toBe(0);expect(r.counts.newAccounts??0).toBe(0);}
 if(['worker','recipient','smtp','receipt','owner'].includes(fault)){expect(r.result.checks.controlsClosed).toBe(true);expect(r.result.checks.serviceRestored).toBe(true);expect(r.result.checks.preservation).toBe(true);expect(r.result.checks.databaseCleanup).toBe(true);}
 if(['recipient','smtp'].includes(fault)){expect(r.jobStates).toEqual(['unconfirmed']);expect(r.counts.emails??0).toBe(fault==='smtp'?1:0);expect(r.smtpAttempts).toBe(fault==='smtp'?1:0);expect(r.counts.smtpVerifications).toBe(1);expect(r.providerVerifyCalls).toBe(0);}
 if(fault==='receipt'){expect(r.jobStates).toEqual(['smtp-accepted']);expect(r.counts.emails).toBe(1);expect(r.counts.operatorRequests??0).toBe(0);expect(r.providerVerifyCalls).toBe(0);expect(r.result.checks['e-a-onboarding']).not.toBe(true);}
 if(fault==='owner'){expect(r.counts.newWorkspaces).toBe(1);expect(r.result.failurePhase).toBe('e-a-createWorkspace');expect(r.result.checks['e-a-onboarding']).not.toBe(true);}
 if(fault==='cleanup')expect(r.result.checks.databaseCleanup).not.toBe(true);
},180000);
