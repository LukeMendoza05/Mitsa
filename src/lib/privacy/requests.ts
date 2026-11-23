import {z} from "zod";
export const requestKinds=z.enum(["access","correction","deletion","workspace-closure","mfa-recovery"]);
export const requestLabels={access:"Personal data access",correction:"Profile correction",deletion:"Account deletion","workspace-closure":"Workspace closure","mfa-recovery":"Lost-authenticator recovery"} as const;
export const requestSchema=z.object({id:z.uuid(),kind:requestKinds,status:z.enum(["pending","under-review","approved","rejected","completed"]),businessId:z.uuid().nullable(),requestedAt:z.string(),reviewTarget:z.string(),decisionReason:z.string().nullable(),completedAt:z.string().nullable(),exportAvailable:z.boolean()});
