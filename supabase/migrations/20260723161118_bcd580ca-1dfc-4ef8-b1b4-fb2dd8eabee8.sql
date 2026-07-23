INSERT INTO public.user_roles (user_id, role)
VALUES ('481aa53c-9c59-4d8b-89f7-8de7d0aeb867', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;