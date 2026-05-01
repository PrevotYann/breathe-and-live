# Breathe and Live - Backlog Foundry VTT v12.343

Source unique de ce backlog : `resources/rules/Breathe-and-Live.pdf`.

Objectif : couvrir le plus completement possible les regles du PDF dans un systeme Foundry VTT v12.343, avec automatisation maximale quand la regle est mecanique, et aide de jeu explicite quand la regle depend du MJ ou manque de donnees numeriques.

## Points d'entree actuels du systeme

- `system.json` : systeme `breathe-and-live`, compatibilite Foundry v12.343, packs declares.
- `template.json` : schemas Actor et Item deja larges.
- `module/breathe-and-live.mjs` : initialisation, enregistrement des sheets, calculs derives acteur.
- `module/rules/action-engine.mjs` : attaques, reactions, soins, repos, poisons, actions demoniaques.
- `module/rules/breath-effects.mjs` : passifs de souffles et etats avances.
- `module/chat/use-technique.mjs` : execution des techniques et cartes de reaction.
- `module/config/rule-data.mjs` : constantes de souffles, rangs, etats, mutilation, demons.
- `templates/actor/*.hbs` et `templates/item/*.hbs` : feuilles acteur/item.
- `packs/*` et `packs/_source/techniques-breaths/*` : compendiums et sources de techniques.

## Fonctionnalites a implementer depuis le PDF

### 1. Types d'acteurs

- Pourfendeur de demons jouable.
- Demoniste jouable.
- Demon jouable.
- PNJ humain.
- PNJ demon.
- Compagnon / corbeau Kasugai / autre oiseau.
- Profils de Hashira / Kakushi / soutien / boss.

Automatisation attendue :

- Creation d'acteur avec type, rang, niveau, ressources, equipement initial.
- Recalcul automatique des valeurs derivees selon le type.
- Fiche differenciee ou sections conditionnelles par archetype.

### 2. Creation de personnage

- Methodes de statistiques de base : jet de 6d6 assignables ou tableau `0,1,2,3,4,5`.
- Choix du style : Pourfendeur ou Demoniste au depart ; Demon jouable via section dediee.
- Contexte entraineur en 3 axes de 0 a 2 points.
- Contexte partenaire / corbeau Kasugai en 3 axes de 0 a 2 points.
- Corbeau Kasugai : type d'oiseau, opinion, commandes connues.
- Pool de depart de 15 points a depenser entre formes de Souffle, capacites extrasensorielles et caracteristiques surhumaines.
- Equipement de depart par classe.

Automatisation attendue :

- Assistant de creation ou onglet creation avec validation des points.
- Boutons de tirage / assignation des stats.
- Generation des ressources de depart.
- Creation automatique du compagnon Kasugai optionnel.
- Ajout automatique des objets de depart depuis compendium.

### 3. Statistiques de base et derivees

Stats de base :

- Force.
- Finesse.
- Courage.
- Vitesse.
- Social.
- Intellect.

Stats derivees :

- Force : Athletisme, Puissance brute.
- Finesse : Dexterite, Equilibre, Precision.
- Courage : Mithridatisme, Endurance, Tolerance.
- Vitesse : Reflexes, Agilite, Rapidite, Ruse.
- Social : Manipulation/Tromperie, Performance, Intimidation, Perception, Intuition.
- Intellect : Medecine, Nature, Sciences, Enquete, Survie.

Automatisation attendue :

- Limiter les points derivees depenses a la stat de base par groupe.
- Jets d20 avec modificateur de stat de base = stat - 1.
- Jets d20 de stat derivee = valeur derivee + bonus vetement/equipement/capacite.
- Exposer les jets depuis la fiche et chat.

### 4. Ressources derivees

- PV de depart humain : 20.
- Endurance : `20 + Courage`.
- CA : `10 + Vitesse`.
- RP initiaux : `5 + Vitesse + Intellect`.
- RP recuperes seulement apres 8h de repos.
- Si Endurance tombe a 0 : repos force un tour, pas d'attaque ; inconscience si pas de Souffle de recuperation pendant 2 rounds.
- Demoniste BDP max : `10 + Courage`.
- Demonisation max : `10 + Courage`.
- Demon BDP max : `10 x Courage`.
- Demon PV : PV de corps + `5 x Force`.
- Demon RP : RP calcules normalement puis divises par 2.
- Demon actions par tour : `1 + Vitesse / 5`.
- Humain actions par tour : 1 action par tranche de 10 points de Vitesse.

