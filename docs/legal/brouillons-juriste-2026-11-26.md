# Ma Reliure / Fine Bindery — brouillons juridiques pour validation par le juriste

Version du 26 novembre 2026. **Brouillons : aucun de ces textes n'est publié.** Chacun remplace une page du site qui décrit l'ancien modèle (Oppe vend au client final, confie le projet à un atelier, perçoit 3 % des paiements, abonnement 15 € HT).

## 0. Le modèle à couvrir (pivot du 22 novembre 2026)

- Ma Reliure (France) et Fine Bindery (international) sont un **outil de devis, de facture et de suivi de clientèle pour les relieurs et ateliers de restauration**.
- **L'atelier est le vendeur.** Il fixe ses prix, établit ses devis et ses factures, et contracte avec ses clients. Oppe n'est partie à aucun contrat entre l'atelier et son client.
- **Oppe n'encaisse aucun paiement de client final** et ne perçoit aucune commission ni aucun frais sur les ventes de l'atelier. Son revenu est l'abonnement de l'atelier.
- Abonnement : **19,90 € HT par mois** (Fine Bindery : 19,90 $), **14 jours d'essai gratuit sans carte bancaire**. Les ateliers déjà inscrits avant le pivot restent gratuits. Fin d'essai ou d'abonnement : lecture seule (plus de création de devis, de facture, ni de publication de vitrine) ; consultation et téléchargement des documents restent possibles. [À CONFIRMER : prélèvement par Stripe, aujourd'hui non ouvert ; la TVA applicable aux ateliers hors de France.]
- Le visiteur ou le client d'un atelier remplit une **demande de projet** sur le site ou le lien de l'atelier. Les données arrivent dans l'espace de l'atelier.
- **Rôles RGPD à valider :**
  - pour les données des clients de l'atelier, l'**atelier est responsable de traitement** et **Oppe son sous-traitant** (art. 28) ;
  - pour les données des ateliers (compte, facturation, usage), **Oppe est responsable de traitement** ;
  - pour la fréquentation anonyme du site, Oppe est responsable de traitement.
- Éditeur : OPPE SAS, SAS au capital de 100,00 €, 705 route du Montclair, 24160 Clermont-d'Excideuil, SIREN 943 317 610, RCS Périgueux, TVA FR55 943 317 610. Président et directeur de la publication : Antoine Ferrière. Contact : contact@oppe.fr.
- Prestataires techniques actuels : Cloudflare (hébergement de l'application, États-Unis) ; Supabase (base de données et photos, Union européenne, Irlande) ; Resend (e-mails) ; Lovable AI Gateway (analyse de photos et notes internes par intelligence artificielle) ; [Stripe, pour l'abonnement, à venir] ; [Sendcloud, transport, décision non prise].

**Questions pour le juriste**
1. Les relations Oppe/atelier relèvent-elles bien du B2B pur (exclusion du droit de la consommation) ? Que faire d'un relieur auto-entrepreneur qui contracte à titre personnel ?
2. Faut-il un accord de traitement séparé (§4) ou une annexe aux conditions d'abonnement ?
3. Droit applicable et juridiction pour les ateliers établis hors de France (Fine Bindery).
4. Rédaction de l'engagement de lecture seule en fin d'abonnement : durée de conservation des documents émis (obligation de conservation des factures).
5. Mention du rôle d'Oppe vis-à-vis du client de l'atelier, pour qu'aucune confusion de vendeur ne soit possible.
6. Transfert de données hors UE (Cloudflare, Resend, Lovable AI Gateway) : garanties à citer.
7. Information des clients finaux : qui l'assure, Oppe sur le site ou l'atelier dans ses propres pages ? Texte proposé en §3 volet A.

---

## 1. Conditions générales d'abonnement (remplacent « Conditions ateliers »)

**1. Objet.** Les présentes conditions régissent l'accès des ateliers de reliure et de restauration (« l'Atelier ») à l'outil Ma Reliure / Fine Bindery édité par OPPE SAS (« Oppe »). L'outil permet de recevoir des demandes de projet, d'établir des devis et des factures, de suivre sa clientèle et de publier une page vitrine.

