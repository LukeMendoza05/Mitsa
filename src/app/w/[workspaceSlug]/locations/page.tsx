import {SelectField} from "@/components/workspace/SelectField";
import type {Metadata} from "next";
import {z} from "zod";
import {managementContext,locationSchema} from "@/lib/workspace-management";
import {WorkspaceShell} from "@/components/workspace/WorkspaceShell";
import {ManagementFeedback} from "@/components/workspace/Management";
import {PostForm} from "@/components/site/PostForm";
import s from "@/components/workspace/workspace.module.css";
import site from "@/components/site/site.module.css";
export const metadata:Metadata={title:"Locations"};
export default async function Locations({params,searchParams}:{params:Promise<{workspaceSlug:string}>;searchParams:Promise<{error?:string;updated?:string}>}) {
  const context=await managementContext(params),w=context.workspace;
  let locations=w.locations.map(l=>({...l,active:true}));
  if(w.role!=="staff") {
    const result=await context.client.schema("api").rpc("mitsa_locations",{p_business:w.id});if(result.error)throw Error("Locations could not be verified.");locations=z.array(locationSchema).parse(result.data);
  }
  return <WorkspaceShell {...context}><div className={s.heading}><h2>{w.role==="staff"?"Your assigned locations.":"Every location in view."}</h2><p>{w.role==="staff"?"Your current assignments determine which locations you can access.":"Manage shops and warehouses. Inactive locations are retained in history and cannot be used for new assignments."}</p></div><ManagementFeedback query={await searchParams}/>
    <div className={s.cards}>{locations.map(l=><section className={s.card} key={l.id}><h3>{l.name}</h3><p>{l.kind==="shop"?"Shop":"Warehouse"} · {l.active?"Active":"Inactive"}</p>{w.role!=="staff"?<PostForm className={s.form} action="/auth/workspace"><input name="action" type="hidden" value="location"/><input name="slug" type="hidden" value={w.slug}/><input name="id" type="hidden" value={l.id}/><label>Location name<input name="name" defaultValue={l.name} maxLength={120} required/></label><SelectField id={`kind-${l.id}`} name="kind" label="Location type" defaultValue={l.kind}><option value="shop">Shop</option><option value="warehouse">Warehouse</option></SelectField><SelectField id={`status-${l.id}`} name="active" label="Status" defaultValue={l.active?"active":"inactive"}><option value="active">Active</option><option value="inactive">Inactive</option></SelectField><button className={`${site.button} ${site.secondary}`}>Save location</button></PostForm>:null}</section>)}</div>
    {!locations.length?<p className={s.empty}>No active locations are assigned. Ask your Business Owner or Admin to review your access.</p>:null}
    {w.role!=="staff"?<section className={s.section}><h2>Add a location.</h2><PostForm className={s.form} action="/auth/workspace"><input name="action" type="hidden" value="location"/><input name="slug" type="hidden" value={w.slug}/><input name="active" type="hidden" value="active"/><label>New location name<input name="name" maxLength={120} required/></label><SelectField id="new-location-kind" name="kind" label="New location type"><option value="shop">Shop</option><option value="warehouse">Warehouse</option></SelectField><button className={site.button}>Add location</button></PostForm></section>:null}
  </WorkspaceShell>;
}