Automatisation attendue :

- Calcul centralise dans une seule couche.
- Verrouillage ou indication des champs calcules.
- Boutons repos court/long selon les ressources a restaurer.
- Gestion de l'inconscience Endurance 0.

### 5. Capacites extrasensorielles

Sens :

- Odorat, Ouie, Vue, Gout, Toucher.
- Chaque sens coute 3 points au niveau 1.
- Ameliorable par l'etude jusqu'au niveau 3.
- N1 : +3 aux tests de perception lies au sens.
- N2 : +4 et detection de demons a 9 m.
- N3 : +5, detection a 18 m et capacite speciale selon le sens.

Capacites N3 :

- Odorat : determiner le niveau d'un demon a proximite.
- Ouie : determiner PV humains/demons a proximite.
- Vue : predire l'action d'un demon au debut de son tour.
- Gout : determiner les stats d'un demon consomme/goute.
- Toucher : determiner PV, RP et BDP d'un demon touche.

Automatisation attendue :

- Items `sense` avec niveau, bonus, portee et capacite N3.
- Bonus automatiques sur jets de perception du sens concerne.
- Aides MJ / boutons de revelation de stats pour capacites N3.

### 6. Caracteristiques surhumaines

- Parties du corps renforcees : +2 armure naturelle, -8 degats sur zone choisie.
- Force physique accrue : +3 Force en combat, +6 Puissance brute permanent.
- Agilite et souplesse accrues : +3 Finesse en combat, +6 Dexterite permanent.
- Intelligence superieure : +3 Intellect en combat, +3 a toutes les derivees permanent.
- Connaissances medicales : soin automatique `1d6+2` avec bandages/materiel.
- Maitrise des armes a feu : attaque distance auto contre cible sans RP utilise.
- Esprit : technique de respiration ultime 1/combat sans force vitale requise.
- Sang resistant : poisons de disciples de rang <= joueur sans effet.
- Genie : techniques de rang superieur 2 niveaux plus tot ; acces Souffle du Soleil.
- Estomac d'acier : +1 de BDP en consommant de la chair demoniaque, prerequis Demoniste.

Automatisation attendue :

- Items `feature` avec cout, prerequis, effets actifs.
- Application au combat via effets temporaires ou permanents.
- Validation dans l'assistant de creation.

### 7. Capacites humaines et economie d'action

- Attaque.
- Utilisation d'objet.
- Attendre.
- Deplacement avant/apres action.
- Sprinter : distance supplementaire selon vitesse de deplacement.
- Eviter sans RP : jet de Finesse oppose au jet d'attaque ; echec interdit ensuite l'usage de RP contre cette attaque.
- Demande d'assistance.
- Utilisation des corbeaux.
- Demande d'objets / livraison Kakushi.
- Conduite.
- Repos.
- Actions hors attaque : changer d'arme, recharger, revetement d'arme, fabrication, commander corbeau, Souffle de recuperation, amelioration demoniste, consommation de chair.
- Actions bonus.

Automatisation attendue :

- Barre d'actions rapide.
- Compteur d'action / reaction par tour.
- Cartes chat avec boutons : esquive RP, eviter sans RP, contre-attaque, prendre degats, deflecteur.
- Workflow de livraison Kakushi au moins sous forme de journal/commande avec quantites par mission.

### 8. Points de reaction

Reactions generales :

- Esquive 1 RP : esquive automatique.
- Esquive 2 RP : tirer une cible vers soi.
- Attaque 1 RP : attaque hors tour.
- Attaque 2 RP : coup assure meme contre parade.
- Degainage 1 RP : changer d'arme sans action.
- Degainage 2 RP : attaquer avec cette arme puis revenir a l'arme precedente.
- Medical 1 RP : reussite auto d'un test medecine ou activation d'un soin.
- Medical 2 RP : soin maximum ou test medecine auto.
- Soin demoniste 1 RP : jet de soin selon rang du sang consomme.
- Soin demoniste 2 RP : soin maximum du meme de.

Automatisation attendue :

- Reactions verrouillees tant que non debloquees, sauf esquive de depart.
- Depense RP depuis chat.
- Actions de reaction ciblees soi/allie.
- Journal de depense RP.

### 9. Attaques de base, armes et projectiles

Armes de base :

