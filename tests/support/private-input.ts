// Playwright errors may include fill arguments. Never let a failed private
// field action print a provider code, password or authenticator code.
export async function fillPrivateInput(input:{fill(value:string):Promise<void>},value:string) {
 try{await input.fill(value);}catch{throw Error('Private authentication input failed; value suppressed');}
}
