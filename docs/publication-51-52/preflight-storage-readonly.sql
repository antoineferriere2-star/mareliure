BEGIN READ ONLY;
SELECT current_user,
 current_setting('transaction_read_only') AS read_only,
 current_setting('supautils.policy_grants',true) AS policy_grants,
 current_setting('supautils.privileged_role',true) AS privileged_role,
 current_setting('shared_preload_libraries',true) AS preload,
 has_column_privilege(current_user,'auth.users','id','REFERENCES') AS auth_id_reference,
 (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser;
ROLLBACK;
