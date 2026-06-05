-- Usuario: relacioneslaborales@tacticalsupport.com.mx
-- Rol app: relaciones_laborales (solo MOPER: registrar, editar, guardar)
--
-- INSTRUCCIONES:
-- 1. Cambia v_password abajo por la contraseña que quieras asignar.
-- 2. Pega todo en Supabase → SQL Editor → Run.
-- 3. Si el correo ya existe, solo actualiza metadata (no cambia la contraseña).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_email text := 'relacioneslaborales@tacticalsupport.com.mx';
  v_password text := 'CAMBIAR_ESTA_CONTRASEÑA';
  v_user_id uuid;
  v_encrypted_pw text;
BEGIN
  IF v_password = 'CAMBIAR_ESTA_CONTRASEÑA' THEN
    RAISE EXCEPTION 'Edita v_password en el script antes de ejecutar.';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_email)
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('app_role', 'relaciones_laborales'),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
    WHERE id = v_user_id;

    RAISE NOTICE 'Usuario % ya existia: app_role actualizado a relaciones_laborales.', v_email;
    RETURN;
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
    '{"app_role":"relaciones_laborales"}'::jsonb,
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

  RAISE NOTICE 'Usuario % creado con rol relaciones_laborales.', v_email;
END $$;

-- Verificación (opcional):
-- SELECT id, email, raw_user_meta_data->>'app_role' AS app_role, email_confirmed_at
-- FROM auth.users
-- WHERE lower(email) = 'relacioneslaborales@tacticalsupport.com.mx';
