# Preuve CPU à obtenir avant ouverture des photos volumineuses

Lecture API du 30 septembre : Worker `mareliure`, compte `04a831172950eda4a2d9b22435dc114d`, modèle `standard`, date de compatibilité `2026-09-25`, `nodejs_compat`. Pas de champ `limits` retourné ; aucune limite CPU explicite confirmée. L'API des abonnements renvoie **403** avec la session OAuth existante. `standard` ne prouve pas le forfait Paid. Il manque la lecture Billing/Subscriptions du compte ou un relevé du tableau de bord authentifié indiquant le forfait Workers.

Référence officielle : https://developers.cloudflare.com/workers/platform/limits/ et https://developers.cloudflare.com/workers/platform/pricing/. Le plafond dépend du forfait ; ne pas substituer une valeur supposée à la configuration réelle. Les durées réseau du test workerd antérieur ne sont pas des mesures CPU.

## Essai représentatif préparé, non exécuté

1. Après autorisation distincte, créer un Worker de recette séparé, même compte/forfait, même bundle applicatif et mêmes paramètres de compatibilité. Aucun domaine public de production attaché. Cette consigne n'autorise pas sa mise en ligne.
2. Brancher uniquement une instance Supabase de recette explicitement autorisée et des comptes/ouvrages de recette. La présente préparation ne modifie pas qwf. Aucun secret de production dans ce Worker.
3. Rejouer le véritable endpoint d'ajout de photo, avec Auth, vérification d'appartenance, décodage, Storage et association SQL : PNG/JPEG/WebP valides de 1 Mio, 4 Mio et 5 Mio ; refus 5 Mio + 1 et base64 invalide ; concurrence et reprise. Inclure des démarrages à froid et au moins 20 appels chauds par taille, sans charger la production.
4. Collecter le **temps CPU Cloudflare par invocation**, l'issue et les erreurs de ressource via les métriques/trace du Worker de test. Conserver séparément durée murale et attente réseau. Épingler version Worker, SHA du bundle, octets/empreintes des fichiers, limite effective, médiane/p95/max CPU et absence de 1102. Vérifier les objets/associations et les octets téléchargés.
5. Critère : aucune invocation en dépassement et marge documentée par rapport au plafond effectif ; si données CPU indisponibles ou trop proches du plafond, arrêt pour optimisation/revue. Ne pas augmenter un forfait ou engager une dépense automatiquement.

**État : preuve de budget CPU non acquise.** L'accès technique de création Worker existe dans OAuth, mais son utilisation pour publier un Worker de test exige l'autorisation manquante. Aucun essai Node ou temps `fetch` ne sera présenté comme équivalent.