**2. Qui contracte avec le client.** L'Atelier est seul vendeur de ses prestations. Il fixe ses prix, ses délais et ses conditions de vente, et reste seul responsable de ses devis, de ses factures, de ses engagements, de ses garanties et des taxes qu'il doit. Il choisit son régime de TVA (franchise en base, assujettissement, option éventuelle pour les débits) et les taux applicables à ses opérations : l'outil reproduit ce choix sur les documents sans le décider ni le conseiller, et l'Atelier en est seul responsable. Oppe n'est partie à aucun contrat entre l'Atelier et ses clients, n'intervient pas dans la négociation, ne garantit aucun volume de demandes et n'encaisse aucun paiement de leur part.

**3. Accès et compte.** L'outil est réservé aux professionnels. L'Atelier crée son compte avec une adresse e-mail professionnelle, renseigne ses informations légales et garantit leur exactitude. Il est responsable des personnes à qui il donne accès.

**4. Essai gratuit.** Tout nouvel Atelier bénéficie de 14 jours d'essai gratuit, sans carte bancaire et sans engagement. À la fin de l'essai, sans abonnement, le compte passe en lecture seule (article 7).

**5. Prix et paiement.** L'abonnement est de 19,90 € HT par mois (19,90 $ pour Fine Bindery), page vitrine comprise, TVA en sus lorsqu'elle est applicable. Il est facturé et prélevé mensuellement via Stripe. [À CONFIRMER : modalités, TVA, devise, facture.] Les ateliers inscrits avant le 22 novembre 2026 conservent la gratuité [À CONFIRMER : durée et conditions de maintien]. Oppe peut modifier le prix avec un préavis de [30] jours ; l'Atelier peut alors résilier sans frais.

**6. Durée et résiliation.** L'abonnement est mensuel et se renouvelle tacitement. L'Atelier le résilie à tout moment depuis son espace, avec effet à la fin de la période payée, sans remboursement de la période en cours. Oppe peut suspendre ou résilier en cas de manquement grave, après mise en demeure restée sans effet sous [8] jours, sauf urgence ou fraude.

**7. Fin d'abonnement : lecture seule.** À la fin de l'essai ou de l'abonnement, l'Atelier ne peut plus créer de devis ni de facture, ni publier ou modifier sa vitrine. Il conserve la consultation et le téléchargement de ses documents, dont ses factures émises, pendant [durée à fixer, au moins la durée légale de conservation]. Les données personnelles de ses clients sont ensuite supprimées ou restituées selon l'accord de traitement (§4).

**8. Contenus de l'Atelier.** L'Atelier reste titulaire des contenus qu'il publie (textes, photos, réalisations) et garantit détenir les droits nécessaires, notamment sur les photos de ses clients : il ne publie une réalisation qu'avec leur consentement. Il concède à Oppe le droit de les héberger et de les afficher pour faire fonctionner sa vitrine.

**9. Intelligence artificielle.** Des agents d'intelligence artificielle proposent des analyses ou des rédactions. Ils ne décident jamais : l'Atelier relit, corrige et valide tout avant envoi à un client. Il demeure responsable de ses devis et de ses documents.

**10. Disponibilité et responsabilité d'Oppe.** Oppe s'efforce d'assurer la disponibilité de l'outil, sans garantie d'absence d'interruption. Sa responsabilité est limitée aux dommages directs, dans la limite des sommes versées par l'Atelier au cours des [12] derniers mois, sauf faute lourde ou dolosive. Oppe n'est pas responsable des prestations de l'Atelier. [Clause à valider.]

**11. Données personnelles.** Oppe traite les données de compte de l'Atelier comme responsable de traitement (politique de confidentialité, volet B). Pour les données de ses clients, l'Atelier est responsable de traitement et Oppe son sous-traitant, selon l'accord de traitement (§4).

**12. Droit applicable et litiges.** Droit français. Tribunaux de [Périgueux] [À VALIDER pour les ateliers hors de France]. Médiation et règlement amiable avant toute action : contact@oppe.fr.

