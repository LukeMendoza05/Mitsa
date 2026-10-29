"use client";

import { useId, useState, useSyncExternalStore, type FocusEventHandler, type ReactNode } from "react";
import s from "./site.module.css";

const subscribe = () => () => {};
export function PasswordField({ name, label, autoComplete = "new-password", minLength, disabled = false, inputId, error, describedBy, onBlur, labelAside }: { name: string; label: string; autoComplete?: "current-password" | "new-password"; minLength?: number; disabled?: boolean; inputId?:string;error?:string;describedBy?:string;onBlur?:FocusEventHandler<HTMLInputElement>;labelAside?:ReactNode }) {
  const generatedId = useId(),id=inputId??generatedId;
  const [visible, setVisible] = useState(false);
  const enhanced = useSyncExternalStore(subscribe, () => true, () => false);
  return <div className={s.field} data-auth-field><div className={s.fieldHeading}><label htmlFor={id}>{label}</label>{labelAside}</div><div className={s.passwordRow} data-password-control>
    <input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={minLength} maxLength={256} required disabled={disabled} aria-invalid={error?true:undefined} aria-describedby={[describedBy,error?`${id}-error`:undefined].filter(Boolean).join(" ")||undefined} onBlur={onBlur}/>
    <button className={s.passwordToggle} type="button" hidden={!enhanced} aria-controls={id} aria-pressed={visible} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} disabled={disabled} onClick={() => setVisible(value => !value)}>{visible ? "Hide" : "Show"}</button>
  </div>{error?<p id={`${id}-error`} className={s.fieldError}>{error}</p>:null}</div>;
}