- Mains nues `1d4 + Force`.
- Lame Nichirin standard `1d6`, 1.5 m.
- Lame courbee `1d8`, 1.5 m.
- Wakizashi `1d4`, 1.5 m.
- Pointe fine `1d4`, 1.5 m, poison automatique au rangement.
- Lames dentelees `2d6`, 1.5 m.
- Masse Nichirin `1d12`, 9 m.
- Fouet Nichirin `1d10`, 9 m.
- Double epee-chaine Nichirin `2d10`, 3 m.
- Pistolet `1d8`, portee a representer selon table.
- Fusil `1d12`, portee a representer selon table.
- Fusil de tranchee `3d6`.
- Projectiles simples : arbalete, arc, kunai, shuriken.
- Grenades, Molotov, lance-flammes, bombes, kunai de glycine.

Regles :

- Attaques de base necessitent un jet pour toucher contre CA.
- Bonus de Force ou Finesse au toucher ; le bonus non utilise va aux degats.
- Armes a feu : jet Finesse en combat, Precision aux degats ; hors combat Precision pour toucher.
- Recharger une arme a feu prend une action complete.
- Personnalisations : silencieux, chargeur etendu, lunette, baionnette, crosse.

Automatisation attendue :

- Attaque de base generique par arme equipee.
- Gestion munitions/rechargement.
- Support melee/distance/projectile/zone.
- Modifications d'armes sous forme d'items ou sous-documents.
- Auto-hit conditionnel pour maitrises debloquees.

### 10. Effets de combat

Effets :

- Brulure : 1 degat feu par tour.
- Saignement : `1d4` PV par tour, soigne par bandages ou Souffle de recuperation avec TCB permanent.
- Gel : membre/corps inutilisable `1d4` tours.
- Fureur : attaque toute cible a portee avec attaques de base.
- Ralenti : une action tous les deux tours.
- Triste : test Endurance DD 15.
- Emprisonne : pas de mouvement jusqu'a liberation.
- Equilibre perturbe : pas de RP pour le reste du tour.
- Paralyse : pas de mouvement, parole possible.
- Controle : perte de controle par BDA.
- Empoisonne : penalites ou degats selon poison.
- Charme : ne peut pas blesser le charmeur, traite ses ennemis comme les siens.
- Aveugle, Sourd, Anosmie, Paresthesie, Ageusie : echecs auto sur perceptions du sens.
- Enfume : -1 Endurance/tour/niveau ; a 10 niveaux, inconscience.
- Maudit : effet persistant jusqu'a mort ou levee.

Automatisation attendue :

- Registre de conditions avec intensite, duree, formule de tour.
- Application/removal depuis fiche et chat.
- Effets automatiques au debut du tour.
- Etiquettes visibles sur fiche/token.

### 11. Mutilation et blessures graves

- Ciblage d'un membre ou appendice.
- Membre/appendice : seuil souvent 10% a 20% des PV totaux.
- Humains : pertes cumulables sur plusieurs tours.
- Demons : degats requis en une seule attaque pour arracher.
- Bras humain/demon : seuil 20% PV totaux.
- Jambes : seuil 20% PV totaux.
- Demon bras : degats des bras divises par 2.
- Demon jambes : vitesse divisee par 2.
- Ailes : vol impossible.
- Queues : vitesse -3 m.
- Tentacules : vitesse -10% par tentacule.
- Blessures graves 13-20 degats : organe contusionne ou os fracture.
- Blessures quasi mortelles 20+ : membres perdus ou organes perfores.
- Chaque blessure grave/quasi mortelle reduit le maximum soignable de 10% jusqu'a chirurgie/medecin.

Automatisation attendue :

- Systeme de ciblage de membre dans les attaques.
- Calcul de seuil selon PV max et type de cible.
- Suivi humain cumulatif vs demon single-hit.
- Effets de membre sur attaque, deplacement, vol, soins.
- Workflow medical pour restaurer le maximum soignable.

### 12. Classe Pourfendeur

- Progression Mizunoto a Hashira.
- Gains par rang : stats, PV, slots d'etude, endurance, des d'arme, bonus de formes, RP Hashira.
- Souffle de recuperation : action, recupere `1d8 par rang` d'Endurance, interdit pendant TCB actif.
- Techniques de souffle : touchent automatiquement sauf esquive RP, coutent Endurance, hors combat utilisables pour obstacles.
- Apprentissage post-creation via slot d'etude.
- Equipement de depart : arme de souffle, pistolet au choix, bandages/pansement compressif ou kit de premiers secours.

Automatisation attendue :