**13. Évolution.** Oppe peut modifier ces conditions ; l'Atelier en est informé [30] jours avant leur entrée en vigueur.

---

## 2. Conditions d'utilisation du site (remplacent la page actuelle)

**Objet.** Ces conditions encadrent l'accès au site Ma Reliure (et Fine Bindery) édité par OPPE SAS, dont les mentions légales figurent sur le site.

**Deux usages.**
- *Atelier :* il crée un compte et utilise l'outil selon les conditions générales d'abonnement.
- *Visiteur d'un atelier :* lorsqu'il envoie une demande de projet depuis le site ou le lien d'un atelier, il s'adresse directement à cet atelier. L'atelier est seul vendeur ; c'est lui qui répond, établit un devis et facture. Ma Reliure fournit l'outil qui transmet la demande, n'est pas partie au contrat et n'encaisse aucun paiement.

**Aucun engagement.** L'envoi d'une demande de projet ne constitue ni une commande ni une acceptation. Un prix n'est ferme qu'une fois indiqué dans le devis de l'atelier. Les conditions de vente applicables à la prestation sont celles de l'atelier.

**Vos informations et vos photos.** Vous ne transmettez que des informations et des photos dont vous avez les droits. Les photos de votre livre ne sont jamais publiées par Oppe ; un atelier ne peut publier une réalisation qu'avec votre accord.

**Utilisation du site.** Pas d'usage abusif, automatisé ou illicite ; pas de tentative d'accès aux comptes d'autrui.

**Propriété intellectuelle.** Le site, ses textes, ses marques et ses éléments graphiques appartiennent à Oppe ou à ses concédants. [Reprendre le texte actuel.]

**Disponibilité.** Le site est fourni sans garantie de disponibilité continue.

**Données personnelles.** Voir la politique de confidentialité.

**Évolution et droit applicable.** Droit français ; Oppe peut faire évoluer ces conditions.

---

## 3. Politique de confidentialité — deux volets

### Volet A — Vous avez écrit à un atelier, ou visité le site

**Qui est responsable.** Lorsque vous envoyez une demande de projet à un atelier, **l'atelier est responsable de vos données** et décide de ce qu'il en fait. OPPE SAS, qui exploite l'outil Ma Reliure / Fine Bindery, les traite pour son compte et sur ses instructions, uniquement pour faire fonctionner l'outil. Pour la mesure de fréquentation du site et la sécurité du service, OPPE SAS est responsable de traitement.

**Ce que vous transmettez.** Ce que vous décrivez de l'ouvrage et du projet (titre, auteur, nature, dimensions, état, travaux souhaités, valeur et budget indicatifs, délai), les photos ajoutées, et vos coordonnées (nom, e-mail, téléphone, code postal et ville).

**Pourquoi.** Permettre à l'atelier de répondre à votre demande, de vous chiffrer le travail et de vous suivre ; vous envoyer le récapitulatif de votre demande ; protéger le service contre les abus ; mesurer de façon agrégée l'usage du site.

**Sur quelle base.** Votre consentement à l'envoi de la demande, et les mesures précontractuelles prises à votre demande. Vous pouvez retirer votre consentement à tout moment.

**Qui y a accès.** L'atelier destinataire et son équipe ; l'équipe technique d'Oppe, pour le support et la sécurité. Vos données ne sont ni vendues ni louées. Oppe ne les transmet à aucun autre atelier. Les photos de votre livre ne sont jamais publiées sans votre accord.

**Données techniques.** Votre adresse IP est transformée en empreinte non réversible. La fréquentation est mesurée de façon anonyme, sans cookie.

**Prestataires.** Cloudflare (hébergement), Supabase (base et photos, Union européenne), Resend (e-mails), Lovable AI Gateway (analyse de photos et notes internes par intelligence artificielle, qui ne décide jamais d'un prix). Certains sont établis hors de l'Union européenne ; [garanties : clauses contractuelles types / cadre de protection des données UE-États-Unis, À CONFIRMER].

**Durée.** Le récapitulatif de votre demande reste accessible 90 jours. Vos données sont conservées par l'atelier le temps de la relation commerciale puis selon ses obligations légales ; [durées à fixer avec l'atelier et Oppe].

