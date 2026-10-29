// Player-facing journals: handouts shown by the GM, and the pre-generated
// character presentations with a beginner rules summary.
import { ASSETS, link } from "./ids.mjs";

export const HANDOUT_PAGES = [
  {
    key: "ordre-mission",
    name: "Ordre de mission",
    content: `
<p style="text-align:center"><strong>CORPS DES POURFENDEURS DE DÉMONS</strong><br /><em>Ordre transmis par corbeau Kasugai</em></p>
<hr />
<p><strong>Destinataires :</strong> les pourfendeurs de rang Mizunoto présents au salon de thé du col de Kirizawa.</p>
<p><strong>Lieu :</strong> Hotaru-mura, village de lanterniers, une heure de marche vers la vallée.</p>
<p><strong>Situation :</strong> quatre villageois ont disparu la nuit en douze jours. Aucune trace de lutte. Un démon est probable.</p>
<p><strong>Disparus :</strong></p>
<ul>
<li>Tatsu, vendeur ambulant de saké — il y a 12 nuits</li>
<li>Jirō, garde forestier — il y a 9 nuits</li>
<li>Fumi, tisserande, 17 ans — il y a 5 nuits</li>
<li>Sota, 10 ans, fils du charbonnier — il y a 2 nuits</li>
</ul>
<p><strong>Mission :</strong> enquêter, retrouver les disparus, éliminer la menace.</p>
<p><strong>Soutien :</strong> le Kakushi Shinpei vous accompagne avec du matériel.</p>
<p><strong>Attention :</strong> ce soir a lieu la fête des lanternes. Beaucoup de monde dehors après le coucher du soleil.</p>
<hr />
<p style="text-align:center"><em>« KAA ! Partez avant le coucher du soleil ! KAA ! »</em></p>`,
  },
  {
    key: "dessin-mii",
    name: "Dessin de Mii",
    type: "image",
    src: `${ASSETS}/handouts/dessin-de-mii.webp`,
    caption: "Un dessin au crayon de couleur : un monsieur à tête de lanterne, des lumières bleues, un petit garçon qu'on emmène par la main vers la maison sur la colline.",
  },
  {
    key: "carnet",
    name: "Carnet brûlé de Kansuke",
    content: `
<p><img src="${ASSETS}/items/carnet-kansuke.webp" width="320" alt="Un carnet de lanternier aux bords brûlés" /></p>
<p><em>Un petit carnet aux pages jaunies, les bords noircis par le feu. L'écriture est soignée, un peu tremblante. Entre les phrases, des dessins de lanternes très précis.</em></p>
<hr />
<p><em>Printemps.</em> Grand-mère dit que mon bleu est le plus beau de la vallée. Les autres disent que c'est la couleur des noyés. Je m'en fiche. Enfin, presque.</p>
<p><em>Été.</em> J'ai trouvé comment faire tenir le bleu sur le papier huilé : il faut de l'indigo, de la cendre de cèdre et beaucoup de patience. Personne d'autre ne sait. C'est mon secret.</p>
<p><em>Été.</em> Les garçons du village m'ont encore jeté dans la rivière. Grand-mère m'a réchauffé les mains dans les siennes. Elle dit que j'ai toujours les mains froides.</p>
<p><em>Fin de l'été.</em> Je vais faire une lanterne géante pour la fête. Si grande que tout le monde la verra. Si grande qu'on pourra tenir dedans. Comme ça, personne ne sera plus jamais seul, ni dans le noir, ni dans le froid.</p>
<p><em>(Plus bas, d'une autre encre :)</em> Le chef dit que ma lanterne est bizarre et qu'elle ne sera pas sur la rivière. Tant pis. Je travaillerai la nuit, là-haut, dans le vieil atelier. Je la finirai quand même.</p>
<hr />
<p><em>Les dernières pages sont brûlées. Sur la dernière ligne lisible, on devine : « ... Kansuke, apprenti lanternier ».</em></p>`,
  },
  {
    key: "plan-village",
    name: "Plan du village",
    type: "image",
    src: `${ASSETS}/maps/hotaru-mura.webp`,
    caption: "Hotaru-mura : le sanctuaire aux glycines (nord-ouest), la maison du chef, l'auberge du Saule près du pont rouge, l'atelier d'Oume (sud), la hutte du charbonnier (est) et le chemin qui monte vers la colline (nord-est).",
  },
];

