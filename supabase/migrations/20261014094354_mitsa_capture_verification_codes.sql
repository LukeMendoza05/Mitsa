-- PREPARED ONLY. Requires fresh approval before applying to the isolated target.
-- Preserves recipient/intent/origin/rate controls and all historical ciphertext.
do $$ declare definition text; old text; begin
 assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton), 'unapproved environment';
 assert (select not(registration_enabled or external_mail_enabled or eligibility_approved or legal_publication_enabled or disposal_enabled) from private.release_gates where singleton), 'release gates must be closed';
 definition:=pg_get_functiondef('private.mitsa_isolated_send_email(jsonb)'::regprocedure);
 assert position('mitsa_test_recipient_allowed' in definition)>0,'strict recipient guard required';
 old:='payload:=jsonb_build_object(''email'',recipient,''userId'',uid,''type'',action,''tokenHash'',token_hash,''origin'',''http://127.0.0.1:3000'');';
 assert position(old in definition)>0,'unexpected capture implementation';
 execute replace(definition,old,old||E'\n  if action=''signup'' then\n    if coalesce(event->''email_data''->>''token'','''') !~ ''^[0-9]{6,10}$'' then raise exception ''mail unavailable''; end if;\n    payload:=payload||jsonb_build_object(''code'',event->''email_data''->>''token'');\n  end if;');
end $$;
-- Numeric code is encrypted with the existing operator-only public key. Never
-- return it via RPC, log it, persist plaintext, or upload the local private key.