- Montee de rang guidable avec choix de stat.
- Application des gains.
- Import/drop de techniques valide par souffle/prerequis.
- Souffle de recuperation avec rang et forme marquee.

### 13. Souffles canoniques et homebrew

Souffles a representer :

- Soleil : prerequis Genie + Katana Nichirin ; Elu, cout /2, degats x3 en Marque, progression avancee speciale.
- Lune : bonus en combat solitaire contre demons, de de degats supplementaire.
- Flamme : Coeur flamboyant, 1/jour, degats doubles pendant un round.
- Eau : Devier les vagues, reaction de deviation d'attaques a distance.
- Vent : Vents de guerre, `1d2` RP sur decapitation de demon.
- Foudre : Vitesse de la lumiere, dash reaction 6 m.
- Pierre : Machoire et hache, bascule masse/hache, Force+6 sans decapitation ou Finesse+2 avec decapitation.
- Fleur : Concentration florissante, +2 cumulatif degats/esquive contre cible continue.
- Brume : Nuages trainants, cases traversees couvertes, double bonus CA en voile.
- Serpent : Forme libre, ignore terrain difficile/grappins/ralentissements et riposte.
- Son : Score de combat, `1d4 par rang demon - Intellect` rounds de desavantage puis avantage.
- Insecte : avantage toucher/degats contre cible empoisonnee, esquives doublees contre elle.
- Amour : sphere tranchante sans allies/tirs amis.
- Bete : Dislocation pour garantir une attaque contre demon qui reagit.
- Ocean : degats /2 sur terre, x1.5 dans l'eau.
- Ouest : Six-coups, tir gratuit apres forme de respiration, non automatique.
- Neige : Dents de Katana, cible perd `1d4` CA jusqu'a fin du round.

Automatisation attendue :

- Item `breath` + item `technique` pour chaque forme.
- Champs structures : prerequis, stat, cout E, portee, degats, zone, ligne, charge, recharge, deflecteur, regeneration, affliction, poursuivant, fauchage, decapitation.
- Effets passifs automatises quand possible.
- Marquer les formes sans donnees numeriques detaillees comme `TODO-RULEBOOK-AMBIGUITY`, sans inventer.

### 14. Construction de souffle personnalise

Tables du PDF :

- Ratio Endurance/Degats : `1d6=-1`, `1d8=0`, `1d10=1`, `1d12=2`, `2d8=3`, `3d6=5`, `1d20=6`, `3d8=9`, `4d8=12`, `2d20=13`, `3d20=16`.
- Ratio Endurance/Distance : Cac `-3`, 3 m `1`, 4.5 m `2`, 6 m `3`, 7.5 m `4`, 9 m `5`.
- Effets : Direct `-3`, Charge `-5`, Distance `3`, Regenerateur `3`, Deflecteur/Negateur `4`, Affliction `3`, Poursuivant `3`, Fauchage `2`.
- Armes Nichirin a portee deja longue ne paient pas d'endurance jusqu'a leur portee de base.

Automatisation attendue :

- Calculateur de cout de technique maison.
- Validation d'un effet principal par forme.
- Creation d'un item technique depuis le calculateur.

### 15. Sous-classes de Pourfendeur

Sous-classes listees :

- Katana : Voie de l'Eau Broyeuse, Pierre Sculptee, Vent Percant, Feu Protecteur.
- Lames dentelees : Croc du Sanglier, Croc de l'Ours.
- Lame torsadee : Lame Orochi, Lame Tsuchinoko.
- Pointe aceree : Ecole du Scarabee, Ecole de la Guepe.
- Masse et Chaine : Etoile du Matin, Grande Epee.
- Lame Fouet : Don de Cadeaux, Actes de Service.
- Double tronconneuse : Style Kabuki, Style Nihon Buyo.

Regle :

- Progression de sous-classe au depart, puis Kanoe, Hinoto, Kinoe.

Automatisation attendue :

- Compendium `techniques-subclasses`.
- Features passives de depart.
- Gains de rang.
- Reactions et attaques utilisables depuis fiche.
- Charges 1/jour, 1/rencontre, 3/jour.

### 16. Classe Demoniste