export const RULES_FOR_PLAYERS = `
<p>Tout se fait depuis votre fiche : cliquez, le système lance les dés et explique le résultat dans le chat.</p>
<h2>Faire un test</h2>
<p>Le MJ demande un test (par exemple « Perception »). Cliquez sur la statistique dans votre fiche : on lance <strong>1d20 + votre bonus</strong>. Si le total atteint la difficulté, c'est réussi. Pensez à votre <strong>sens spécial</strong> (odorat, ouïe, vue, toucher ou goût) : il donne +3 aux tests de Perception qui l'utilisent. Dites-le au MJ !</p>
<h2>Vos ressources</h2>
<table>
<tr><th>Ressource</th><th>À quoi ça sert</th></tr>
<tr><td><strong>PV</strong></td><td>Votre santé. À 0, vous êtes hors combat.</td></tr>
<tr><td><strong>CA</strong></td><td>Votre défense. Une attaque normale vous touche si son jet atteint votre CA.</td></tr>
<tr><td><strong>Endurance (E)</strong></td><td>Le « carburant » de vos formes de Souffle. À 0, vous devez reprendre votre souffle un tour.</td></tr>
<tr><td><strong>Points de réaction (PR)</strong></td><td>Vos réflexes. Dépensez-en à tout moment, même pendant le tour d'un autre. Ils ne reviennent qu'avec le repos : gardez-les pour les grosses attaques !</td></tr>
<tr><td><strong>BDP</strong> (Tamaki seulement)</td><td>Le sang démoniaque, gagné en mangeant de la chair de démon. Sert à se soigner.</td></tr>
</table>
<h2>Votre tour en combat</h2>
<ol>
<li><strong>Bougez</strong> (jusqu'à 9 m), avant ou après votre action.</li>
<li><strong>Faites une action</strong> :
<ul>
<li><strong>Forme de Souffle</strong> : coûte de l'Endurance et <strong>touche automatiquement</strong>. Seule défense : l'ennemi dépense un PR pour esquiver. C'est votre meilleure arme.</li>
<li><strong>Attaque normale</strong> : gratuite, mais il faut toucher la CA de l'ennemi.</li>
<li><strong>Souffle de récupération</strong> : vous regagnez 1d8 d'Endurance.</li>
<li><strong>Utiliser un objet</strong> : bandage, trousse de soins...</li>
<li><strong>Libérer quelqu'un</strong> : couper un cocon ou une lanterne-prison au contact.</li>
</ul></li>
<li>Vous pouvez aussi <strong>sprinter</strong> au lieu de faire une action, pour aller plus loin.</li>
</ol>
<h2>Quand on vous attaque</h2>
<ul>
<li><strong>Esquiver (1 PR)</strong> : l'attaque vous rate, automatiquement.</li>
<li><strong>Éviter (gratuit)</strong> : jet de Finesse contre le jet d'attaque. Si vous ratez, vous ne pouvez plus dépenser de PR contre cette attaque. Risqué !</li>
</ul>
<h2>Tuer un démon</h2>
<p>Un démon se régénère. Pour le tuer, il faut lui <strong>trancher la tête avec une lame Nichirin</strong> (ou l'exposer au soleil). Quand il est bien affaibli, attaquez en visant la <strong>tête</strong>.</p>
<h2>Jouer ensemble</h2>
<ul>
<li>Décrivez ce que fait votre personnage, pas seulement le bouton que vous cliquez.</li>
<li>Protégez les villageois : les pourfendeurs sont là pour eux.</li>
<li>Chaque personnage a un <strong>petit objectif secret</strong> sur sa page : essayez de le jouer !</li>
</ul>`;

