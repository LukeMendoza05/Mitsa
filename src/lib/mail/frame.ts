export const escapeMailText=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]!);
/** Shared trusted-template frame. bodyHtml must come from a bounded renderer,
 * never a form, provider error or arbitrary user content. No external assets. */
export function transactionalEmail(input:{title:string;description:string;bodyHtml:string;bodyText:string;securityNotice:string}) {
 const {title,description,bodyHtml,bodyText,securityNotice}=input,escape=escapeMailText;
 return {text:`Mitsa\nAccount security\n\n${title}\n\n${description}\n\n${bodyText}\n\n${securityNotice}\n\nMitsa — Fireworks inventory and business management.`,html:`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${escape(title)} | Mitsa</title>
<style>:root{color-scheme:light dark;supported-color-schemes:light dark}a{color:#17191c}@media(max-width:600px){.mitsa-outer{padding:20px 12px!important}.mitsa-content{padding:28px 24px!important}.mitsa-heading{font-size:34px!important}.mitsa-code{font-size:32px!important;letter-spacing:3px!important;padding:20px 8px!important}}@media(prefers-color-scheme:dark){.mitsa-canvas{background:#17191c!important}.mitsa-paper{background:#202226!important;border-color:#43464d!important;color:#fafafb!important}.mitsa-text,.mitsa-heading,.mitsa-wordmark{color:#fafafb!important}.mitsa-muted{color:#c5c8cf!important}.mitsa-code{background:#2c2f34!important;border-color:#515660!important;color:#ffffff!important}.mitsa-divider{border-color:#43464d!important}.mitsa-link{color:#fafafb!important}.mitsa-action{background:#fafafb!important;color:#17191c!important}}</style></head>
<body class="mitsa-canvas" style="margin:0;padding:0;background:#fafafb;color:#17191c;font-family:Inter,'Segoe UI',Arial,Helvetica,sans-serif;line-height:1.6;-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="mitsa-outer" align="center" style="padding:40px 16px">
<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table class="mitsa-paper" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #ececec;border-radius:20px;color:#17191c"><tr><td class="mitsa-content" style="padding:40px">
<p class="mitsa-wordmark" style="margin:0 0 32px;font:30px/1.2 'Source Serif 4',Georgia,'Times New Roman',serif;letter-spacing:-1px;color:#17191c">Mitsa</p>
<p class="mitsa-muted" style="margin:0 0 16px;color:#626773;font-size:11px;line-height:1.5;letter-spacing:1.5px">ACCOUNT SECURITY</p>
<h1 class="mitsa-heading" style="margin:0 0 20px;font:40px/1.15 'Source Serif 4',Georgia,'Times New Roman',serif;letter-spacing:-1.2px;color:#17191c">${escape(title)}</h1>
<p class="mitsa-text" style="margin:0 0 28px;font-size:16px;color:#17191c">${escape(description)}</p>
${bodyHtml}
<p class="mitsa-muted" style="margin:28px 0 0;color:#626773;font-size:14px">${escape(securityNotice)}</p>
<p class="mitsa-muted mitsa-divider" style="margin:32px 0 0;padding-top:20px;border-top:1px solid #ececec;color:#626773;font-size:12px;line-height:1.6">Mitsa<br>Fireworks inventory and business management.</p>
</td></tr></table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`};
}