- Progression Mizunoto a Hashira, remplace endurance par bonus BDP/action repetee/Nichirin.
- BDP obtenus uniquement en consommant de la chair de demon.
- BDP par chair : Rang faible `1d4+1`, Rang eleve `2d4+2`, Disciple LI `1d10+3`, LI `2d6+4`, Disciple LS `3d6+5`, LS `1d20+8`.
- BDP max : `10 + Courage`.
- Action repetee : degats augmentent a chaque tour d'utilisation, bonus ajoute a Force.
- Guerison demoniaque selon rang du sang consomme recemment.
- Reactions demonistes : soin 1/2 RP, amelioration Force/Vitesse 1/2 RP.
- Demonisation : augmente a chaque point de sang utilise, seuil `10 + Courage`, reset repos long, -2 par heure.
- Medecine Active Demoniste : accumulation demonisation -50% pendant le combat.
- Medecine de Reparation Demoniste : demonisation actuelle /2.
- Pouvoirs de demonisation : Force demoniaque, Vitesse demoniaque, Soin, Regeneration membre, BDA petit/grand, regeneration continue, stockage BDA, Expulsion.
- Equipement de depart : fusil de tranchee, wakizashi.
- Sous-classes : Wakizashi / Tireur d'elite ; Epee / Couteau a viande.

Automatisation attendue :

- Bouton consommer chair avec rang.
- BDP, demonisation et sang recent.
- Capacites demonistes comme items utilisables avec cout BDP et gain demonisation.
- Effets temporaires Force/Vitesse selon benchmark demon.
- Expulsion et cout PV.
- Sous-classes demonistes data-driven.

### 17. Progression generale et competences de niveau

- Slots de competences gagnes par rangs.
- Entrainement Hashira : ajout d'une competence.
- Vaincre seul un demon lunaire : slot gratuit.
- Competences tous niveaux : augmentation degats de forme, souffle secondaire.
- Demonistes tous niveaux : formation guerison, palais raffine.
- Communes : combat mains nues, amelioration armes, sante +10, endurance +15, deux armes, ameliorer sens.
- Mizunoe : entrainement au combat, cardio, permis conduire, specialiste poisons, tireur elite, social +5.
- Kanoe : changement arme rapide, formation medicale, +5 stats, flexibilite.
- Tsuchinoe : maniement parfait, armes a feu auto-hit, Bourreau.
- Hinoe : Guillotine, Ombre de la mort.
- Competences avancees : TCB Constant, Forme Marquee, Monde Transparent, Lame Rouge.

Automatisation attendue :

- Compendium de features de progression.
- Deverrouillage par rang.
- Application des passifs et reactions.
- Suivi des slots et competences deja prises.

### 18. Etats avances

- TCB Constant : pas de cout de maintien, +1 Endurance/tour, saignement stoppe via Souffle de recuperation, ajoute au rang Kanoto.
- Forme Marquee : degats de souffle avec avantage, Souffle recuperation x2, ajoute au rang Tsuchinoe.
- Monde Transparent : techniques sans Souffle crit auto sur reussite, attaques contre le personnage avec desavantage, ajoute au rang Hinoe.
- Lame Rouge : demons touches ne guerissent pas ce tour, degats x2 contre demons, ajoute au rang Kinoe.

Automatisation attendue :

- Toggles visibles.
- Effets de tour et chat.
- Impact sur jets/degats/reactions/regeneration.

### 19. Objets, poison, fabrication, medecine

- Armes alternatives : Odachi implementable ; Naginata/Cimeterre/Patta/Epee crochet marques TBD.
- Armes a feu 1934/Taisho : Mauser C96, Nambu Type 14, Colt M1911, Type 38 Arisaka, Winchester 1895, Mauser 98k.
- Munitions : standard, pointe creuse, souffle du dragon, fusil, fusil a pompe.
- Modifications : silencieux, chargeur etendu, lunette, baionnette, crosse.
- Poisons : affaiblissant, nuisible, glycine affaiblissant, glycine endommageant, accumulation.
- Kits : culture poison, remede poison demon.
- Fabrication : DD selon nombre de composants, 1->4, 2->6, 3->8, 4->10, 5->12, 6->14.
- Medical : bandage `1d4 + Medecine`, pansement compressif `1d8 + Medecine`, attelle, trousse `1d20 + Medecine`, equipement chirurgical soin complet, seringue sang demon, injecteur jet, analgesiques.

Automatisation attendue :

- Items avec usages, charges, couts, quantite, effets.
- Application poison sur arme en une action.
- Degats/penalites poison au debut du tour.
- Fabrication semi-automatisee avec composants et DD.
- Soins avec cap `healableMax`.
- Soin complet et risques critiques documentes.

### 20. Transports, vetements, nourriture, mort

Transports :

