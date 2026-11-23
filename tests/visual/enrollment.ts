import {id} from './data';
export const enrollmentCookieName='enrollment';
export function openEnrollment(){return new URLSearchParams(location.search).get('state')==='enrollment'?{factorId:id(4),secret:'VISUALFIXTUREONLY',uri:'otpauth://totp/VisualFixture?secret=VISUALFIXTUREONLY&issuer=VisualFixture'}:null;}
