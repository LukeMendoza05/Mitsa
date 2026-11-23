// Outgoing-document checks only. Never return matching text or private values.
const rules = [
 ['email', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
 ['jwt', /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
 ['provider-key', /\b(?:sb_secret_|sbp_)[A-Za-z0-9_-]{8,}/],
 ['uuid', /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/i],
 ['numeric-code', /\b\d{6,8}\b/],
 ['opaque-hex', /\b[a-f0-9]{64,}\b/i],
 ['project-host', /\b[a-z0-9-]+\.supabase\.co\b/i],
 ['private-key', /-----BEGIN (?:PGP PRIVATE|RSA PRIVATE|EC PRIVATE|OPENSSH PRIVATE|PRIVATE) KEY/],
 ['credential-url', /[a-z][a-z0-9+.-]*:\/\/[^\s/@]+:[^\s/@]+@/i],
];
const normalize = value => value.normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g, '');
/** @param {string} text @param {string[]} [privateValues] */
export function inspectSupportText(text, privateValues = []) {
 const normalized = normalize(text);
 const categories = rules.filter(([, pattern]) => pattern.test(normalized)).map(([name]) => name);
 if (privateValues.some(value => value.length >= 8 && normalized.toLowerCase().includes(normalize(value).toLowerCase()))) categories.push('known-private-value');
 return {passed: categories.length === 0, categories};
}

export const supportFollowUpHeadings=['Summary','Impact','Expected behaviour','Actual behaviour','Steps to reproduce','Environment','Troubleshooting completed','Evidence','Request'];
/** Structure only; privacy must be checked separately with inspectSupportText. */
export function inspectSupportFollowUpStructure(text) {
 const wordCount=text.trim().split(/\s+/u).filter(Boolean).length;
 const headings=[...text.matchAll(/^(Summary|Impact|Expected behaviour|Actual behaviour|Steps to reproduce|Environment|Troubleshooting completed|Evidence|Request):?\s*$/gm)];
 const categories=[];
 if(JSON.stringify(headings.map(match=>match[1]))!==JSON.stringify(supportFollowUpHeadings))categories.push('section-order');
 if(headings.some((match,index)=>!text.slice(match.index+match[0].length,headings[index+1]?.index??text.length).trim()))categories.push('empty-section');
 if(wordCount>=300)categories.push('word-limit');
 return {passed:categories.length===0,wordCount,categories};
}