- Conduite detendue : test Finesse.
- Danger route : test Reflexes.
- Appel Kakushi via radio/corbeau.
- Voitures : Ford Modele T, Datsun Type 10, Mitsubishi Modele A avec cout et bonus.

Vetements :

- Categories civiles : civil, elegant, flashy, nuit, agricole.
- Professionnels : uniforme tueur +1 CA, police +1 intimidation/acces, garde/acces, artiste/acces.
- Camouflage social : detection par test Intuition PNJ.

Nourriture :

- Recuperation Endurance +5/+10.
- Bonus Endurance temporaire +10.
- Snacks relationnels/couts.

Mort :

- A 0 PV, le personnage est mort sauf sauvegarde/ressusciter/abandon ou regle MJ.
- Certains objets/capacites empechent de descendre a 0.

Automatisation attendue :

- Items transport/vetement/food avec bonus.
- Jets conduite depuis transport.
- Endurance temporaire separee ou notee.
- Etat vital clair et workflow a 0 PV.

### 21. Demons jouables et PNJ demons

Creation demon :

- 3 points pour corps/mouvement/dangerosite.
- Corps : humain 20 PV, animal 40 PV, monstrueux 60 PV.
- Mouvement : 9 m, 13.5 m, 18 m.
- Dangerosite : `1d4`, `1d6`, `1d8`.
- Base stats : `0,1,2,3,3,5` + paquet de rang.
- Rangs : faible, eleve, Disciple LI, LI, Disciple LS, LS.
- Paquets de stats par rang.
- Benchmarks PNJ : stats, PV/CA, morsure, griffure, BDA, RP.

Actions demoniaques :

- Guerison `2 BDP`.
- Repousse `4 BDP`.
- Purification : 1 stack poison par niveau de rang.
- Infecter : Lunes inferieures/superieures, humain devient demon 4 rangs plus bas.
- SOS de lignee.
- Executer : Disciple LI ou plus, humain a 5 PV ou moins, impossible a esquiver mais reactions possibles.
- Attaquer, Bloquer, Esquiver.
- Degats de Force/Finesse ajoutes a moitie.

Automatisation attendue :

- Assistant de creation demon.
- Changements de rang avec confirmation.
- Actions demoniaques rapides.
- Regeneration/membre et blocage par Lame Rouge.
- Infection sous forme de flag/condition transformable.

### 22. Supplement 1934

- Toggle monde/supplement.
- Etat du Corps apres Muzan, Kakushi modernises, radios/transport/medecine avancee.
- PNJ nommes : Kaisho Ubuyashiki, Hashira actuels.
- Exemple Hashira de l'Ocean : PV, Endurance, RP, stats, attaques, formes.
- Nouvelle ere demoniaque : Arbre du Mal.
- Variants/lignes de Lune : Or, Brulante, Enragee, Mecanique, Ancienne, Miroir, Ombree, Endeuillee, Jardin, Artisane, Submergee, Patchwork.

Automatisation attendue :

- Setting systeme pour afficher/masquer contenu 1934.
- Packs supplementaires d'acteurs, souffles, techniques, demons.
- Lignes demon en tags/traits/compendiums.

### 23. Compendiums obligatoires

- Acteurs - Pourfendeurs : au moins 3.
- Acteurs - Demonistes : au moins 2.
- Acteurs - Demons : au moins 4.
- Items - Weapons.
- Items - Medical & Utility.
- Souffles - Styles.
- Techniques - Souffles.
- Techniques - Subclasses.
- Abilities - Demons.
- Supplement 1934 - souffles/techniques/acteurs si active.

Standard d'entree :

- Nom localise.
- Section source PDF.
- Texte de regle concis.
- Champs mecaniques structures.
- Tags.
- Prerequis.
- Note d'usage.
- Pas de placeholder vide sauf marque explicitement `donnees numeriques manquantes`.

### 24. Feuilles, UX et chat

- Ressources visibles : PV, CA, Endurance, RP, BDP, Demonisation, rang, classe, arme.
- Techniques filtrables/recherchables.
- Conditions et mutilations visibles sans dialogue profond.
- Boutons combat : attaque, souffle recuperation, sprint, attendre, repos, soin, consommer chair, actions demon.
- Chat cards explicatives : cout, portee, cible, degats potentiels, reactions, resultats.
- Feuilles item : arme, arme a feu, transport, souffle, technique, objet.
- Assets visuels : fonds/themes Slayer, Demoniste, Demon, NPC, badges de souffles si utiles.

## To do list de developpement

### P0 - Verrouiller la source et l'audit

