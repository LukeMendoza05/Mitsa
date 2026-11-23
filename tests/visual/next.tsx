import {useEffect} from 'react';
export function usePathname(){return location.pathname;}
export function redirect(path:string):never{throw Error(`Fixture redirect: ${path}`);}
export async function headers(){return new Map();}
export async function cookies(){return {get:(name:string)=>({value:name})};}
export default function Script({onReady}:{onReady?:()=>void}){useEffect(()=>{onReady?.();},[onReady]);return null;}