/** Hand-written plain-language summaries of the pregens' forms, keyed by compendium id. */
export const FORM_SUMMARIES = {
  cad6de33e4f6ccc1: "Une frappe concentrée en ligne droite. Simple et efficace.",
  "2c24c0509affd3f8": "Un saut et une rotation verticale : une attaque qui utilise votre Force.",
  "22234945c6e871fa": "Une série d'entailles qui frappe <strong>tous les ennemis à portée</strong>. Chère, gardez-la pour un groupe.",
  d1909a29a17666f1: "Le « coup bienveillant » qui tue sans douleur. Il faut <strong>charger un tour</strong> avant (une attaque reçue interrompt la charge). Parfait pour achever un démon qui ne se défend plus.",
  aa1d6f680a04f4bc: "Une puissante coupe verticale.",
  f06a26bd193af85a: "Une attaque à <strong>9 m</strong> : pour toucher un ennemi loin de vous.",
  "58720ee36c0c742e": "Votre arme secrète : un éclair en ligne droite, <strong>impossible à esquiver</strong>. Il faut <strong>charger un tour</strong> avant. Très coûteux.",
  b7bcafce2ca575bd: "Cinq coups en un éclair, pour 1 seule Endurance ! Ensuite, il faut attendre un tour avant de la refaire.",
  "9184cb0fba447783": "Une onde de foudre qui frappe <strong>tous les ennemis à portée</strong>. Attention aux alliés.",
  ea6754145d5cb4ca: "Des frappes à distance sur une seule cible, même très loin.",
  d78fc90520fb9043: "Une coupe unique, concentrée et tranchante.",
  "1a8ea438335c29e4": "Une pluie d'éclairs très puissante. Il faut <strong>charger un tour</strong> avant.",
  b547f6c16f5ec4a1: "Une charge rapide qui vise le cou. Votre attaque de base au Souffle.",
  b36f74cead7aa12b: "Une coupe montante, pas chère.",
  e647585999616154: "Un grand coup horizontal très puissant.",
  "42fb3637f905b8b3": "Votre lame tournoie et <strong>annule les dégâts</strong> d'une attaque, renvoyés sur une cible de votre choix.",
  "00a80e51b1041bce": "Un tigre de flammes qui frappe jusqu'à <strong>9 m</strong>.",
  "1d3f2c4e85926fbc": "Une posture de repos qui vous <strong>rend de l'Endurance</strong> selon les dégâts subis au tour précédent. Gratuite !",
  c1bbe07f84dab8ab: "Une ruée en ligne droite dans un cyclone de coups. Pas chère.",
  "0ec36839f49b02be": "Quatre lames de vent qui frappent <strong>tous les ennemis à portée</strong>.",
  "28b61c7ea663e162": "Des coups de lame dans toutes les directions. Très bon rapport puissance/prix.",
  b67948bdd3255a4d: "Une frappe en tombant qui <strong>vous rend de l'Endurance</strong>. Gratuite !",
  ea4c87a674f8e99a: "Une tornade tranchante, puissante et à 4,5 m.",
  "9ea8f87b10613ad4": "Un saut et des vents violents jusqu'à 6 m.",
};

