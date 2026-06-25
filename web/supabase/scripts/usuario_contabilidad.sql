-- Usuario: contabilidad@tacticalsupport.com.mx
-- Rol app: contabilidad (solo MOPER: consulta documentos completados y marca recepción)
--
-- INSTRUCCIONES:
-- A) Si el usuario YA existe en Supabase Auth: ejecuta tal cual (solo asigna app_role).
-- B) Si vas a CREAR el usuario: cambia v_password (no dejes CAMBIAR_ESTA_CONTRASEÑA).
-- 3. Pega en Supabase → SQL Editor → Run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_email text := 'contabilidad@tacticalsupport.com.mx';
  v_password text := 'CAMBIAR_ESTA_CONTRASEÑA';
  v_user_id uuid;
  v_encrypted_pw text;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_email)
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('app_role', 'contabilidad'),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
    WHERE id = v_user_id;

    RAISE NOTICE 'Usuario % ya existia: app_role actualizado a contabilidad.', v_email;
    RETURN;
  END IF;

  IF v_password = 'CAMBIAR_ESTA_CONTRASEÑA' OR length(trim(v_password)) < 8 THEN
    RAISE EXCEPTION 'Usuario no existe. Edita v_password en el script (minimo 8 caracteres) y vuelve a ejecutar.';
  END IF;

  v_user_id := gen_random_uuid();
  v_encrypted_pw := crypt(v_password, gen_salt('bf'));

  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  )
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    v_encrypted_pw,
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"app_role":"contabilidad"}'::jsonb,
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    v_user_id::text,
    NOW(),
    NOW(),
    NOW()
  );

  RAISE NOTICE 'Usuario % creado con rol contabilidad.', v_email;
END $$;

-- Verificación (opcional):
-- SELECT id, email, raw_user_meta_data->>'app_role' AS app_role, email_confirmed_at
-- FROM auth.users
-- WHERE lower(email) = 'contabilidad@tacticalsupport.com.mx';