- [x] Creer une table de correspondance `section PDF -> module/pack/test`. Voir `resources/rules/pdf-section-implementation-map.md`.
- [x] Ajouter un champ `sourceSection` obligatoire dans les donnees importees.
- [x] Lister toutes les valeurs numeriques absentes ou externalisees avec `TODO-RULEBOOK-AMBIGUITY`. Voir `resources/rules/rulebook-ambiguities.md`.
- [x] Ne pas utiliser de mecanique inventee sans note d'ambiguite.

### P1 - Data schema et migrations

- [x] Modifier l'existant : consolider `template.json` pour couvrir toutes les ressources, reactions, sens, traits, mutilations, crafting, supplement 1934.
- [x] From scratch si necessaire : ajouter un systeme de `temporaryEndurance`, `healableMax`, `wounds`, `targetedLimbDamage`.
- [x] Modifier l'existant : separer clairement `weapon`, `firearm`, `projectile`, `explosive`, `ammo`, `modification`.
- [x] Modifier l'existant : enrichir `technique` avec tous les flags de creation de souffle.
- [x] Ajouter migrations v0.1.x pour les champs nouveaux.
- [x] Ajouter migration/compatibilite pour anciennes cles de sous-caracteristiques.

### P2 - Calculs centraux

- [x] Modifier l'existant : centraliser formules PV/CA/E/RP/BDP/actions dans un utilitaire partage.
- [x] Corriger l'action economy humaine : action par tranche de 10 Vitesse.
- [x] Verifier l'action economy demon : `1 + Vitesse / 5`.
- [x] Implementer Endurance 0, repos force, inconscience 2 rounds.
- [x] Implementer RP recuperes uniquement apres 8h de repos.

### P3 - Creation de personnage

- [x] From scratch : assistant de creation Slayer/Demoniste/Demon. Pourfendeur/Demoniste ont un profil rapide avec stats, derives, budgets et equipement initial ; Demon conserve l'assistant corps/mouvement/danger avec spread 0/1/2/3/3/5.
- [x] Implementer attribution `0,1,2,3,4,5` et tirage 6d6.
- [x] Implementer depense des 15 points de depart.
- [x] Implementer contextes entraineur/partenaire/Kasugai avec total 3 points.
- [x] Ajouter equipement initial automatique depuis compendium.
- [x] From scratch : creation et liaison du corbeau/compagnon.

### P4 - Jets, actions et combat

- [x] Modifier l'existant : ajouter jets de stat de base et derivee depuis fiche.
- [x] Corriger les jets depuis fiches consultables/non editees.
- [x] Modifier l'existant : attaque de base avec choix Force/Finesse et degat par stat non utilisee.
- [x] Modifier l'existant : armes a feu avec munitions, recharge, Precision aux degats.
- [x] From scratch : workflow `Eviter` sans RP et verrouillage RP en cas d'echec.
- [x] Modifier l'existant : reactions 1 RP / 2 RP pour esquive, attaque, degainage, medical.
- [x] From scratch : demande d'assistance et demande d'objets Kakushi.

### P5 - Conditions, blessures, mutilation

- [x] Modifier l'existant : completer effets automatiques de chaque condition. Brulure/saignement/fumee/poison agissent au tour, les restrictions de deplacement/RP/actions/techniques/jets sensoriels sont appliquees, et les fiches affichent les notes d'automatisation.
- [x] From scratch : ciblage de membre dans chat avant attaque.
- [x] Implementer seuils 10/20% PV et difference humain cumulatif vs demon single-hit.
- [x] Implementer consequences bras/jambes/ailes/queue/tentacules.
- [x] Implementer blessures graves/quasi mortelles et reduction du cap de soin.
- [x] Relier chirurgie/equipement medical a la restauration du cap.

### P6 - Pourfendeur et souffles

- [x] Modifier l'existant : verifier progression Slayer rang par rang.
- [x] Modifier l'existant : verifier Souffle de recuperation et TCB actif.
- [x] Modifier l'existant : importer/normaliser tous les styles de souffle.
- [x] Modifier l'existant : completer passifs de chaque souffle.
- [x] From scratch : calculateur de souffle homebrew.
- [x] Ajouter validation prerequis sens/trait/arme.
- [x] Marquer les formes a donnees manquantes sans inventer.

### P7 - Sous-classes Slayer

