-- Facturation électronique, phase 1 : données et mentions de l'espace atelier.
-- Additive et réversible (docs/einvoicing/phase1-rollback.sql). Aucune pièce émise n'est réécrite :
-- les colonnes ajoutées aux tables figées le sont par ALTER TABLE, qui ne déclenche aucun trigger.
-- Correspondance des types de client (décision du 22/10/2026, « 3 types + pays ») :
--   individual = particulier, business = professionnel, public_entity = public ;
--   le pays est le code ISO 3166-1 alpha-2 de facturation (FR par défaut), jamais stocké en double.

-- ---------------------------------------------------------------------------
-- 1. SIREN / SIRET : clé de Luhn (et règle propre à La Poste pour ses établissements).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marketplace_luhn_valid(p_digits text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE total integer := 0; d integer; i integer; len integer;
BEGIN
  IF p_digits IS NULL OR p_digits !~ '^[0-9]+$' THEN RETURN false; END IF;
  len := length(p_digits);
  FOR i IN 1..len LOOP
    d := substr(p_digits, len - i + 1, 1)::integer;
    IF i % 2 = 0 THEN d := d * 2; IF d > 9 THEN d := d - 9; END IF; END IF;
    total := total + d;
  END LOOP;
  RETURN total % 10 = 0;
END $$;

CREATE OR REPLACE FUNCTION public.marketplace_siren_valid(p_siren text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT p_siren ~ '^[0-9]{9}$' AND public.marketplace_luhn_valid(p_siren)
$$;

-- Identifiant tel que saisi (espaces, points, tirets, espaces insécables tolérés) ramené à ses chiffres.
CREATE OR REPLACE FUNCTION public.marketplace_company_id_digits(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT translate(btrim(p_value), ' .-' || chr(160) || chr(8239), '')
$$;

-- Les établissements de La Poste (SIREN 356000000) ne suivent pas Luhn : somme des chiffres multiple de 5.
CREATE OR REPLACE FUNCTION public.marketplace_siret_valid(p_siret text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT p_siret ~ '^[0-9]{14}$' AND CASE
    WHEN left(p_siret, 9) = '356000000' AND p_siret <> '35600000000048'
      THEN (SELECT sum(substr(p_siret, n, 1)::integer) FROM generate_series(1, 14) n) % 5 = 0
    ELSE public.marketplace_luhn_valid(p_siret)
  END
$$;

-- Jour civil à Paris d'un instant : la date d'émission d'une facture ou d'un avoir, et l'année de sa série.
-- Le 31 décembre à 23 h 30 UTC est déjà le 1er janvier à Paris.
CREATE OR REPLACE FUNCTION public.marketplace_paris_date(p_at timestamptz)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (p_at AT TIME ZONE 'Europe/Paris')::date
$$;

-- ---------------------------------------------------------------------------
-- 2. Émetteur : régime d'imposition de la TVA, préfixes à effet au 1er janvier suivant.
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketplace_binder_billing_profiles
  ADD COLUMN IF NOT EXISTS vat_filing_regime text,
  ADD COLUMN IF NOT EXISTS invoice_prefix_pending text,
  ADD COLUMN IF NOT EXISTS credit_note_prefix_pending text,
  ADD COLUMN IF NOT EXISTS prefix_pending_from_year integer;
ALTER TABLE public.marketplace_binder_billing_profiles
  DROP CONSTRAINT IF EXISTS marketplace_binder_billing_profiles_vat_filing_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_billing_profiles_pending_prefix_check;
ALTER TABLE public.marketplace_binder_billing_profiles
  DROP CONSTRAINT IF EXISTS marketplace_binder_billing_profiles_no_exempt;
ALTER TABLE public.marketplace_binder_billing_profiles
  ADD CONSTRAINT marketplace_binder_billing_profiles_no_exempt CHECK (vat_regime IS DISTINCT FROM 'EXEMPT'),
  ADD CONSTRAINT marketplace_binder_billing_profiles_vat_filing_check
    CHECK (vat_filing_regime IS NULL OR vat_filing_regime IN ('reel_simplifie', 'reel_normal')),
  ADD CONSTRAINT marketplace_binder_billing_profiles_pending_prefix_check
    CHECK ((invoice_prefix_pending IS NULL OR invoice_prefix_pending ~ '^[A-Za-z0-9]{1,8}$')
      AND (credit_note_prefix_pending IS NULL OR credit_note_prefix_pending ~ '^[A-Za-z0-9]{1,8}$')
      AND ((invoice_prefix_pending IS NULL AND credit_note_prefix_pending IS NULL) = (prefix_pending_from_year IS NULL)));

-- Un préfixe de facture ou d'avoir ne change plus en cours de série dès qu'une pièce a été numérotée :
-- l'application l'inscrit en attente, il s'applique à la première pièce de l'année d'effet.
CREATE OR REPLACE FUNCTION public.marketplace_binder_prefix_change_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.invoice_prefix IS DISTINCT FROM OLD.invoice_prefix OR NEW.credit_note_prefix IS DISTINCT FROM OLD.credit_note_prefix)
    AND current_setting('marketplace.prefix_promotion', true) IS DISTINCT FROM 'on'
    AND EXISTS (SELECT 1 FROM public.marketplace_binder_document_counters
      WHERE binder_id = NEW.binder_id AND kind IN ('invoice', 'credit_note')) THEN
    RAISE EXCEPTION 'prefix_change_deferred';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS marketplace_binder_prefix_change_guard ON public.marketplace_binder_billing_profiles;
CREATE TRIGGER marketplace_binder_prefix_change_guard
  BEFORE UPDATE ON public.marketplace_binder_billing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_binder_prefix_change_guard();

-- Promotion du préfixe en attente au moment où le compteur de l'année d'effet est incrémenté :
-- les fonctions de numérotation lisent le préfixe juste après, dans la même transaction.
CREATE OR REPLACE FUNCTION public.marketplace_binder_promote_pending_prefix()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kind IN ('invoice', 'credit_note') AND EXISTS (SELECT 1 FROM public.marketplace_binder_billing_profiles
    WHERE binder_id = NEW.binder_id AND prefix_pending_from_year IS NOT NULL AND prefix_pending_from_year <= NEW.year) THEN
    PERFORM set_config('marketplace.prefix_promotion', 'on', true);
    UPDATE public.marketplace_binder_billing_profiles SET
      invoice_prefix = COALESCE(invoice_prefix_pending, invoice_prefix),
      credit_note_prefix = COALESCE(credit_note_prefix_pending, credit_note_prefix),
      invoice_prefix_pending = NULL, credit_note_prefix_pending = NULL, prefix_pending_from_year = NULL
    WHERE binder_id = NEW.binder_id;
    PERFORM set_config('marketplace.prefix_promotion', 'off', true);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS marketplace_binder_promote_pending_prefix ON public.marketplace_binder_document_counters;
CREATE TRIGGER marketplace_binder_promote_pending_prefix
  AFTER INSERT OR UPDATE ON public.marketplace_binder_document_counters
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_binder_promote_pending_prefix();

-- ---------------------------------------------------------------------------
-- 3. Pays de facturation des clients : code ISO alpha-2 (FR par défaut), sans réécrire les pièces émises.
-- ---------------------------------------------------------------------------
-- Noms exacts (français, anglais, usages courants), sans casse ni espaces de bord ; même table que
-- src/marketplace/invoices/countryNames.ts. Jamais de correspondance approximative.
-- Table et fonction temporaires de la session : supprimées en fin de section, rien ne reste en base.
CREATE TEMPORARY TABLE marketplace_country_names (name text PRIMARY KEY, code text NOT NULL);
INSERT INTO marketplace_country_names (name, code) VALUES
  ('afghanistan','AF'),
  ('afrique du sud','ZA'),
  ('åland islands','AX'),
  ('albania','AL'),
  ('albanie','AL'),
  ('algeria','DZ'),
  ('algérie','DZ'),
  ('allemagne','DE'),
  ('american samoa','AS'),
  ('andorra','AD'),
  ('andorre','AD'),
  ('angola','AO'),
  ('anguilla','AI'),
  ('antarctica','AQ'),
  ('antarctique','AQ'),
  ('antigua & barbuda','AG'),
  ('antigua-et-barbuda','AG'),
  ('arabie saoudite','SA'),
  ('argentina','AR'),
  ('argentine','AR'),
  ('armenia','AM'),
  ('arménie','AM'),
  ('aruba','AW'),
  ('australia','AU'),
  ('australie','AU'),
  ('austria','AT'),
  ('autriche','AT'),
  ('azerbaïdjan','AZ'),
  ('azerbaijan','AZ'),
  ('bahamas','BS'),
  ('bahrain','BH'),
  ('bahreïn','BH'),
  ('bangladesh','BD'),
  ('barbade','BB'),
  ('barbados','BB'),
  ('belarus','BY'),
  ('belgie','BE'),
  ('belgië','BE'),
  ('belgique','BE'),
  ('belgium','BE'),
  ('belize','BZ'),
  ('benin','BJ'),
  ('bénin','BJ'),
  ('bermuda','BM'),
  ('bermudes','BM'),
  ('bhoutan','BT'),
  ('bhutan','BT'),
  ('biélorussie','BY'),
  ('bolivia','BO'),
  ('bolivie','BO'),
  ('bosnia & herzegovina','BA'),
  ('bosnie-herzégovine','BA'),
  ('botswana','BW'),
  ('bouvet island','BV'),
  ('brazil','BR'),
  ('brésil','BR'),
  ('british indian ocean territory','IO'),
  ('british virgin islands','VG'),
  ('brunei','BN'),
  ('bulgaria','BG'),
  ('bulgarie','BG'),
  ('burkina faso','BF'),
  ('burundi','BI'),
  ('cambodge','KH'),
  ('cambodia','KH'),
  ('cameroon','CM'),
  ('cameroun','CM'),
  ('canada','CA'),
  ('cap-vert','CV'),
  ('cape verde','CV'),
  ('caribbean netherlands','BQ'),
  ('cayman islands','KY'),
  ('central african republic','CF'),
  ('chad','TD'),
  ('chile','CL'),
  ('chili','CL'),
  ('china','CN'),
  ('chine','CN'),
  ('christmas island','CX'),
  ('chypre','CY'),
  ('cocos (keeling) islands','CC'),
  ('colombia','CO'),
  ('colombie','CO'),
  ('comores','KM'),
  ('comoros','KM'),
  ('congo - brazzaville','CG'),
  ('congo - kinshasa','CD'),
  ('congo-brazzaville','CG'),
  ('congo-kinshasa','CD'),
  ('cook islands','CK'),
  ('corée du nord','KP'),
  ('corée du sud','KR'),
  ('costa rica','CR'),
  ('côte d’ivoire','CI'),
  ('croatia','HR'),
  ('croatie','HR'),
  ('cuba','CU'),
  ('curaçao','CW'),
  ('cyprus','CY'),
  ('czechia','CZ'),
  ('danemark','DK'),
  ('denmark','DK'),
  ('deutschland','DE'),
  ('djibouti','DJ'),
  ('dominica','DM'),
  ('dominican republic','DO'),
  ('dominique','DM'),
  ('ecuador','EC'),
  ('egypt','EG'),
  ('égypte','EG'),
  ('el salvador','SV'),
  ('émirats arabes unis','AE'),
  ('équateur','EC'),
  ('equatorial guinea','GQ'),
  ('eritrea','ER'),
  ('érythrée','ER'),
  ('espagne','ES'),
  ('españa','ES'),
  ('estonia','EE'),
  ('estonie','EE'),
  ('eswatini','SZ'),
  ('état de la cité du vatican','VA'),
  ('etats-unis','US'),
  ('états-unis','US'),
  ('états-unis d''amérique','US'),
  ('ethiopia','ET'),
  ('éthiopie','ET'),
  ('falkland islands','FK'),
  ('faroe islands','FO'),
  ('fidji','FJ'),
  ('fiji','FJ'),
  ('finland','FI'),
  ('finlande','FI'),
  ('fra','FR'),
  ('france','FR'),
  ('french guiana','GF'),
  ('french polynesia','PF'),
  ('french southern territories','TF'),
  ('gabon','GA'),
  ('gambia','GM'),
  ('gambie','GM'),
  ('georgia','GE'),
  ('géorgie','GE'),
  ('géorgie du sud-et-les îles sandwich du sud','GS'),
  ('germany','DE'),
  ('ghana','GH'),
  ('gibraltar','GI'),
  ('grande-bretagne','GB'),
  ('great britain','GB'),
  ('grèce','GR'),
  ('greece','GR'),
  ('greenland','GL'),
  ('grenada','GD'),
  ('grenade','GD'),
  ('groenland','GL'),
  ('guadeloupe','GP'),
  ('guam','GU'),
  ('guatemala','GT'),
  ('guernesey','GG'),
  ('guernsey','GG'),
  ('guinea','GN'),
  ('guinea-bissau','GW'),
  ('guinée','GN'),
  ('guinée équatoriale','GQ'),
  ('guinée-bissau','GW'),
  ('guyana','GY'),
  ('guyane française','GF'),
  ('haiti','HT'),
  ('haïti','HT'),
  ('heard & mcdonald islands','HM'),
  ('hollande','NL'),
  ('honduras','HN'),
  ('hong kong sar china','HK'),
  ('hongrie','HU'),
  ('hungary','HU'),
  ('iceland','IS'),
  ('île bouvet','BV'),
  ('île christmas','CX'),
  ('île de man','IM'),
  ('île norfolk','NF'),
  ('îles åland','AX'),
  ('îles caïmans','KY'),
  ('îles cocos','CC'),
  ('îles cook','CK'),
  ('îles féroé','FO'),
  ('îles heard-et-macdonald','HM'),
  ('îles malouines','FK'),
  ('îles mariannes du nord','MP'),
  ('îles marshall','MH'),
  ('îles mineures éloignées des états-unis','UM'),
  ('îles pitcairn','PN'),
  ('îles salomon','SB'),
  ('îles turques-et-caïques','TC'),
  ('îles vierges britanniques','VG'),
  ('îles vierges des états-unis','VI'),
  ('inde','IN'),
  ('india','IN'),
  ('indonesia','ID'),
  ('indonésie','ID'),
  ('irak','IQ'),
  ('iran','IR'),
  ('iraq','IQ'),
  ('ireland','IE'),
  ('irlande','IE'),
  ('islande','IS'),
  ('isle of man','IM'),
  ('israel','IL'),
  ('israël','IL'),
  ('italia','IT'),
  ('italie','IT'),
  ('italy','IT'),
  ('jamaica','JM'),
  ('jamaïque','JM'),
  ('japan','JP'),
  ('japon','JP'),
  ('jersey','JE'),
  ('jordan','JO'),
  ('jordanie','JO'),
  ('kazakhstan','KZ'),
  ('kenya','KE'),
  ('kirghizstan','KG'),
  ('kiribati','KI'),
  ('koweït','KW'),
  ('kuwait','KW'),
  ('kyrgyzstan','KG'),
  ('la réunion','RE'),
  ('laos','LA'),
  ('latvia','LV'),
  ('lebanon','LB'),
  ('lesotho','LS'),
  ('lettonie','LV'),
  ('liban','LB'),
  ('liberia','LR'),
  ('libya','LY'),
  ('libye','LY'),
  ('liechtenstein','LI'),
  ('lithuania','LT'),
  ('lituanie','LT'),
  ('luxembourg','LU'),
  ('macao sar china','MO'),
  ('macédoine du nord','MK'),
  ('madagascar','MG'),
  ('malaisie','MY'),
  ('malawi','MW'),
  ('malaysia','MY'),
  ('maldives','MV'),
  ('mali','ML'),
  ('malta','MT'),
  ('malte','MT'),
  ('maroc','MA'),
  ('marshall islands','MH'),
  ('martinique','MQ'),
  ('maurice','MU'),
  ('mauritania','MR'),
  ('mauritanie','MR'),
  ('mauritius','MU'),
  ('mayotte','YT'),
  ('mexico','MX'),
  ('mexique','MX'),
  ('micronesia','FM'),
  ('micronésie','FM'),
  ('moldavie','MD'),
  ('moldova','MD'),
  ('monaco','MC'),
  ('mongolia','MN'),
  ('mongolie','MN'),
  ('montenegro','ME'),
  ('monténégro','ME'),
  ('montserrat','MS'),
  ('morocco','MA'),
  ('mozambique','MZ'),
  ('myanmar (birmanie)','MM'),
  ('myanmar (burma)','MM'),
  ('namibia','NA'),
  ('namibie','NA'),
  ('nauru','NR'),
  ('nepal','NP'),
  ('népal','NP'),
  ('netherlands','NL'),
  ('new caledonia','NC'),
  ('new zealand','NZ'),
  ('nicaragua','NI'),
  ('niger','NE'),
  ('nigeria','NG'),
  ('niue','NU'),
  ('norfolk island','NF'),
  ('north korea','KP'),
  ('north macedonia','MK'),
  ('northern mariana islands','MP'),
  ('norvège','NO'),
  ('norway','NO'),
  ('nouvelle-calédonie','NC'),
  ('nouvelle-zélande','NZ'),
  ('oman','OM'),
  ('ouganda','UG'),
  ('ouzbékistan','UZ'),
  ('pakistan','PK'),
  ('palaos','PW'),
  ('palau','PW'),
  ('palestinian territories','PS'),
  ('panama','PA'),
  ('papouasie-nouvelle-guinée','PG'),
  ('papua new guinea','PG'),
  ('paraguay','PY'),
  ('pays-bas','NL'),
  ('pays-bas caribéens','BQ'),
  ('pérou','PE'),
  ('peru','PE'),
  ('philippines','PH'),
  ('pitcairn islands','PN'),
  ('poland','PL'),
  ('pologne','PL'),
  ('polynésie française','PF'),
  ('porto rico','PR'),
  ('portugal','PT'),
  ('puerto rico','PR'),
  ('qatar','QA'),
  ('r.a.s. chinoise de hong kong','HK'),
  ('r.a.s. chinoise de macao','MO'),
  ('république centrafricaine','CF'),
  ('république dominicaine','DO'),
  ('réunion','RE'),
  ('romania','RO'),
  ('roumanie','RO'),
  ('royaume uni','GB'),
  ('royaume-uni','GB'),
  ('russia','RU'),
  ('russie','RU'),
  ('rwanda','RW'),
  ('sahara occidental','EH'),
  ('saint-barthélemy','BL'),
  ('saint-christophe-et-niévès','KN'),
  ('saint-marin','SM'),
  ('saint-martin','MF'),
  ('saint-martin (partie néerlandaise)','SX'),
  ('saint-pierre-et-miquelon','PM'),
  ('saint-vincent-et-les grenadines','VC'),
  ('sainte-hélène','SH'),
  ('sainte-lucie','LC'),
  ('salvador','SV'),
  ('samoa','WS'),
  ('samoa américaines','AS'),
  ('san marino','SM'),
  ('são tomé & príncipe','ST'),
  ('sao tomé-et-principe','ST'),
  ('saudi arabia','SA'),
  ('schweiz','CH'),
  ('senegal','SN'),
  ('sénégal','SN'),
  ('serbia','RS'),
  ('serbie','RS'),
  ('seychelles','SC'),
  ('sierra leone','SL'),
  ('singapore','SG'),
  ('singapour','SG'),
  ('sint maarten','SX'),
  ('slovakia','SK'),
  ('slovaquie','SK'),
  ('slovenia','SI'),
  ('slovénie','SI'),
  ('solomon islands','SB'),
  ('somalia','SO'),
  ('somalie','SO'),
  ('soudan','SD'),
  ('soudan du sud','SS'),
  ('south africa','ZA'),
  ('south georgia & south sandwich islands','GS'),
  ('south korea','KR'),
  ('south sudan','SS'),
  ('spain','ES'),
  ('sri lanka','LK'),
  ('st. barthélemy','BL'),
  ('st. helena','SH'),
  ('st. kitts & nevis','KN'),
  ('st. lucia','LC'),
  ('st. martin','MF'),
  ('st. pierre & miquelon','PM'),
  ('st. vincent & grenadines','VC'),
  ('sudan','SD'),
  ('suède','SE'),
  ('suisse','CH'),
  ('suriname','SR'),
  ('svalbard & jan mayen','SJ'),
  ('svalbard et jan mayen','SJ'),
  ('svizzera','CH'),
  ('sweden','SE'),
  ('switzerland','CH'),
  ('syria','SY'),
  ('syrie','SY'),
  ('tadjikistan','TJ'),
  ('taiwan','TW'),
  ('taïwan','TW'),
  ('tajikistan','TJ'),
  ('tanzania','TZ'),
  ('tanzanie','TZ'),
  ('tchad','TD'),
  ('tchéquie','CZ'),
  ('terres australes françaises','TF'),
  ('territoire britannique de l’océan indien','IO'),
  ('territoires palestiniens','PS'),
  ('thailand','TH'),
  ('thaïlande','TH'),
  ('the netherlands','NL'),
  ('timor oriental','TL'),
  ('timor-leste','TL'),
  ('togo','TG'),
  ('tokelau','TK'),
  ('tonga','TO'),
  ('trinidad & tobago','TT'),
  ('trinité-et-tobago','TT'),
  ('tunisia','TN'),
  ('tunisie','TN'),
  ('türkiye','TR'),
  ('turkmenistan','TM'),
  ('turkménistan','TM'),
  ('turks & caicos islands','TC'),
  ('turquie','TR'),
  ('tuvalu','TV'),
  ('u.k.','GB'),
  ('u.s. outlying islands','UM'),
  ('u.s. virgin islands','VI'),
  ('u.s.a.','US'),
  ('uganda','UG'),
  ('uk','GB'),
  ('ukraine','UA'),
  ('united arab emirates','AE'),
  ('united kingdom','GB'),
  ('united states','US'),
  ('united states of america','US'),
  ('uruguay','UY'),
  ('usa','US'),
  ('uzbekistan','UZ'),
  ('vanuatu','VU'),
  ('vatican city','VA'),
  ('venezuela','VE'),
  ('viêt nam','VN'),
  ('vietnam','VN'),
  ('wallis & futuna','WF'),
  ('wallis-et-futuna','WF'),
  ('western sahara','EH'),
  ('yemen','YE'),
  ('yémen','YE'),
  ('zambia','ZM'),
  ('zambie','ZM'),
  ('zimbabwe','ZW');

CREATE OR REPLACE FUNCTION pg_temp.marketplace_country_code(p_value text) RETURNS text LANGUAGE sql AS $$
  SELECT CASE
    WHEN upper(btrim(p_value)) IN (SELECT code FROM marketplace_country_names) THEN upper(btrim(p_value))
    ELSE (SELECT code FROM marketplace_country_names WHERE name = lower(regexp_replace(btrim(p_value), '\s+', ' ', 'g')))
  END
$$;

UPDATE public.marketplace_binder_clients SET billing_country = pg_temp.marketplace_country_code(billing_country)
WHERE pg_temp.marketplace_country_code(billing_country) IS NOT NULL AND billing_country IS DISTINCT FROM pg_temp.marketplace_country_code(billing_country);
UPDATE public.marketplace_binder_invoices SET
  client_billing_country = COALESCE(pg_temp.marketplace_country_code(client_billing_country), client_billing_country),
  client_country = COALESCE(pg_temp.marketplace_country_code(client_country), client_country),
  delivery_country = COALESCE(pg_temp.marketplace_country_code(delivery_country), delivery_country)
WHERE status = 'draft';

-- Valeurs non converties : journalisées dans la sortie de la migration, laissées telles quelles.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT 'marketplace_binder_clients.billing_country' AS col, billing_country AS value, count(*) AS n
      FROM public.marketplace_binder_clients
      WHERE NULLIF(btrim(billing_country), '') IS NOT NULL AND pg_temp.marketplace_country_code(billing_country) IS NULL GROUP BY 2
    UNION ALL
    SELECT 'marketplace_binder_invoices.client_billing_country (brouillons)', client_billing_country, count(*)
      FROM public.marketplace_binder_invoices
      WHERE status = 'draft' AND NULLIF(btrim(client_billing_country), '') IS NOT NULL
        AND pg_temp.marketplace_country_code(client_billing_country) IS NULL GROUP BY 2
  LOOP
    RAISE NOTICE 'country_not_normalized % = % (% ligne(s))', r.col, r.value, r.n;
  END LOOP;
END $$;
DROP FUNCTION pg_temp.marketplace_country_code(text);
DROP TABLE marketplace_country_names;

-- ---------------------------------------------------------------------------
-- 4. PDF émis, stocké une fois avec son empreinte SHA-256.
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketplace_binder_invoices
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS pdf_sha256 text;
ALTER TABLE public.marketplace_binder_credit_notes
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS pdf_sha256 text;
ALTER TABLE public.marketplace_binder_invoices DROP CONSTRAINT IF EXISTS marketplace_binder_invoices_pdf_check;
ALTER TABLE public.marketplace_binder_invoices ADD CONSTRAINT marketplace_binder_invoices_pdf_check
  CHECK ((pdf_path IS NULL) = (pdf_sha256 IS NULL) AND (pdf_sha256 IS NULL OR pdf_sha256 ~ '^[0-9a-f]{64}$'));
ALTER TABLE public.marketplace_binder_credit_notes DROP CONSTRAINT IF EXISTS marketplace_binder_credit_notes_pdf_check;
ALTER TABLE public.marketplace_binder_credit_notes ADD CONSTRAINT marketplace_binder_credit_notes_pdf_check
  CHECK ((pdf_path IS NULL) = (pdf_sha256 IS NULL) AND (pdf_sha256 IS NULL OR pdf_sha256 ~ '^[0-9a-f]{64}$'));

-- Facture émise : contenu figé (inchangé), PDF et empreinte posés une seule fois.
CREATE OR REPLACE FUNCTION public.marketplace_binder_invoices_forbid_content_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_mutable TEXT[] := ARRAY[
    'updated_at', 'deposit_paid_cents', 'amount_paid_cents', 'payment_status', 'paid_at',
    'external_provider', 'external_invoice_id', 'external_status', 'electronic_invoice_status',
    'electronic_invoice_sent_at', 'external_metadata', 'electronic_invoice_provider',
    'provider_invoice_id', 'provider_status', 'provider_sent_at', 'reporting_status',
    'pdf_path', 'pdf_sha256'
  ];
BEGIN
  IF OLD.status IN ('issued', 'credited')
    AND (to_jsonb(NEW) - v_mutable) IS DISTINCT FROM (to_jsonb(OLD) - v_mutable) THEN
    RAISE EXCEPTION 'marketplace_binder_invoices content is immutable once issued (invoice %)', OLD.id;
  END IF;
  IF (OLD.pdf_path IS NOT NULL AND NEW.pdf_path IS DISTINCT FROM OLD.pdf_path)
    OR (OLD.pdf_sha256 IS NOT NULL AND NEW.pdf_sha256 IS DISTINCT FROM OLD.pdf_sha256) THEN
    RAISE EXCEPTION 'issued document pdf is written once (invoice %)', OLD.id;
  END IF;
  IF NEW.pdf_path IS NOT NULL AND NEW.status = 'draft' THEN
    RAISE EXCEPTION 'draft invoices have no issued pdf (invoice %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Avoir : immuable, sauf la pose unique de son PDF et de son empreinte.
CREATE OR REPLACE FUNCTION public.marketplace_binder_credit_note_header_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'credit notes are immutable'; END IF;
  IF (to_jsonb(NEW) - ARRAY['pdf_path', 'pdf_sha256']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['pdf_path', 'pdf_sha256'])
    OR (OLD.pdf_path IS NOT NULL AND NEW.pdf_path IS DISTINCT FROM OLD.pdf_path)
    OR (OLD.pdf_sha256 IS NOT NULL AND NEW.pdf_sha256 IS DISTINCT FROM OLD.pdf_sha256) THEN
    RAISE EXCEPTION 'credit notes are immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS marketplace_binder_credit_notes_immutable ON public.marketplace_binder_credit_notes;
CREATE TRIGGER marketplace_binder_credit_notes_immutable
  BEFORE UPDATE OR DELETE ON public.marketplace_binder_credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_binder_credit_note_header_immutable();

-- Date d'émission d'un avoir : le jour même (Europe/Paris), imposée par la base.
CREATE OR REPLACE FUNCTION public.marketplace_binder_credit_note_issue_today()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.issue_date IS DISTINCT FROM public.marketplace_paris_date(now()) THEN
    RAISE EXCEPTION 'credit_note_date_must_be_today';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS marketplace_binder_credit_note_issue_today ON public.marketplace_binder_credit_notes;
CREATE TRIGGER marketplace_binder_credit_note_issue_today
  BEFORE INSERT ON public.marketplace_binder_credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_binder_credit_note_issue_today();

GRANT UPDATE (pdf_path, pdf_sha256) ON public.marketplace_binder_credit_notes TO service_role;

-- Stockage privé des pièces émises (aucun accès navigateur ; servies par le serveur).
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('binder-issued-documents', 'binder-issued-documents', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Émission : date du jour imposée, mentions et identifiants contrôlés par la base.
-- ---------------------------------------------------------------------------
-- L'instant d'émission est un paramètre de la fonction interne pour qu'un test rejoue la nuit du
-- 31 décembre ; seule la fonction publique, qui passe toujours now(), est ouverte au rôle de service.
CREATE OR REPLACE FUNCTION public.marketplace_binder_issue_invoice_at(
  p_binder_id UUID, p_invoice_id UUID, p_legal_mentions JSONB, p_at timestamptz
) RETURNS UUID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_invoice public.marketplace_binder_invoices%ROWTYPE;
  v_number TEXT;
  v_today DATE := public.marketplace_paris_date(p_at);
  v_mention TEXT;
  v_country TEXT;
BEGIN
  SELECT * INTO v_invoice FROM public.marketplace_binder_invoices
  WHERE id = p_invoice_id AND binder_id = p_binder_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF v_invoice.status IN ('issued', 'credited') THEN RETURN v_invoice.id; END IF;
  v_country := upper(btrim(COALESCE(v_invoice.client_billing_country, 'FR')));
  IF v_invoice.service_date IS NULL OR v_invoice.due_date IS NULL OR v_invoice.due_date < v_today
    OR v_invoice.operation_nature IS NULL OR v_invoice.client_type IS NULL
    OR v_invoice.client_billing_address_line1 IS NULL OR v_invoice.client_billing_postal_code IS NULL
    OR v_invoice.client_billing_city IS NULL OR v_country !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'invoice_incomplete'; END IF;
  IF NULLIF(btrim(v_invoice.issuer->>'legalForm'), '') IS NULL
    OR NOT public.marketplace_siren_valid(public.marketplace_company_id_digits(v_invoice.issuer->>'siren'))
    OR NOT public.marketplace_siret_valid(public.marketplace_company_id_digits(v_invoice.issuer->>'siret'))
    OR left(public.marketplace_company_id_digits(v_invoice.issuer->>'siret'), 9) IS DISTINCT FROM public.marketplace_company_id_digits(v_invoice.issuer->>'siren')
    OR NULLIF(btrim(v_invoice.issuer->>'addressLine1'), '') IS NULL
    OR NULLIF(btrim(v_invoice.issuer->>'postalCode'), '') IS NULL
    OR NULLIF(btrim(v_invoice.issuer->>'city'), '') IS NULL THEN RAISE EXCEPTION 'invoice_incomplete'; END IF;
  IF v_invoice.vat_regime = 'VAT_LIABLE' AND (NULLIF(btrim(v_invoice.issuer->>'vatNumber'), '') IS NULL
    OR COALESCE(v_invoice.issuer->>'vatFilingRegime', '') NOT IN ('reel_simplifie', 'reel_normal'))
    THEN RAISE EXCEPTION 'invoice_incomplete'; END IF;
  -- Franchise : la mention légale est posée automatiquement si l'atelier n'en a pas saisi.
  v_mention := NULLIF(btrim(v_invoice.vat_mention), '');
  IF v_invoice.vat_regime = 'FRANCHISE' AND v_mention IS NULL THEN
    v_mention := 'TVA non applicable, art. 293 B du CGI';
  END IF;
  IF v_invoice.vat_regime NOT IN ('FRANCHISE', 'VAT_LIABLE') THEN RAISE EXCEPTION 'invoice_incomplete'; END IF;
  IF v_invoice.client_type IN ('business', 'public_entity') AND (
    NULLIF(btrim(v_invoice.client_legal_name), '') IS NULL OR NULLIF(btrim(v_invoice.payment_terms), '') IS NULL
    OR NULLIF(btrim(v_invoice.early_payment_discount_terms), '') IS NULL
    OR NULLIF(btrim(v_invoice.late_penalty_terms), '') IS NULL
  ) THEN RAISE EXCEPTION 'invoice_incomplete'; END IF;
  -- SIREN du client : obligatoire pour le public et pour un professionnel facturé en France ; toujours valide s'il est saisi.
  IF (v_invoice.client_type = 'public_entity' OR (v_invoice.client_type = 'business' AND v_country = 'FR'))
    AND NULLIF(btrim(v_invoice.client_siren), '') IS NULL THEN RAISE EXCEPTION 'invoice_incomplete'; END IF;
  IF NULLIF(btrim(v_invoice.client_siren), '') IS NOT NULL AND NOT public.marketplace_siren_valid(public.marketplace_company_id_digits(v_invoice.client_siren))
    THEN RAISE EXCEPTION 'invoice_incomplete'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_binder_invoice_items WHERE invoice_id = p_invoice_id)
    THEN RAISE EXCEPTION 'invoice_incomplete'; END IF;

  v_number := public.marketplace_binder_next_document_number(p_binder_id, 'invoice', EXTRACT(YEAR FROM v_today)::integer);
  UPDATE public.marketplace_binder_invoices SET
    invoice_number = v_number, status = 'issued', issued_at = p_at, issue_date = v_today,
    client_billing_country = v_country, vat_mention = v_mention,
    legal_mentions = COALESCE(p_legal_mentions, '[]'::jsonb),
    retained_until = (date_trunc('year', v_today) + interval '11 years - 1 day')::date,
    updated_at = now()
  WHERE id = p_invoice_id;
  UPDATE public.marketplace_binder_quotes SET status = 'invoiced' WHERE id = v_invoice.quote_id;
  RETURN p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_binder_issue_invoice(
  p_binder_id UUID, p_invoice_id UUID, p_legal_mentions JSONB
) RETURNS UUID LANGUAGE sql SET search_path = public AS $$
  SELECT public.marketplace_binder_issue_invoice_at(p_binder_id, p_invoice_id, p_legal_mentions, now())
$$;

-- ---------------------------------------------------------------------------
-- 6. Encaissements : moyen de paiement structuré, référence facultative ; l'ancien texte libre devient la note.
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketplace_external_settlements
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'autre',
  ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE public.marketplace_external_settlements ALTER COLUMN evidence DROP NOT NULL;
ALTER TABLE public.marketplace_external_settlements
  DROP CONSTRAINT IF EXISTS marketplace_external_settlements_evidence_check,
  DROP CONSTRAINT IF EXISTS marketplace_external_settlements_method_check,
  DROP CONSTRAINT IF EXISTS marketplace_external_settlements_reference_check;
ALTER TABLE public.marketplace_external_settlements
  ADD CONSTRAINT marketplace_external_settlements_evidence_check
    CHECK (evidence IS NULL OR length(btrim(evidence)) BETWEEN 1 AND 500),
  ADD CONSTRAINT marketplace_external_settlements_method_check
    CHECK (payment_method IN ('virement', 'cheque', 'especes', 'carte', 'autre')),
  ADD CONSTRAINT marketplace_external_settlements_reference_check
    CHECK (payment_reference IS NULL OR length(btrim(payment_reference)) BETWEEN 1 AND 120);

-- Une même preuve ne s'enregistre pas deux fois : la référence de paiement (n° de chèque, de virement…)
-- remplace le texte libre, devenu une note facultative. L'idempotence d'un envoi reste portée par l'identifiant.
DROP INDEX IF EXISTS public.marketplace_external_settlements_proof_once;
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_external_settlements_reference_once
  ON public.marketplace_external_settlements (invoice_id, kind, payment_method, payment_reference)
  WHERE kind IN ('receipt', 'refund') AND payment_reference IS NOT NULL;

CREATE OR REPLACE FUNCTION public.marketplace_record_external_settlement(
  p_id uuid, p_invoice uuid, p_binder uuid, p_actor uuid, p_kind text, p_amount integer,
  p_method text, p_reference text, p_note text
) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE i marketplace_binder_invoices%ROWTYPE; e marketplace_external_settlements%ROWTYPE; net bigint; disputed boolean;
  v_reference text := NULLIF(btrim(p_reference), ''); v_note text := NULLIF(btrim(p_note), '');
BEGIN
  PERFORM marketplace_external_member(p_binder, p_actor);
  SELECT * INTO i FROM marketplace_binder_invoices WHERE id = p_invoice AND binder_id = p_binder FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF p_method IS NULL OR p_method NOT IN ('virement', 'cheque', 'especes', 'carte', 'autre') THEN
    RAISE EXCEPTION 'payment_method_invalid';
  END IF;
  SELECT * INTO e FROM marketplace_external_settlements WHERE id = p_id;
  IF FOUND THEN
    IF e.invoice_id IS DISTINCT FROM p_invoice OR e.kind IS DISTINCT FROM p_kind OR e.amount_cents IS DISTINCT FROM p_amount
      OR e.payment_method IS DISTINCT FROM p_method OR e.payment_reference IS DISTINCT FROM v_reference
      OR e.evidence IS DISTINCT FROM v_note OR e.actor_id IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN;
  END IF;
  IF i.payment_snapshot->>'agreement_version' IS DISTINCT FROM 'own-external-v1' OR i.status NOT IN ('issued', 'credited') THEN
    RAISE EXCEPTION 'external_settlement_locked';
  END IF;
  SELECT coalesce(sum(CASE WHEN kind = 'receipt' THEN amount_cents WHEN kind = 'refund' THEN -amount_cents ELSE 0 END), 0)
    INTO net FROM marketplace_external_settlements WHERE invoice_id = p_invoice;
  SELECT kind = 'dispute_open' INTO disputed FROM marketplace_external_settlements
    WHERE invoice_id = p_invoice AND kind IN ('dispute_open', 'dispute_close') ORDER BY created_at DESC, id DESC LIMIT 1;
  IF p_kind = 'receipt' AND (i.status <> 'issued' OR coalesce(disputed, false) OR p_amount > i.total_ttc_cents - net
    OR EXISTS (SELECT 1 FROM marketplace_binder_credit_notes WHERE invoice_id = p_invoice)) THEN RAISE EXCEPTION 'receipt_not_due'; END IF;
  IF p_kind = 'refund' AND p_amount > net THEN RAISE EXCEPTION 'refund_exceeds_receipts'; END IF;
  IF (p_kind = 'dispute_open' AND coalesce(disputed, false)) OR (p_kind = 'dispute_close' AND NOT coalesce(disputed, false)) THEN
    RAISE EXCEPTION 'dispute_transition_invalid';
  END IF;
  INSERT INTO marketplace_external_settlements (id, invoice_id, actor_id, kind, amount_cents, currency, evidence, created_at, payment_method, payment_reference)
  VALUES (p_id, p_invoice, p_actor, p_kind, p_amount, i.currency, v_note, clock_timestamp(), p_method, v_reference);
  IF p_kind IN ('receipt', 'refund') THEN
    net := net + CASE WHEN p_kind = 'receipt' THEN p_amount ELSE -p_amount END;
    UPDATE marketplace_binder_invoices SET amount_paid_cents = net,
      payment_status = CASE WHEN net = 0 THEN 'unpaid' WHEN net = total_ttc_cents THEN 'paid' ELSE 'partial' END,
      paid_at = CASE WHEN net = total_ttc_cents THEN now() ELSE NULL END WHERE id = p_invoice;
  END IF;
END $$;

-- Signature historique conservée (déploiement : l'ancien code reste servi tant que le nouveau n'est pas en ligne).
CREATE OR REPLACE FUNCTION public.marketplace_record_external_settlement(
  p_id uuid, p_invoice uuid, p_binder uuid, p_actor uuid, p_kind text, p_amount integer, p_evidence text
) RETURNS void LANGUAGE sql SET search_path = public AS $$
  SELECT public.marketplace_record_external_settlement(p_id, p_invoice, p_binder, p_actor, p_kind, p_amount, 'autre', NULL, p_evidence)
$$;

-- ---------------------------------------------------------------------------
-- 7. Nature de chaque prestation et de chaque ligne : service (par défaut) ou bien livré.
--    La nature de la facture s'en déduit côté application (mixte si les deux), modifiable en brouillon.
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketplace_binder_services
  ADD COLUMN IF NOT EXISTS operation_nature text NOT NULL DEFAULT 'service';
ALTER TABLE public.marketplace_binder_quote_items
  ADD COLUMN IF NOT EXISTS operation_nature text NOT NULL DEFAULT 'service';
ALTER TABLE public.marketplace_binder_invoice_items
  ADD COLUMN IF NOT EXISTS operation_nature text NOT NULL DEFAULT 'service';
ALTER TABLE public.marketplace_binder_services DROP CONSTRAINT IF EXISTS marketplace_binder_services_nature_check;
ALTER TABLE public.marketplace_binder_services ADD CONSTRAINT marketplace_binder_services_nature_check
  CHECK (operation_nature IN ('service', 'bien'));
ALTER TABLE public.marketplace_binder_quote_items DROP CONSTRAINT IF EXISTS marketplace_binder_quote_items_nature_check;
ALTER TABLE public.marketplace_binder_quote_items ADD CONSTRAINT marketplace_binder_quote_items_nature_check
  CHECK (operation_nature IN ('service', 'bien'));
ALTER TABLE public.marketplace_binder_invoice_items DROP CONSTRAINT IF EXISTS marketplace_binder_invoice_items_nature_check;
ALTER TABLE public.marketplace_binder_invoice_items ADD CONSTRAINT marketplace_binder_invoice_items_nature_check
  CHECK (operation_nature IN ('service', 'bien'));

-- jsonb_populate_record passe NULL pour une clé absente (anciens Workers) : la nature retombe sur « service ».
CREATE OR REPLACE FUNCTION public.marketplace_default_operation_nature()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.operation_nature := COALESCE(NEW.operation_nature, 'service');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS marketplace_services_default_nature ON public.marketplace_binder_services;
CREATE TRIGGER marketplace_services_default_nature BEFORE INSERT OR UPDATE ON public.marketplace_binder_services
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_default_operation_nature();
DROP TRIGGER IF EXISTS marketplace_quote_items_default_nature ON public.marketplace_binder_quote_items;
CREATE TRIGGER marketplace_quote_items_default_nature BEFORE INSERT ON public.marketplace_binder_quote_items
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_default_operation_nature();
DROP TRIGGER IF EXISTS marketplace_invoice_items_default_nature ON public.marketplace_binder_invoice_items;
CREATE TRIGGER marketplace_invoice_items_default_nature BEFORE INSERT ON public.marketplace_binder_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_default_operation_nature();

-- Prestations existantes : étui, boîte, coffret, chemise deviennent des biens livrés (aucune en production le 22/10/2026).
UPDATE public.marketplace_binder_services SET operation_nature = 'bien'
WHERE operation_nature = 'service'
  AND name ~* '(^|[^[:alpha:]])(étuis?|etuis?|boîtes?|boites?|coffrets?|chemises?)([^[:alpha:]]|$)';

-- Le brouillon de facture recopie la nature de chaque ligne du devis.
CREATE OR REPLACE FUNCTION public.marketplace_binder_create_invoice_draft(
  p_binder_id UUID, p_quote_id UUID, p_draft JSONB
) RETURNS UUID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_quote public.marketplace_binder_quotes%ROWTYPE;
  v_existing UUID;
  v_id UUID := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing FROM public.marketplace_binder_invoices
  WHERE quote_id = p_quote_id AND binder_id = p_binder_id;
  IF FOUND THEN RETURN v_existing; END IF;

  SELECT * INTO v_quote FROM public.marketplace_binder_quotes
  WHERE id = p_quote_id AND binder_id = p_binder_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'quote_not_found'; END IF;
  IF v_quote.status <> 'accepted' THEN RAISE EXCEPTION 'quote_not_accepted'; END IF;

  INSERT INTO public.marketplace_binder_invoices (
    id, binder_id, quote_id, client_id, invoice_number, status, issue_date,
    service_date, due_date, operation_nature,
    client_name, client_email, client_phone, client_address_line1, client_postal_code, client_city, client_country,
    client_type, client_legal_name, client_billing_address_line1, client_billing_postal_code,
    client_billing_city, client_billing_country, client_siren, client_vat_number,
    client_purchase_order_number, client_public_service_code, client_public_commitment_number,
    book_title, book_author, height_mm, width_mm, spine_mm, book_notes,
    currency, issuer, vat_regime, vat_mention, payment_terms, notes,
    early_payment_discount_terms, late_penalty_terms,
    subtotal_cents, discount_type, discount_value, discount_cents,
    total_ht_cents, total_vat_cents, total_ttc_cents, vat_breakdown,
    deposit_type, deposit_value, deposit_cents
  ) VALUES (
    v_id, p_binder_id, p_quote_id, v_quote.client_id, NULL, 'draft', (p_draft->>'issue_date')::date,
    (p_draft->>'service_date')::date, (p_draft->>'due_date')::date, p_draft->>'operation_nature',
    v_quote.client_name, v_quote.client_email, v_quote.client_phone, v_quote.client_address_line1,
    v_quote.client_postal_code, v_quote.client_city, v_quote.client_country,
    p_draft->>'client_type', p_draft->>'client_legal_name',
    COALESCE(p_draft->>'client_billing_address_line1', v_quote.client_address_line1),
    COALESCE(p_draft->>'client_billing_postal_code', v_quote.client_postal_code),
    COALESCE(p_draft->>'client_billing_city', v_quote.client_city),
    COALESCE(p_draft->>'client_billing_country', v_quote.client_country),
    p_draft->>'client_siren', p_draft->>'client_vat_number', p_draft->>'client_purchase_order_number',
    p_draft->>'client_public_service_code', p_draft->>'client_public_commitment_number',
    v_quote.book_title, v_quote.book_author, v_quote.height_mm, v_quote.width_mm, v_quote.spine_mm, v_quote.book_notes,
    v_quote.currency, p_draft->'issuer', v_quote.vat_regime, p_draft->>'vat_mention',
    p_draft->>'payment_terms', p_draft->>'notes', p_draft->>'early_payment_discount_terms',
    p_draft->>'late_penalty_terms', v_quote.subtotal_cents, v_quote.discount_type, v_quote.discount_value,
    v_quote.discount_cents, v_quote.total_ht_cents, v_quote.total_vat_cents, v_quote.total_ttc_cents,
    v_quote.vat_breakdown, v_quote.deposit_type, v_quote.deposit_value, v_quote.deposit_cents
  );

  INSERT INTO public.marketplace_binder_invoice_items (
    invoice_id, binder_id, position, line_key, block_key, block_label, block_book_count,
    block_height_mm, block_width_mm, block_spine_mm, service_id, label, description,
    unit, quantity, unit_price_cents, vat_rate_bps, total_ht_cents, operation_nature
  ) SELECT v_id, binder_id, position, line_key, block_key, block_label, block_book_count,
    block_height_mm, block_width_mm, block_spine_mm, service_id, label, description,
    unit, quantity, unit_price_cents, vat_rate_bps, total_ht_cents, operation_nature
  FROM public.marketplace_binder_quote_items
  WHERE quote_id = p_quote_id AND binder_id = p_binder_id ORDER BY position;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_default_operation_nature() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_binder_issue_invoice_at(uuid, uuid, jsonb, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.marketplace_luhn_valid(text), public.marketplace_siren_valid(text), public.marketplace_siret_valid(text), public.marketplace_company_id_digits(text),
  public.marketplace_binder_prefix_change_guard(), public.marketplace_binder_promote_pending_prefix(),
  public.marketplace_binder_credit_note_header_immutable(), public.marketplace_binder_credit_note_issue_today(),
  public.marketplace_record_external_settlement(uuid, uuid, uuid, uuid, text, integer, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_paris_date(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_luhn_valid(text), public.marketplace_siren_valid(text), public.marketplace_siret_valid(text), public.marketplace_company_id_digits(text),
  public.marketplace_record_external_settlement(uuid, uuid, uuid, uuid, text, integer, text, text, text)
  TO service_role;
