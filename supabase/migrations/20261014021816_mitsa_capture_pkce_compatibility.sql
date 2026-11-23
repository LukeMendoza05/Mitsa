-- Preserve the provider's optional PKCE token-hash prefix exactly. It is
-- verified by Auth, never stripped or interpreted as app authorization.
do $$ declare definition text; begin
  assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton), 'unapproved environment';
  definition:=pg_get_functiondef('private.mitsa_isolated_send_email(jsonb)'::regprocedure);
  assert position('length(token_hash) not between 32 and 256' in definition)>0, 'unexpected hook definition';
  assert position('token_hash !~ ''^[a-f0-9]+$''' in definition)>0, 'unexpected token validation';
  definition:=replace(definition,'length(token_hash) not between 32 and 256','length(token_hash) not between 32 and 261');
  definition:=replace(definition,'token_hash !~ ''^[a-f0-9]+$''','token_hash !~ ''^(pkce_)?[a-f0-9]+$''');
  execute definition;
end $$;
