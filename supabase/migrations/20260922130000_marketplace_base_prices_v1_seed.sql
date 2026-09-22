-- Ma Reliure — Tarif de base V1 validé.
-- 45 prestations commerciales : 41 tarifs numériques et 4 prestations sur étude.
-- Les lignes restent administrables et en brouillon pour validation humaine.

INSERT INTO public.marketplace_reference_default_prices (
  pricing_key,
  reference_version,
  default_unit_price_cents,
  unit,
  pricing_mode,
  status,
  source_note,
  confidence,
  needs_human_validation
) VALUES
  ('reemboitage', 'mareliure-base-prices-v1', 6000, 'ouvrage', 'fixed', 'draft', 'Hypothèses : État compatible couverture existante et collage standard Exclusions : Urgence couture complète restauration patrimoniale Justification : Point de départ voisin du demi-toile et inférieur à une reliure complète.', 'faible', true),
  ('reparation_dos', 'mareliure-base-prices-v1', 9000, 'dos', 'unit', 'draft', 'Hypothèses : Reprise localisée d’un dos accessible Exclusions : Remplacement complet cuir rare décor ancien Justification : Reprise plus lourde que réemboîtage et très inférieure à une couvrure cuir.', 'faible', true),
  ('reparation_mors', 'mareliure-base-prices-v1', 3500, 'mors', 'unit', 'draft', 'Hypothèses : Consolidation localisée d’un mors Exclusions : Reconstruction des plats ou matériau rare Justification : Un mors est un élément localisé cohérent avec coiffe et coin.', 'faible', true),
  ('reparation_coiffes', 'mareliure-base-prices-v1', 3000, 'coiffe', 'unit', 'draft', 'Hypothèses : Reprise localisée standard Exclusions : Dos à remplacer ou décor à restituer Justification : Prix de départ inférieur à l’observation haute et cohérent avec une intervention ponctuelle.', 'faible', true),
  ('reparation_coins', 'mareliure-base-prices-v1', 1500, 'coin', 'unit', 'draft', 'Hypothèses : Un coin à consolider Exclusions : Reconstruction de plat ou cuir rare Justification : Point de départ localisé inférieur au tarif observé d’un atelier.', 'faible', true),
  ('reparation_plats', 'mareliure-base-prices-v1', 7000, 'plat', 'unit', 'draft', 'Hypothèses : Consolidation ou reprise standard d’un plat Exclusions : Remplacement double plat ou décor ancien Justification : Un plat représente une part substantielle d’une nouvelle couverture sans la couvrure complète.', 'faible', true),
  ('pages_detachees', 'mareliure-base-prices-v1', 600, 'feuillet', 'unit', 'draft', 'Hypothèses : Réintégration simple sans lacune Exclusions : Déchirures multiples lavage ou montage complexe Justification : Tarif unitaire utilisable issu de l’enveloppe publique de plaçure répartie en interventions simples.', 'faible', true),
  ('couture_partielle', 'mareliure-base-prices-v1', 3000, 'cahier', 'unit', 'draft', 'Hypothèses : Reprise d’un cahier accessible Exclusions : Démontage intégral ou couture complexe Justification : Écart volontaire au signal ancien pour couvrir une intervention artisanale réelle de reprise.', 'faible', true),
  ('recouture_complete', 'mareliure-base-prices-v1', 18000, 'ouvrage', 'fixed', 'draft', 'Hypothèses : Cahiers sains et couture standard Exclusions : Papier fragilisé restauration complète ou nerfs complexes Justification : Valeur située entre réparation locale et reliure cuir complète avec un temps de travail important.', 'faible', true),
  ('reparation_papier', 'mareliure-base-prices-v1', 1200, 'feuillet', 'unit', 'draft', 'Hypothèses : Déchirure ou renfort localisé simple Exclusions : Lacune importante lavage désacidification ou papier patrimonial Justification : Valeur de départ au-dessus de la réparation de page simple pour inclure un renfort professionnel.', 'faible', true),
  ('gardes_neuves', 'mareliure-base-prices-v1', 3500, 'ouvrage', 'fixed', 'draft', 'Hypothèses : Paire de gardes standards posées Exclusions : Gardes décorées sur mesure ou restauration de garde ancienne Justification : Ajout de finition lié à l’emboîtage et inférieur à la structure textile.', 'faible', true),
  ('pleine_toile', 'mareliure-base-prices-v1', 11500, 'ouvrage', 'fixed', 'draft', 'Hypothèses : Toile standard gardes simples décor simple absent Exclusions : Grand format cuir haut de gamme dorure complexe Justification : Prix pilote public existant conservé.', 'moyenne', true),
  ('demi_toile', 'mareliure-base-prices-v1', 5500, 'ouvrage', 'fixed', 'draft', 'Hypothèses : Montage Bradel toile standard Exclusions : Couture lourde dorure ou grand format Justification : Prix pilote Bradel existant conservé.', 'faible', true),
  ('dos_cuir', 'mareliure-base-prices-v1', 14500, 'ouvrage', 'fixed', 'draft', 'Hypothèses : Dos cuir standard plats papier ou toile Exclusions : Coins cuir nerfs véritables ou décor doré Justification : Positionné entre pleine toile et demi-cuir car seul le dos est en cuir.', 'faible', true),
  ('demi_cuir', 'mareliure-base-prices-v1', 13500, 'ouvrage', 'fixed', 'draft', 'Hypothèses : Cuir standard plats papier gardes simples Exclusions : Coins cuir nerfs décor ou grand format Justification : Prix pilote public existant conservé.', 'faible', true),
  ('demi_cuir_a_coins', 'mareliure-base-prices-v1', 16500, 'ouvrage', 'fixed', 'draft', 'Hypothèses : Demi-cuir standard avec quatre coins Exclusions : Cuir haut de gamme nerfs ou décor complexe Justification : Supplément de 30 € sur demi-cuir pour les coins et leur pose.', 'faible', true),
  ('plein_cuir', 'mareliure-base-prices-v1', 35000, 'ouvrage', 'fixed', 'draft', 'Hypothèses : Cuir standard atelier décor simple non compris Exclusions : Maroquin rare grand format mosaïque ou dorure complexe Justification : Prix pilote public existant conservé.', 'faible', true),
  ('dorure_titrage', 'mareliure-base-prices-v1', 2000, 'ligne', 'unit', 'draft', 'Hypothèses : Titrage simple au dos or ou film standard Exclusions : Composition complexe ou fer spécial Justification : Prix pilote public existant conservé.', 'moyenne', true),
  ('dorure_auteur', 'mareliure-base-prices-v1', 2000, 'ligne', 'unit', 'draft', 'Hypothèses : Une ligne de nom standard Exclusions : Typographie rare composition longue ou dorure complexe Justification : Même geste et même unité que le titrage principal.', 'faible', true),
  ('dorure_tomaison', 'mareliure-base-prices-v1', 1800, 'ligne', 'unit', 'draft', 'Hypothèses : Une ligne courte de tomaison Exclusions : Composition longue ou fer spécial Justification : Ligne généralement plus courte que titre ou auteur.', 'faible', true),
  ('dorure_date', 'mareliure-base-prices-v1', 1500, 'ligne', 'unit', 'draft', 'Hypothèses : Une date simple Exclusions : Composition décorative ou date multiple Justification : Ligne courte positionnée sous le titrage.', 'faible', true),
  ('dorure_initiales', 'mareliure-base-prices-v1', 1500, 'motif', 'unit', 'draft', 'Hypothèses : Initiales simples au film ou à l’or Exclusions : Monogramme dessiné ou gaufrage complexe Justification : Valeur d’une courte composition plus simple qu’un titrage complet.', 'faible', true),
  ('dorure_filets', 'mareliure-base-prices-v1', 200, 'cm', 'unit', 'draft', 'Hypothèses : Filet droit standard Exclusions : Filet courbe multiple ou composition de cadres Justification : Prix pilote public existant conservé.', 'faible', true),
  ('dorure_fleurons', 'mareliure-base-prices-v1', 400, 'motif', 'unit', 'draft', 'Hypothèses : Fleuron simple poussé Exclusions : Petit fer complexe ou or fin Justification : Prix pilote public existant conservé.', 'faible', true),
  ('dorure_decor', 'mareliure-base-prices-v1', 9000, 'forfait', 'starting_from', 'draft', 'Hypothèses : Composition dorée simple et validée Exclusions : Maquette personnalisée mosaïque ou décor couvrant Justification : Forfait de départ correspondant à plusieurs lignes motifs et filets simples.', 'faible', true),
  ('nerfs', 'mareliure-base-prices-v1', 1200, 'nerf', 'unit', 'draft', 'Hypothèses : Nerf standard posé sur dos préparé Exclusions : Nerfs véritables sur couture complexe ou décor doré Justification : Le signal faux nerf est revalorisé pour une pose de nerf véritable.', 'faible', true),
  ('gardes_decorees', 'mareliure-base-prices-v1', 2500, 'ouvrage', 'fixed', 'draft', 'Hypothèses : Paire de gardes décorées standard Exclusions : Papier marbré rare ou décor dessiné Justification : Supplément modéré sur gardes neuves pour le matériau décoratif.', 'faible', true),
  ('papiers_marbres', 'mareliure-base-prices-v1', 3000, 'ouvrage', 'fixed', 'draft', 'Hypothèses : Papier marbré standard pour gardes ou plats Exclusions : Papier à la cuve rare fabrication sur mesure Justification : Supplément matière et pose cohérent avec les gardes décorées.', 'faible', true),
  ('mosaique', 'mareliure-base-prices-v1', 12000, 'motif', 'starting_from', 'draft', 'Hypothèses : Un motif incrusté simple sur cuir standard Exclusions : Multiples incrustations cuir rare ou dorure associée Justification : Minimum explicite très inférieur à une reliure décorée complète observée.', 'faible', true),
  ('signet', 'mareliure-base-prices-v1', 600, 'ouvrage', 'unit', 'draft', 'Hypothèses : Un signet textile standard posé Exclusions : Ruban spécial ou plusieurs signets Justification : Petit ajout matériel et de pose distinct des finitions lourdes.', 'faible', true),
  ('tranches', 'mareliure-base-prices-v1', 7000, 'ouvrage', 'starting_from', 'draft', 'Hypothèses : Une finition standard de tranche sur ouvrage préparé Exclusions : Dorure trois tranches peinture ou décor complexe Justification : Point de départ au-dessus du minimum historique de dorure de tranche.', 'faible', true),
  ('decor_personnalise', 'mareliure-base-prices-v1', 15000, 'forfait', 'starting_from', 'draft', 'Hypothèses : Décor simple défini sans maquette longue Exclusions : Création artistique mosaïque multiple ou décor couvrant Justification : Minimum distinct d’une reliure de création complète.', 'faible', true),
  ('etui', 'mareliure-base-prices-v1', 14000, 'ouvrage', 'fixed', 'draft', 'Hypothèses : Étui papier ou toile standard ajusté Exclusions : Cuir boîte à chasses ou titrage Justification : Position centrale dans une grille publique par format.', 'faible', true),
  ('chemise', 'mareliure-base-prices-v1', 18000, 'ouvrage', 'fixed', 'draft', 'Hypothèses : Chemise à rabats standard Exclusions : Cuir intégral ou chemise-étui complexe Justification : Position basse à médiane de la grille publique par format.', 'faible', true),
  ('boite', 'mareliure-base-prices-v1', 25000, 'ouvrage', 'fixed', 'draft', 'Hypothèses : Boîte de conservation papier ou toile standard Exclusions : Cuir calage spécial titrage ou boîte à chasses Justification : Valeur de format standard dans la grille de boîte de conservation.', 'faible', true),
  ('coffret', 'mareliure-base-prices-v1', 22000, 'ouvrage', 'fixed', 'draft', 'Hypothèses : Coffret standard de protection Exclusions : Cuir boîte à chasses ou mécanisme complexe Justification : Valeur médiane prudente de la fourchette de coffrets observée.', 'faible', true),
  ('restauration_cuir', 'mareliure-base-prices-v1', 10000, 'ouvrage', 'starting_from', 'draft', 'Hypothèses : Consolidation ou réintégration localisée Exclusions : Cuir pulvérulent décor ancien ou démontage Justification : Minimum voisin d’une heure de restauration et d’une reprise localisée.', 'faible', true),
  ('restauration_papier', 'mareliure-base-prices-v1', 10000, 'ouvrage', 'starting_from', 'draft', 'Hypothèses : Traitement localisé sur ouvrage sans lavage Exclusions : Désacidification lavage lacunes nombreuses ou valeur patrimoniale Justification : Point de départ d’une intervention ciblée distincte de la réparation par feuillet.', 'faible', true),
  ('restauration_cartonnage', 'mareliure-base-prices-v1', 9000, 'ouvrage', 'starting_from', 'draft', 'Hypothèses : Reprise localisée de chant toile ou papier Exclusions : Cartonnage déformé décor lithographié ou remplacement complet Justification : Minimum d’une intervention de restauration ciblée.', 'faible', true),
  ('restauration_reliure_ancienne', 'mareliure-base-prices-v1', NULL, 'ouvrage', 'manual_review', 'draft', 'Hypothèses : Diagnostic complet Exclusions : Toute intervention sans devis personnalisé Justification : Le diagnostic doit choisir les opérations de conservation et les risques. Sur étude : État valeur et interventions de conservation déterminent entièrement le prix.', 'faible', true),
  ('restauration_patrimoniale', 'mareliure-base-prices-v1', NULL, 'ouvrage', 'manual_review', 'draft', 'Hypothèses : Diagnostic patrimonial Exclusions : Toute intervention sans devis personnalisé Justification : Le catalogue historique impose déjà le sur étude. Sur étude : Valeur patrimoniale traçabilité et responsabilité empêchent un forfait de départ utile.', 'low', true),
  ('rebind_collector', 'mareliure-base-prices-v1', 18000, 'ouvrage', 'starting_from', 'draft', 'Hypothèses : Rebind standard sur ouvrage courant Exclusions : Édition rare cuir haut de gamme ou décor sur mesure Justification : Positionné entre demi-cuir et plein cuir avec personnalisation légère.', 'faible', true),
  ('nouvelle_couverture', 'mareliure-base-prices-v1', 10000, 'ouvrage', 'fixed', 'draft', 'Hypothèses : Cartons et couvrure standard sans cuir Exclusions : Couture restauration ou décor Justification : Socle structurel au-dessus d’un Bradel et sous une pleine toile soignée.', 'faible', true),
  ('reliure_de_creation', 'mareliure-base-prices-v1', NULL, 'ouvrage', 'manual_review', 'draft', 'Hypothèses : Échange et conception préalables Exclusions : Toute réalisation sans devis personnalisé Justification : La source publique et le catalogue historique la placent sur devis. Sur étude : Conception matériaux et temps de recherche rendent tout forfait de départ trompeur.', 'faible', true),
  ('projet_sur_mesure', 'mareliure-base-prices-v1', NULL, 'ouvrage', 'manual_review', 'draft', 'Hypothèses : Cadrage préalable du projet Exclusions : Toute réalisation sans devis personnalisé Justification : Le catalogue historique la place sur étude. Sur étude : Le périmètre n’est défini qu’après échange avec le client.', 'faible', true)
ON CONFLICT (pricing_key, reference_version) WHERE status IN ('draft', 'published') DO NOTHING;

DO $$
DECLARE
  total_count INTEGER;
  numeric_count INTEGER;
  manual_count INTEGER;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE pricing_mode <> 'manual_review' AND default_unit_price_cents IS NOT NULL),
    count(*) FILTER (WHERE pricing_mode = 'manual_review' AND default_unit_price_cents IS NULL)
  INTO total_count, numeric_count, manual_count
  FROM public.marketplace_reference_default_prices
  WHERE reference_version = 'mareliure-base-prices-v1'
    AND status IN ('draft', 'published');

  IF total_count <> 45 OR numeric_count <> 41 OR manual_count <> 4 THEN
    RAISE EXCEPTION 'Grille Ma Reliure V1 invalide: %, % tarifs numériques, % sur étude', total_count, numeric_count, manual_count;
  END IF;
END
$$;

