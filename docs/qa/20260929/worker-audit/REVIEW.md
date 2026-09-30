# Essai Worker logistique — 29 septembre 2026

## Résultat

Le vrai bundle applicatif #52 a été construit avec la cible de test `qwfhebtxeubfmvvdsqdt`, puis lancé par `wrangler dev --local` (workerd, nodejs_compat). Aucun Worker hébergé créé, téléversé ou déployé.

Deux fichiers PNG valides et distincts de **4 194 304** et **5 242 880** octets ont été envoyés par HTTP à `uploadLogisticsPhoto`, avec JWT d'un véritable compte atelier QA. Deux réponses réussies ; téléchargement des objets privés par liens signés puis comparaison binaire intégrale. Le constat a exactement **2 associations SQL et 2 objets Storage** après les essais.

Même fichier rejoué : aucune duplication. Autre atelier et session absente : refusés. Base64 invalide et fichier de 5 Mio + 1 octet : refusés, sans nouvel objet. Les identifiants, tailles, empreintes et temps de réponse sont dans `results.json`. Le compte, l'ouvrage et le constat sont fictifs ; les preuves antérieures, y compris l'ancien objet isolé, sont conservées.

## Correctif

Le serveur utilise `Buffer.from(base64, "base64")` au lieu d'une boucle JavaScript sur chaque octet. Comme Buffer est permissif, une comparaison canonique base64 conserve un refus explicite des chaînes invalides. Les contrôles MIME, taille, atelier, constat, limite huit et reprise idempotente restent en place. Aucun SQL, droit ou paiement modifié.

## Ce que l'essai prouve et ne prouve pas

- Prouvé : chargement du bundle Worker réel, Auth réelle, décodage de 4/5 Mio, envoi et relecture dans Storage hébergé, protection des accès, absence de doublon.
- Non mesuré : CPU facturé et limites effectives du forfait Cloudflare de production. Les durées indiquées incluent le réseau local/hébergé, ce ne sont pas des mesures CPU. Aucun déploiement de recette n'a été effectué pour ce test.
- Le journal reste réservé à l'atelier. Il n'avance pas le dossier réseau ni l'écran de suivi du client.
- Les types publics concernés sont identiques à ceux régénérés depuis qwf ; aucune nouvelle migration ni signature.
- Les limites antérieures demeurent : appareil Safari/iOS physique, délivrabilité réelle, panne hébergée du nettoyage Storage et certains contenus historiques Fine Bindery français.

La publication reste une décision distincte, précédée de la CI du nouveau HEAD, du contrôle de l'assemblage, de la maintenance et de la sauvegarde restaurable. Aucun tarif ni garantie de transport annoncé.