/** Presentation pages for the five pregens (technique table is generated from the item data). */
export const PREGEN_TEXT = {
  "mizuki-asagiri": {
    tagline: "Souffle de l'Eau — la grande sœur du groupe",
    who: "Tu as grandi dans un village de pêcheurs. Il y a trois ans, un démon a emporté ton petit frère pendant que tu dormais. Tu as juré que plus aucun enfant ne disparaîtrait devant toi. Maître Sagara, un ancien Hashira de l'Eau, t'a appris à te battre avec douceur et précision.",
    personality: ["Calme, attentionnée, tu remarques quand quelqu'un a peur.", "Tu prends soin des autres avant toi-même.", "Tu crois que même les démons ont été humains un jour."],
    role: "Tu es polyvalente : de bonnes attaques, une attaque de zone, une attaque à distance, et beaucoup de Finesse pour éviter les coups.",
    tips: ["Ton <strong>odorat</strong> (+3 en Perception) te permet de sentir les démons et les indices. Pense à renifler !", "<strong>Marée battante</strong> frappe tous les ennemis proches : idéale contre les deux Rôdeurs.", "Ta posture de l'<strong>Eau Écrasante</strong> améliore tes attaques normales (+2 pour toucher, +4 dégâts) mais te ralentit."],
    links: "Kenta te fait rire et tu le protèges comme un petit frère. Itsuki est trop dur avec les démons à ton goût.",
    goal: "Ramener Sota vivant à sa petite sœur. Et, si possible, offrir une mort paisible au démon.",
    line: "« Restez derrière moi. Personne ne disparaîtra ce soir. »",
  },
  "kenta-hayase": {
    tagline: "Souffle de la Foudre — rapide comme l'éclair, peureux comme un lapin",
    who: "Avant, tu tirais un pousse-pousse dans les rues de Tokyo. Tu étais le plus rapide du quartier. Un soir, un démon a attaqué ton client ; tu t'es enfui... et tu ne te l'es jamais pardonné. Depuis, tu cours vers le danger. Même si tes jambes tremblent.",
    personality: ["Bavard, vantard, drôle.", "Tu as très peur, et tu le dis (fort).", "Quand un ami est en danger, la peur disparaît d'un coup."],
    role: "Tu es le plus rapide du groupe (CA 15, 10 PR). Tu connais <strong>les six formes</strong> de la Foudre, ce qui te donne une capacité spéciale : <strong>Vitesse de la lumière</strong> (un déplacement éclair de 6 m en réaction).",
    tips: ["Ton <strong>ouïe</strong> (+3 en Perception) te fait entendre ce que les autres ne perçoivent pas.", "<strong>Boule de foudre</strong> ne coûte qu'1 Endurance : c'est ton attaque de tous les jours.", "<strong>Coup de tonnerre et éclair</strong> ne peut pas être esquivé : garde-le pour le démon final."],
    links: "Chiyo t'impressionne (et te fait un peu peur). Mizuki est gentille avec toi : tu veux qu'elle soit fière.",
    goal: "Prouver (à toi-même) que tu n'es pas un lâche : faire un acte vraiment courageux devant les autres.",
    line: "« Un démon ? Ici ? Ha ha... Bien sûr que je n'ai pas peur. Quelqu'un d'autre passe devant ? »",
  },
  "chiyo-akabane": {
    tagline: "Souffle de la Flamme — la force qui fonce",
    who: "Tu es la fille d'un forgeron de lames Nichirin. Tu as grandi au milieu des étincelles, des marteaux et des pourfendeurs qui passaient à la forge. Tu as toujours voulu être l'une d'eux. Ton père a forgé une partie de ta lame.",
    personality: ["Énergique, franche, rire énorme.", "Gourmande : tu manges trois bols de riz à chaque repas.", "Protectrice : personne ne touche aux enfants devant toi."],
    role: "Tu frappes très fort (Force 5, plus ta <strong>Force physique accrue</strong>). Ta posture du <strong>Feu Protecteur</strong> te donne +4 CA après une attaque normale.",
    tips: ["Ta <strong>vue</strong> (+3 en Perception) repère les traces et les détails.", "<strong>Flamme purificatrice</strong> est gratuite et te rend de l'Endurance : utilise-la quand tu es à court.", "<strong>Ondulation de la Flamme en fleurs</strong> annule les dégâts d'une attaque et les renvoie !"],
    links: "Itsuki est bourru, mais tu sens qu'il a bon cœur. Tu veux faire de Kenta un vrai guerrier.",
    goal: "Goûter les meilleurs dango de la vallée... et protéger au moins un villageois de tes propres mains.",
    line: "« On mange d'abord, on tranche ensuite ! ... Bon, d'accord, on tranche d'abord. »",
  },
  "itsuki-kazahaya": {
    tagline: "Souffle du Vent — la colère qui protège",
    who: "Tu as grandi dans un orphelinat de Yokohama. Un démon l'a attaqué quand tu avais douze ans ; tu as protégé les petits avec un bâton jusqu'à l'aube. Tu as une cicatrice sur la joue et une haine solide des démons. Ta maîtresse, une ancienne Hashira du Vent, t'a mis deux ans à te dompter.",
    personality: ["Bourru, méfiant, parle peu.", "Doux avec les enfants (mais ne le dira jamais).", "Pour toi, un démon est un démon : pas de pitié."],
    role: "Tu es endurant (Courage 5, 25 Endurance) et tes formes coûtent peu. Ta posture du <strong>Vent Perçant</strong> te donne une attaque gratuite quand un ennemi te rate.",
    tips: ["Ton <strong>toucher</strong> (+3 en Perception) te fait sentir les vibrations, les griffures, la chaleur.", "<strong>Coup de vent d'hiver</strong> est gratuit et te rend de l'Endurance.", "<strong>Griffe de vent purifiante</strong> frappe tous les ennemis proches."],
    links: "Mizuki est trop gentille avec les démons, ça t'énerve. Tamaki mange des démons : ça te dégoûte, mais elle se bat bien.",
    goal: "À la fin, décider seul si ce démon mérite ta pitié. Ton personnage peut changer d'avis... ou pas.",
    line: "« Les enfants, restez derrière moi. Les démons, devant. »",
  },
  "tamaki-kurosu": {
    tagline: "Démoniste — elle mange les démons pour sauver les humains",
    who: "Enfant, tu as travaillé dans une filature de coton. La poussière a abîmé tes poumons : tu ne pourras jamais apprendre un Souffle. Un vieux médecin du Corps t'a montré une autre voie : manger la chair des démons pour gagner leur force. Les autres pourfendeurs te regardent de travers. Tu t'en moques.",
    personality: ["Pince-sans-rire, calme, un peu inquiétante.", "Médecin dans l'âme : tu soignes tout le monde.", "Tu caches ta bouche derrière un masque de tissu noir."],
    role: "Tu es la <strong>soigneuse</strong> et la <strong>tireuse</strong> du groupe. Ton fusil de tranchée fait très mal, et ta <strong>Maîtrise des armes à feu</strong> touche automatiquement une cible qui n'a pas dépensé de PR pendant ton tour.",
    tips: ["Tes <strong>Connaissances médicales</strong> : avec un bandage, tu soignes automatiquement 1d6+2 PV.", "Quand un démon perd un morceau, <strong>mange-le</strong> (une action) pour gagner des BDP. Ton <strong>Estomac d'acier</strong> te donne un dé de plus. Tu commences avec 6 BDP.", "<strong>Tir en position stable</strong> : tu restes immobile et gagnes +8 au tir suivant."],
    links: "Itsuki te déteste et tu trouves ça drôle. Mizuki est la seule à t'avoir demandé comment tu allais.",
    goal: "Sauver une vie grâce à ta méthode « dégoûtante », devant ceux qui te jugent.",
    line: "« Ne faites pas cette tête. Je ne mange que ceux qui le méritent. »",
  },
};

export const PREGENS_INTRO = `
<p>Voici les cinq jeunes pourfendeurs de cette aventure. Ils sont tous de rang <strong>Mizunoto</strong> (le premier rang) et viennent de réussir la Sélection Finale. Ils ne se connaissent presque pas.</p>
<ul>
<li>${link.page("pregens", "mizuki-asagiri", "Mizuki Asagiri")} — Souffle de l'Eau, la grande sœur protectrice. <em>Conseillée pour un premier joueur.</em></li>
<li>${link.page("pregens", "kenta-hayase", "Kenta Hayase")} — Souffle de la Foudre, rapide et peureux.</li>
<li>${link.page("pregens", "chiyo-akabane", "Chiyo Akabane")} — Souffle de la Flamme, fille de forgeron, force brute.</li>
<li>${link.page("pregens", "itsuki-kazahaya", "Itsuki Kazahaya")} — Souffle du Vent, bourru au grand cœur.</li>
<li>${link.page("pregens", "tamaki-kurosu", "Tamaki Kurosu")} — Démoniste, soigneuse et tireuse qui mange les démons.</li>
</ul>
<p>À 3 ou 4 joueurs, gardez de préférence Mizuki et Tamaki (soins) et choisissez les autres librement.</p>`;