- [x] From scratch ou pack data : creer les 16 sous-classes de Pourfendeur.
- [x] Ajouter features de depart, Kanoe, Hinoto, Kinoe.
- [x] Automatiser passifs/reactions/attaques les plus mecaniques.
- [x] Ajouter charges 1/jour, 1/rencontre, 3/jour.

### P8 - Demoniste

- [x] Modifier l'existant : verifier BDP, chair, soin, amelioration et demonisation.
- [x] From scratch : items de pouvoirs demonistes avec cout BDP et gain demonisation.
- [x] Implementer regeneration de membre, BDA petit/grand, stockage BDA, Expulsion.
- [x] Implementer sous-classes Tireur d'elite et Couteau a viande.
- [x] Ajouter equipement de depart demoniste.

### P9 - Progression et competences

- [x] From scratch : compendium de competences de progression.
- [x] Modifier l'existant : ajouter slots de competence et verrouillage par rang.
- [x] Implementer TCB Constant, Forme Marquee, Monde Transparent, Lame Rouge en features.
- [x] Ajouter entrainement Hashira et victoire solo demon lunaire comme sources de slots.

### P10 - Objets, medecine, poison, crafting

- [x] Completer compendium armes, armes alternatives, projectiles, explosifs.
- [x] Completer armes a feu, munitions et modifications.
- [x] Modifier l'existant : poison affaiblissant/nuisible/glycine avec accumulation.
- [x] From scratch : crafting avec composants et DD selon nombre de composants.
- [x] Completer medical : bandage, pansement, attelle, trousse, chirurgie, sang demon, analgesiques.

### P11 - Transport, vetements, nourriture, mort

- [x] Completer items transport et jets de conduite.
- [x] Completer vetements avec bonus/acces/camouflage.
- [x] Completer nourriture avec recuperation Endurance et Endurance temporaire.
- [x] Implementer workflow 0 PV / mort / sauvetage / objet anti-0 PV. 0 PV, Mort debout, stabilisation medicale et objet anti-0 implementes.

### P12 - Demons jouables et PNJ demons

- [x] Modifier l'existant : assistant de creation demon par 3 points.
- [x] Verifier paquets de rang et benchmarks.
- [x] Modifier l'existant : actions demon heal/regrow/purify/infect/sos/execute.
- [x] From scratch : blocage, esquive demon et demi-bonus Force/Finesse sur degats.
- [x] Ajouter lignages/branches de demons.

### P13 - Supplement 1934

- [x] Modifier l'existant : toggle supplement 1934 global.
- [x] Creer packs acteurs/objets/techniques 1934. Packs manifestes : `supplement-1934-actors`, `supplement-1934`, `supplement-1934-breaths`, `supplement-1934-techniques`.
- [x] Ajouter Hashira et factions demon comme exemples utilisables.
- [x] Marquer le contenu 1934 comme optionnel dans les fiches et compendiums.

### P14 - Compendiums

- [x] Rebuild `actors-slayers` avec 3 exemples complets.
- [x] Rebuild `actors-demonists` avec 2 exemples complets.
- [x] Rebuild `actors-demons` avec 4 exemples par bandes de menace.
- [x] Rebuild `items-weapons`. Script `resources/scripts/rebuild-items-weapons-pack.mjs` ajoute 43 armes/munitions/modifications/projectiles/explosifs avec profils 1934 optionnels et notes d'ambiguite.
- [x] Rebuild `items-medical-utility`.
- [x] Rebuild `breaths-styles`.
- [x] Rebuild `techniques-breaths`.
- [x] Rebuild `techniques-subclasses`.
- [x] Rebuild `abilities-demons`.
- [x] Ajouter scripts de validation des packs.

### P15 - UX, visuels et QA

- [x] Polir les feuilles Slayer/Demoniste/Demon/PNJ/item. En-tetes stabilises avec badges ressources, notes d'automatisation des conditions et themes par type d'acteur.
- [x] Rendre le budget des sous-caracteristiques lisible : depenses, reste, depassement.
- [x] Ajouter badges/icones/fonds de fiche coherents et lisibles. Badges PV/E/RP/BDP/CA/Demonisation et fonds differencies Slayer/Demoniste/Demon/PNJ ajoutes.
- [ ] Tester rendu sheet sans donnees manquantes dans Foundry. Readiness statique OK via `npm run verify:ready`; test runtime Foundry encore manuel.
- [x] Ajouter tests ou checklist pour : stats derivees, progression, E/RP, auto-hit souffle, conditions, mutilation, soins, BDP/demonisation, compendiums.
- [x] Lancer build et validation packs.
