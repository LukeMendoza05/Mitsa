import type {ReactNode} from "react";
import s from "./workspace.module.css";
// Keep option text out of the label's accessible name. Deterministic IDs are
// supplied by the server, including a record ID for repeated editing forms.
export function SelectField({id,name,label,defaultValue,children}:{id:string;name:string;label:string;defaultValue?:string;children:ReactNode}) {
  return <div className={s.selectField}><label htmlFor={id}>{label}</label><select id={id} name={name} defaultValue={defaultValue}>{children}</select></div>;
}