**Vos droits.** Accès, rectification, effacement, limitation, opposition, portabilité, retrait du consentement, directives après décès. Adressez-vous d'abord à l'atelier ; vous pouvez aussi écrire à contact@oppe.fr, qui transmettra. Réclamation possible auprès de la CNIL (cnil.fr).

### Volet B — Vous êtes un atelier

**Responsable.** OPPE SAS, pour les données de votre compte, de votre abonnement et de l'usage de l'outil.

**Données.** Identité et coordonnées professionnelles, informations légales (SIRET, adresse, TVA), identifiants de connexion, journaux d'usage, données de facturation de l'abonnement, contenus de votre vitrine.

**Finalités et bases.** Exécution du contrat d'abonnement ; facturation et obligations comptables ; sécurité et prévention de la fraude ; amélioration du service (intérêt légitime) ; communications liées à votre compte.

**Destinataires.** Équipe Oppe ; prestataires listés ci-dessus ; [Stripe pour l'abonnement]. Aucune vente de données.

**Durée.** Pendant l'abonnement, puis [durée] ; données comptables selon les durées légales.

**Vos droits.** Les mêmes que ci-dessus, auprès de contact@oppe.fr.

---

## 4. Accord de traitement des données (Oppe sous-traitant de l'atelier, art. 28 RGPD)

**Parties.** L'Atelier (responsable de traitement) et OPPE SAS (sous-traitant). Cet accord est annexé aux conditions générales d'abonnement.

**Objet et durée.** Hébergement et traitement des données des clients et prospects de l'Atelier saisis ou reçus dans l'outil, pendant la durée de l'abonnement et de la période de lecture seule.

**Nature et finalités.** Collecte des demandes de projet, stockage des fiches, devis, factures et photos, envoi d'e-mails à la demande de l'Atelier, analyses d'assistance par intelligence artificielle sur instruction de l'Atelier.

**Catégories de données et de personnes.** Identité et coordonnées, description de leurs ouvrages, photos, historique des échanges et des devis ; clients et prospects de l'Atelier.

**Obligations d'Oppe.** Traiter les données uniquement sur instruction documentée de l'Atelier ; garantir la confidentialité des personnes autorisées ; mettre en œuvre des mesures de sécurité appropriées (cloisonnement des comptes par atelier, chiffrement en transit, contrôle d'accès, journalisation) ; aider l'Atelier à répondre aux demandes d'exercice de droits ; l'assister en cas de violation (notification dans les meilleurs délais, [48 h] maximum après en avoir eu connaissance) ; supprimer ou restituer les données à la fin du contrat au choix de l'Atelier ; mettre à disposition les informations utiles à un audit.

**Sous-traitants ultérieurs.** L'Atelier autorise ceux-ci : Cloudflare (hébergement), Supabase (base et fichiers, UE), Resend (e-mails), Lovable AI Gateway (intelligence artificielle) ; [Stripe, Sendcloud selon décision]. Oppe informe l'Atelier de tout changement avec un préavis de [30] jours ; l'Atelier peut s'y opposer.

**Transferts hors UE.** Encadrés par [clauses contractuelles types / cadre applicable, À CONFIRMER].

**Responsabilité de l'Atelier.** Il garantit la licéité de la collecte, informe ses clients (le volet A de la politique de confidentialité peut y servir) et recueille les consentements nécessaires, notamment avant publication d'une photo.

---

## 5. Conditions générales de vente actuelles

Les CGV du site décrivent la vente d'Oppe au client final (commande, prix, droit de rétractation, exécution, transport aller-retour). Ce n'est plus le modèle : **Oppe ne vend plus rien au client final.** Proposition : retirer la page, rediriger l'adresse vers les conditions d'utilisation, et laisser chaque atelier publier ses propres conditions de vente. Oppe peut fournir à l'atelier un modèle de conditions de vente à joindre à ses devis : [à rédiger si le juriste le recommande]. À trancher aussi : le sort du transport aller-retour (Sendcloud), dont la décision est en suspens.
