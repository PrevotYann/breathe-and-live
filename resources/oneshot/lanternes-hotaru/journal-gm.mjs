// Game master guide of the one-shot, written for beginner game masters.
import { ASSETS, link } from "./ids.mjs";

const pc = {
  mizuki: link.actor("mizuki-asagiri", "Mizuki"),
  kenta: link.actor("kenta-hayase", "Kenta"),
  chiyo: link.actor("chiyo-akabane", "Chiyo"),
  itsuki: link.actor("itsuki-kazahaya", "Itsuki"),
  tamaki: link.actor("tamaki-kurosu", "Tamaki"),
};
const npc = {
  oume: link.actor("oume", "Oume"),
  mii: link.actor("mii", "Mii"),
  shinpei: link.actor("shinpei-kakushi", "Shinpei"),
  gonbei: link.actor("gonbei-arakawa", "Gonbei Arakawa"),
  okiku: link.actor("okiku", "Okiku"),
  sota: link.actor("sota", "Sota"),
  fumi: link.actor("fumi", "Fumi"),
  jiro: link.actor("jiro", "Jirō"),
  rodeur: link.actor("rodeur-des-lanternes", "Rôdeurs des lanternes"),
  tomoshibi: link.actor("tomoshibi", "Tomoshibi"),
};
const gm = (page, label) => link.page("gm", page, label);
const aid = (page, label) => link.page("players", page, label);
const readAloud = (text) => `<blockquote><p><strong>À lire aux joueurs :</strong></p>${text}</blockquote>`;
const box = (title, text) => `<section class="secret"><p><strong>${title}</strong></p>${text}</section>`;

export const GM_PAGES = [
  {
    key: "bienvenue",
    name: "0. Bienvenue — à lire en premier",
    content: `
<p><img src="${ASSETS}/cover.webp" alt="Une vallée la nuit, des lanternes sur la rivière" /></p>
<h2>Le scénario en une phrase</h2>
<p>Dans un village de montagne qui prépare sa fête des lanternes, des gens disparaissent la nuit en suivant une lumière bleue. Cinq jeunes pourfendeurs de démons sont envoyés pour comprendre, sauver les disparus et vaincre le démon... qui fut autrefois un garçon très seul.</p>
<h2>En pratique</h2>
<ul>
<li><strong>Durée :</strong> 3 h à 4 h.</li>
<li><strong>Joueurs :</strong> 3 à 5, avec les ${link.page("pregens", "regles-joueurs", "5 prétirés")} fournis (rang Mizunoto, niveau 1).</li>
<li><strong>Pour qui :</strong> joueurs et MJ débutants. Aucune connaissance du livre n'est nécessaire pour les joueurs.</li>
<li><strong>Époque :</strong> ère Taishō, un soir d'été.</li>
<li><strong>Ton :</strong> courage, entraide, frissons, et un peu de compassion pour le démon à la fin — comme dans <em>Demon Slayer</em>.</li>
</ul>
<h2>Ce que contient l'aventure</h2>
<ul>
<li>Ce <strong>Guide du MJ</strong> : l'histoire secrète, les trois actes pas à pas, les PNJ, la tactique des démons et des aides en cas de difficulté.</li>
<li>Le journal <strong>Aides de jeu</strong> : documents à montrer aux joueurs (ordre de mission, dessin d'enfant, carnet, plan).</li>
<li>Le journal <strong>Prétirés</strong> : une page de présentation par personnage, et un aide-mémoire des règles pour les joueurs.</li>
<li><strong>3 scènes</strong> : ${link.scene("village", "le village")}, ${link.scene("pont", "le pont du festival")} et ${link.scene("atelier", "l'atelier abandonné")}. Les épingles sur les cartes ouvrent la bonne page de ce guide.</li>
<li><strong>Acteurs</strong> : 5 prétirés, 8 PNJ humains, 2 démons. <strong>Objets</strong> : indices du scénario et la « Livraison Kakushi ».</li>
</ul>
<h2>Préparer la partie (10 minutes)</h2>
<ol>
<li>Lisez les pages ${gm("histoire", "1. L'histoire secrète")} et ${gm("regles-mj", "2. Règles express")}.</li>
<li>Donnez à chaque joueur son personnage : clic droit sur l'acteur → <em>Configurer les droits</em> → le joueur devient <em>Propriétaire</em>.</li>
<li>Montrez aux joueurs la page ${link.page("pregens", "regles-joueurs", "Règles express pour les joueurs")} (bouton <em>Montrer aux joueurs</em> en haut du journal).</li>
<li>Activez la scène ${link.scene("village", "Hotaru-mura")}.</li>
<li>Gardez la page ${gm("tactiques", "8. Tactiques des démons")} ouverte pendant les combats.</li>
</ol>
<h2>Trois conseils pour un MJ débutant</h2>
<ul>
<li><strong>Dites oui aux bonnes idées.</strong> Si un joueur trouve une autre façon de découvrir un indice, donnez-le-lui.</li>
<li><strong>Les indices ne doivent jamais bloquer.</strong> Chaque information importante peut être trouvée à plusieurs endroits. Un test raté donne l'info plus tard ou avec un prix (du temps perdu, une blessure, une dispute).</li>
<li><strong>Donnez la parole à chacun.</strong> Chaque prétiré a un sens spécial et un petit objectif personnel : utilisez-les pour mettre chaque joueur en avant au moins une fois.</li>
</ul>
<p><em>Illustrations originales générées par IA : couverture, cartes, portraits, indices et pouvoirs. Les cartes conservent les positions des épingles et des jetons du scénario.</em></p>`,
  },
  {
    key: "histoire",
    name: "1. L'histoire secrète",
    content: `
<p><em>Ce que les joueurs vont découvrir petit à petit. Ne leur lisez pas cette page.</em></p>
<h2>Il y a dix ans : Kansuke</h2>
<p>Kansuke était un orphelin timide, recueilli par ${npc.oume}, la vieille lanternière du village de Hotaru-mura (« le village des lucioles »). Il était très doué : il avait inventé une teinture d'un bleu profond, que tout le monde appelait le <strong>« bleu de Kansuke »</strong>. Mais les autres enfants se moquaient de lui et il se sentait toujours seul.</p>
<p>Pour la fête des lanternes, il voulait construire une lanterne géante « pour que tout le monde le voie enfin ». Une nuit, seul dans l'ancien atelier sur la colline, il a renversé une lampe. L'atelier a brûlé. On n'a jamais retrouvé son corps. Le village a cru qu'il était mort.</p>
<p>En réalité, gravement brûlé, Kansuke a rampé dans la forêt. Un homme élégant au regard rouge lui a promis qu'il n'aurait « plus jamais froid, plus jamais seul ». Il lui a donné son sang. Kansuke est devenu un démon.</p>
<h2>Aujourd'hui : Tomoshibi</h2>
<p>Après dix ans d'errance, le démon est revenu « à la maison » pour l'anniversaire de l'incendie. Il se fait appeler ${npc.tomoshibi} (« petite flamme »). Il porte un masque de papier huilé pour cacher son visage brûlé. Il vit caché dans le grand four de l'atelier en ruine.</p>
<p>Dans sa tête de démon, il « protège » les gens : il les enferme dans des <strong>lanternes-cocons</strong> en papier, pour qu'ils restent avec lui, au chaud et dans la lumière. Mais il a faim. Les cocons le nourrissent lentement.</p>
<h2>Les disparitions</h2>
<table>
<tr><th>Quand</th><th>Qui</th><th>Où en est-il ?</th></tr>
<tr><td>Il y a 12 nuits</td><td>Tatsu, vendeur ambulant de saké</td><td><strong>Mort.</strong> Tomoshibi l'a dévoré. On peut retrouver sa gourde près du pont.</td></tr>
<tr><td>Il y a 9 nuits</td><td>${npc.jiro}, garde forestier</td><td>Vivant, très faible, dans un cocon.</td></tr>
<tr><td>Il y a 5 nuits</td><td>${npc.fumi}, tisserande</td><td>Vivante, dans un cocon.</td></tr>
<tr><td>Il y a 2 nuits</td><td>${npc.sota}, 10 ans, fils du charbonnier</td><td>Vivant, dans un cocon. Sa petite sœur ${npc.mii} l'a vu partir.</td></tr>
<tr><td>Ce soir (Acte 2)</td><td>${npc.mii}</td><td>Tomoshibi l'enlève pendant la fête. Les PJ doivent la sauver.</td></tr>
</table>
<h2>Les deux charognards</h2>
<p>Deux ${npc.rodeur} (des démons faibles) ont senti l'odeur des victimes. Tomoshibi les tolère comme des chiens de garde. Ce soir, affamés, ils attaquent la fête. Tomoshibi profite de la panique pour enlever Mii.</p>
<h2>Le fil rouge des indices</h2>
<p>Les joueurs doivent comprendre trois choses. Chacune peut être apprise à plusieurs endroits :</p>
<ol>
<li><strong>« Les disparus suivent une lumière bleue. »</strong> → ${npc.okiku} (auberge), ${npc.mii} (son dessin), la ${link.item("lanterne-bleue", "lanterne bleue")}.</li>
<li><strong>« Le coupable a un lien avec Kansuke. »</strong> → le bleu reconnu par ${npc.oume}, le ${link.item("carnet-kansuke", "carnet brûlé")}, la mémoire du chef ${npc.gonbei}.</li>
<li><strong>« Il se cache dans l'atelier brûlé, sur la colline. »</strong> → le dessin de Mii, les traces sur le chemin, Oume, et au pire les lumières bleues de l'Acte 2.</li>
</ol>
<p>Même si les joueurs ne trouvent rien, l'Acte 2 les met sur la piste : ils n'ont qu'à suivre les lumières.</p>`,
  },
  {
    key: "regles-mj",
    name: "2. Règles express pour le MJ",
    content: `
<p>Les fiches font les calculs : cliquez sur une statistique, une arme ou une technique, et le système lance les dés et affiche le résultat dans le chat. Voici ce qu'il faut savoir pour arbitrer.</p>
<h2>Les tests</h2>
<ul>
<li>On lance <strong>1d20 + un bonus</strong>. Avec une statistique de base (Force, Finesse, Courage, Vitesse, Social, Intellect), le bonus est la valeur <strong>moins 1</strong>. Avec une statistique dérivée (Enquête, Perception, Médecine...), le bonus est sa valeur totale.</li>
<li>Le livre laisse le MJ fixer la difficulté (DD). Repères utilisés dans ce scénario : <strong>10 = facile, 13 = moyen, 16 = difficile</strong>.</li>
<li>Les <strong>sens extrasensoriels</strong> (odorat, ouïe, vue, toucher, goût) donnent +3 aux tests de Perception qui utilisent ce sens. Chaque prétiré en a un : profitez-en !</li>
</ul>
<h2>Les ressources</h2>
<ul>
<li><strong>PV</strong> : la santé. <strong>CA</strong> : la défense (une attaque normale touche si son jet atteint la CA).</li>
<li><strong>Endurance (E)</strong> : les pourfendeurs la dépensent pour leurs formes de Souffle. À 0, ils doivent récupérer un tour sans attaquer ; s'ils ne font pas de Souffle de récupération pendant 2 rounds, ils s'évanouissent.</li>
<li><strong>Souffle de récupération</strong> : une action qui rend 1d8 d'Endurance par rang (donc 1d8 pour nos Mizunoto).</li>
<li><strong>Points de réaction (PR)</strong> : à dépenser à tout moment, même pendant le tour d'un autre. 1 PR = esquive automatique d'une attaque, ou attaque immédiate, ou changer d'arme. Ils ne reviennent qu'avec le repos : c'est la ressource la plus précieuse.</li>
<li><strong>Points de sang démoniaque (BDP)</strong> : la ressource de ${pc.tamaki} (démoniste) et des démons.</li>
</ul>
<h2>Le combat</h2>
<ul>
<li>Lancez l'initiative avec le suivi de combat de Foundry.</li>
<li>À son tour, un personnage peut se <strong>déplacer</strong> (9 m) et faire <strong>une action</strong> : attaquer, utiliser une forme de Souffle, utiliser un objet, faire un Souffle de récupération... Il peut aussi <strong>sprinter</strong> au lieu d'agir.</li>
<li><strong>Les formes de Souffle touchent automatiquement</strong> : pas de jet pour toucher. La seule défense est que la cible dépense un PR pour esquiver. C'est pour ça que les démons perdent vite leurs PR !</li>
<li><strong>Éviter</strong> : quand on est attaqué, on peut tenter un jet de Finesse au lieu de dépenser un PR. Si on bat le jet d'attaque, on ne prend rien ; si on rate, on ne peut plus dépenser de PR contre cette attaque.</li>
</ul>
<h2>Les démons</h2>
<ul>
<li>Ils se soignent avec <em>Guérison démoniaque</em> (2 BDP, une action) et font repousser leurs membres avec <em>Repousse</em>.</li>
<li><strong>Pour tuer un démon</strong>, il faut le <strong>décapiter avec une lame Nichirin</strong> (ou l'exposer au soleil). Sur la fiche : attaquez en visant la <strong>tête</strong> ; si les dégâts atteignent ses PV restants, la tête tombe et le démon part en cendres.</li>
<li><em>Conseil débutant (choix de MJ, pas une règle du livre) :</em> si un démon tombe à 0 PV sous le coup d'une lame Nichirin, vous pouvez décrire directement la décapitation pour ne pas frustrer la table.</li>
</ul>
<h2>La démoniste</h2>
<ul>
<li>${pc.tamaki} n'utilise pas de Souffle. Quand un morceau de démon est détaché, elle peut le <strong>manger</strong> (une action) pour gagner des BDP : 1d4+1 pour un démon faible (plus un dé grâce à son <em>Estomac d'acier</em>).</li>
<li>Avec ses BDP, elle se soigne (<em>Soin démoniaque</em>, ou réaction de soin avec 1 PR).</li>
</ul>
<h2>Les états à connaître pour ce scénario</h2>
<ul>
<li><strong>Brûlure</strong> : 1 dégât de feu par tour.</li>
<li><strong>Charmé</strong> : le personnage ne peut pas blesser celui qui l'a charmé et considère ses ennemis comme les siens.</li>
<li><strong>Emprisonné</strong> : piégé par un art de sang, impossible de bouger tant qu'on n'est pas libéré.</li>
<li><strong>Triste</strong> : submergé par la culpabilité, la cible doit réussir un test d'Endurance DD 15.</li>
</ul>
<p>Les états s'affichent sur les fiches et se cochent/décochent d'un clic.</p>`,
  },
  {
    key: "acte-0",
    name: "3. Acte 0 — L'ordre du corbeau (15 min)",
    content: `
<p><strong>But de la scène :</strong> présenter les personnages, donner la mission, laisser chacun demander un objet.</p>
${readAloud(`<p>Fin d'après-midi. La chaleur d'été colle aux uniformes noirs. Vous êtes cinq jeunes pourfendeurs, à peine sortis de la Sélection Finale, réunis dans un salon de thé au pied des montagnes. Vous ne vous connaissez presque pas.</p><p>Soudain, cinq oiseaux se posent en même temps sur la balustrade. Le plus vieux corbeau gonfle ses plumes et crie :</p><p>« KAA ! KAA ! Mission ! Mission ! Village de Hotaru-mura, dans la vallée ! Quatre personnes disparues la nuit ! Démon probable ! Partez avant le coucher du soleil ! KAA ! »</p>`)}
<ol>
<li>Faites <strong>présenter chaque personnage</strong> en une ou deux phrases : nom, Souffle, une chose visible (le haori de Chiyo, le foulard d'Itsuki...). Ils peuvent lire leur réplique de départ sur leur page de présentation.</li>
<li>Montrez l'aide de jeu ${aid("ordre-mission", "Ordre de mission")}.</li>
<li>Présentez ${npc.shinpei}, le Kakushi qui les accompagne. Il porte un sac énorme et tremble un peu.</li>
</ol>
<h2>La livraison Kakushi</h2>
<p>Le livre prévoit qu'au briefing, les pourfendeurs peuvent <strong>commander des objets</strong> au quartier général. Pour ce scénario : <strong>un objet par personnage</strong>, parmi le dossier <em>Livraison Kakushi</em> (bandage, pansement compressif, trousse de premiers secours, analgésiques, poison de glycine affaiblissant, kunai de glycine). Glissez l'objet choisi sur la fiche du joueur.</p>
${readAloud(`<p>Shinpei ouvre son sac en reniflant : « J'ai... j'ai un peu de tout. Mais un seul objet chacun, hein ? Sinon je n'aurai plus rien pour les blessés... et il y aura des blessés. Il y a toujours des blessés. »</p>`)}
<p><strong>Transition :</strong> une heure de marche dans la forêt de cèdres. Le soleil descend quand ils aperçoivent les toits du village et des centaines de lanternes en papier suspendues partout. → ${gm("acte-1", "Acte 1")}</p>`,
  },
  {
    key: "acte-1",
    name: "4. Acte 1 — Le village des lucioles (60 à 75 min)",
    content: `
<p><strong>But de l'acte :</strong> enquêter, rencontrer les villageois, comprendre que le danger vient de la colline. Scène : ${link.scene("village", "Hotaru-mura")}.</p>
${readAloud(`<p>Hotaru-mura est un petit village coupé en deux par une rivière claire. Partout, des lanternes de papier attendent la nuit : sur les toits, sur le pont rouge, au-dessus de la rue principale. Ce soir, c'est la fête des lanternes : on dépose des lanternes sur la rivière pour guider les âmes des morts.</p><p>Pourtant, les visages sont fermés. Les mères rentrent leurs enfants. Un homme moustachu à l'éventail vous attend devant le pont, l'air contrarié.</p>`)}
<h2>L'accueil du chef</h2>
<p>${npc.gonbei} les reçoit poliment mais froidement. Il ne veut pas qu'ils « effraient les visiteurs » et refuse d'annuler la fête : « Le village vit de ses lanternes. Ce sont des ours, ou des fugueurs, rien de plus. » Il leur donne la liste des disparus (voir ${gm("histoire", "l'histoire secrète")}) et les laisse libres de circuler.</p>
<p>Un test de <strong>Intuition DD 13</strong> révèle qu'il a peur, et qu'il cache quelque chose à propos d'un vieil incendie. S'ils insistent (<strong>Intimidation ou Tromperie DD 13</strong>, ou simplement avec de bons arguments), il raconte l'histoire de Kansuke (voir ${gm("lieu-e", "Lieu E")}).</p>
<h2>Les lieux à visiter</h2>
<p>Laissez les joueurs choisir. Ils peuvent se séparer en petits groupes. Comptez environ 10 minutes par lieu. Quand le soleil se couche (au bout de 3 ou 4 lieux, ou quand l'énergie baisse), passez à l'${gm("acte-2", "Acte 2")}.</p>
<ul>
<li>${gm("lieu-a", "Lieu A — L'auberge du Saule")} (Okiku, les rumeurs)</li>
<li>${gm("lieu-b", "Lieu B — L'atelier d'Oume")} (le bleu de Kansuke, le carnet)</li>
<li>${gm("lieu-c", "Lieu C — La hutte du charbonnier")} (Mii et son dessin)</li>
<li>${gm("lieu-d", "Lieu D — Le pont, le sanctuaire et le chemin de la colline")} (les traces)</li>
<li>${gm("lieu-e", "Lieu E — La maison du chef")} (le vieil incendie)</li>
</ul>
${box("Si les joueurs bloquent", `<p>Faites intervenir un corbeau Kasugai : « KAA ! Lumière bleue vue sur la colline ! KAA ! », ou faites courir ${npc.mii} vers eux avec son dessin.</p>`)}`,
  },
  {
    key: "lieu-a",
    name: "4A. Lieu A — L'auberge du Saule",
    content: `
${readAloud(`<p>Une grande auberge au toit brun, à côté d'un saule pleureur. Une odeur de soupe miso et de brochettes grillées flotte dans l'air. Une femme ronde au tablier fleuri vous fait de grands signes : « Des pourfendeurs ! Entrez, entrez, vous devez avoir faim ! »</p>`)}
<p>${npc.okiku} est la meilleure source de rumeurs. Elle offre des ${link.item("kakushi-7d2676c6fc4e4f51", "dango")} (Chiyo va adorer).</p>
<h2>Ce qu'elle raconte (sans test)</h2>
<ul>
<li>L'ordre des disparitions, avec des détails humains : Tatsu « buvait trop mais chantait bien », Jirō « connaît la forêt par cœur, il ne se serait jamais perdu », Fumi « tissait le plus beau bleu du village... enfin, presque ».</li>
<li>« Les nuits où quelqu'un disparaît, on voit des <strong>lumières bleues</strong> sur la rivière. Des lanternes que personne n'a posées. »</li>
</ul>
<h2>Avec un test de Perception ou d'Intuition DD 13</h2>
<ul>
<li>Elle baisse la voix : « Ce bleu... la vieille Oume en faisait un pareil, il y a longtemps. Avec son apprenti. Le pauvre garçon est mort dans l'incendie de l'atelier, là-haut. »</li>
</ul>
<h2>Moment pour un personnage</h2>
<p>${pc.chiyo} peut gagner la confiance d'Okiku en mangeant tout ce qu'on lui sert. ${pc.kenta} peut faire rire la salle avec ses histoires de pousse-pousse à Tokyo : les clients se mettent alors à parler (+2 au prochain test social, au choix du MJ).</p>`,
  },
  {
    key: "lieu-b",
    name: "4B. Lieu B — L'atelier d'Oume",
    content: `
${readAloud(`<p>Un atelier sombre et frais, rempli de papier, de bambou et de pots de teinture. Des dizaines de lanternes sèchent dans la cour. Une très vieille femme aux doigts tachés de bleu et de rouge colle du papier sans lever les yeux : « Si vous venez pour les disparus, je n'ai rien vu. Je ne sors plus la nuit. »</p>`)}
<p>${npc.oume} est méfiante au début, puis touchante. Elle est la clé émotionnelle du scénario.</p>
<h2>Ce qu'elle dit si on la met en confiance (Social DD 10, ou en l'aidant à son travail)</h2>
<ul>
<li>Elle a élevé un orphelin, Kansuke, « un garçon timide qui bégayait, mais avec des mains d'or ».</li>
<li>Il est mort dans l'incendie de l'ancien atelier, sur la colline, il y a dix ans jour pour jour.</li>
<li>Elle va encore déposer des fleurs sur une petite stèle près des ruines, le jour, mais elle n'entre jamais.</li>
</ul>
<h2>Le bleu de Kansuke</h2>
<p>Si on lui montre une ${link.item("lanterne-bleue", "lanterne bleue")}, ou si on lui décrit précisément les lumières, elle pâlit : « C'est son bleu. Personne d'autre ne sait le faire. Personne. » Elle refuse d'y croire, puis tend le ${link.item("carnet-kansuke", "carnet brûlé de Kansuke")} aux personnages. Montrez l'aide de jeu ${aid("carnet", "Carnet brûlé de Kansuke")}.</p>
<h2>Indice discret</h2>
<p>Un test d'<strong>Enquête DD 13</strong> dans l'atelier : trois grands moules à lanterne ont disparu de la réserve il y a deux semaines. Oume pensait les avoir prêtés.</p>
<h2>Moment pour un personnage</h2>
<p>${pc.mizuki} (odorat) sent sur les mains d'Oume la même odeur que celle de la teinture des lumières bleues... et autre chose : une odeur de fumée très ancienne. ${pc.itsuki}, qui a grandi dans un orphelinat, peut comprendre mieux que les autres ce que Kansuke a ressenti.</p>
${box("Oume viendra-t-elle ?", `<p>Si les personnages lui demandent de les accompagner, elle refuse d'abord, puis les rejoint à l'Acte 3 (elle suit les lumières avec ${npc.shinpei}). Sa présence permet la fin la plus émouvante.</p>`)}`,
  },
  {
    key: "lieu-c",
    name: "4C. Lieu C — La hutte du charbonnier",
    content: `
${readAloud(`<p>De l'autre côté du pont, à l'orée de la forêt, une hutte noire de suie fume à côté d'un grand four à charbon. Une petite fille est assise sur le seuil, un sachet rouge serré dans les mains. Elle ne pleure plus. Elle regarde la colline.</p>`)}
<p>${npc.mii}, 8 ans. Son père cherche Sota dans la forêt depuis deux jours ; sa mère est malade de chagrin. Personne n'écoute Mii.</p>
<h2>Gagner sa confiance</h2>
<p>Pas de test si les personnages sont doux avec elle. Un personnage brusque doit réussir un test de <strong>Social DD 13</strong> (ou de Performance, en faisant le clown).</p>
<h2>Ce qu'elle raconte</h2>
<ul>
<li>« Il y a deux nuits, une lanterne bleue est venue devant la porte. Sota l'a suivie. Il riait, comme quand on rêve. »</li>
<li>« J'ai vu le monsieur. Il avait une tête de lanterne. Il a pris Sota par la main, gentiment. Ils sont montés là-haut, vers la maison brûlée. »</li>
<li>Elle montre son dessin : aide de jeu ${aid("dessin-mii", "Dessin de Mii")}.</li>
</ul>
<p>À la fin, elle donne son ${link.item("omamori-mii", "omamori")} au personnage qui lui promet de ramener Sota.</p>
<h2>Indice physique</h2>
<p>Un test de <strong>Perception DD 13</strong> (vue ou odorat) près de la porte : de la cendre de papier et une goutte de cire bleue sur la marche. ${pc.chiyo} (vue) remarque aussi des traces de pieds nus qui partent vers le chemin de la colline. Si les joueurs fouillent les buissons, ils peuvent trouver une petite ${link.item("lanterne-bleue", "lanterne bleue")} éteinte.</p>`,
  },
  {
    key: "lieu-d",
    name: "4D. Lieu D — Le pont, le sanctuaire et le chemin",
    content: `
<h2>Le pont rouge</h2>
<p>Un test d'<strong>Enquête DD 13</strong> sous le pont : la gourde de saké de Tatsu, coincée entre deux rochers, tachée de sang séché. Le premier disparu est mort.</p>
<h2>Le sanctuaire aux glycines</h2>
<p>Un petit sanctuaire au nord-ouest, entouré de glycines en fleurs. Les villageois y prient pour les disparus. C'est ici que Mii a acheté son omamori. C'est un bon endroit pour une scène calme entre personnages.</p>
${box("Glycine", `<p>Dans l'univers de <em>Demon Slayer</em>, les démons détestent la glycine. Si un joueur y pense, confirmez que les démons n'aiment pas cet endroit : c'est pour ça qu'aucune disparition n'a eu lieu près du sanctuaire. (Ambiance seulement : le scénario n'ajoute pas de règle.)</p>`)}
<h2>Le chemin de la colline</h2>
<p>Un sentier part vers le nord-est, à travers les cèdres, jusqu'aux ruines de l'ancien atelier.</p>
<ul>
<li><strong>Perception DD 13</strong> : de l'herbe roussie en petits cercles, comme si des lanternes s'étaient posées.</li>
<li><strong>Survie ou Nature DD 13</strong> : les traces de pas montent, mais aucune ne redescend.</li>
<li>${pc.itsuki} (toucher) sent en posant la main sur un tronc des griffures récentes, profondes : deux créatures différentes sont passées ici (les Rôdeurs).</li>
<li>${pc.kenta} (ouïe) entend, très loin en haut, quelqu'un chanter une berceuse d'une voix d'enfant.</li>
</ul>
${box("Et s'ils montent tout de suite ?", `<p>De jour, ils trouvent les ruines, les trois cocons (vides de démon) et le four fermé : Tomoshibi dort dedans et n'en sortira pas tant que le soleil brille. Ils peuvent libérer les captifs ! Dans ce cas, le soleil se couche pendant qu'ils redescendent avec les blessés : jouez l'Acte 2 sur le chemin, puis Tomoshibi vient lui-même au village chercher « ses » enfants (combat final sur la carte du pont). Adaptez sans stress.</p>`)}`,
  },
  {
    key: "lieu-e",
    name: "4E. Lieu E — La maison du chef",
    content: `
<p>La plus grande maison du village. ${npc.gonbei} y garde le registre du village.</p>
<h2>Ce qu'il finit par avouer (voir l'accueil de l'Acte 1)</h2>
<ul>
<li>« Il y a dix ans, l'apprenti d'Oume, Kansuke, travaillait seul la nuit dans l'atelier de la colline. Il voulait faire une lanterne géante pour la fête. Ça a brûlé. »</li>
<li>« On est montés trop tard. On n'a jamais retrouvé le corps... On s'est dit que la forêt l'avait pris. »</li>
<li>Avec un test d'<strong>Intuition DD 13</strong> : il a honte. Ce soir-là, il avait refusé que Kansuke expose sa lanterne à la fête, parce qu'« elle était bizarre ».</li>
</ul>
<h2>Le registre</h2>
<p>Un test d'<strong>Enquête DD 10</strong> : la date de l'incendie correspond exactement au jour de la première disparition, il y a douze jours... et la fête de ce soir tombe dix ans jour pour jour après l'ouverture de l'atelier par Oume.</p>`,
  },
  {
    key: "acte-2",
    name: "5. Acte 2 — La nuit des lanternes (45 min)",
    content: `
<p><strong>But de l'acte :</strong> un premier combat simple pour apprendre les règles, puis l'enlèvement de Mii qui lance la poursuite. Scène : ${link.scene("pont", "Le pont des lanternes")}.</p>
${readAloud(`<p>La nuit tombe. Des tambours résonnent. Les villageois, malgré la peur, descendent vers la rivière avec leurs lanternes allumées. Une à une, les petites lumières orange glissent sur l'eau noire. Des lucioles dansent au-dessus. C'est magnifique.</p><p>Puis quelqu'un crie. Parmi les lanternes orange, trois lumières bleues remontent le courant. Contre le courant.</p><p>Et sur la berge, deux silhouettes voûtées sortent des roseaux en ricanant.</p>`)}
<h2>Le combat contre les Rôdeurs</h2>
<ul>
<li>Placez les deux jetons de ${npc.rodeur} sur la berge sud (ils sont déjà sur la carte, cachés : rendez-les visibles).</li>
<li>Ce combat sert à <strong>apprendre les règles</strong>. Expliquez à chaque joueur ses options à son premier tour : déplacement, attaque normale, forme de Souffle (touche automatiquement), PR pour esquiver.</li>
<li>Les Rôdeurs ont 4 PR chacun : ils esquivent les premières formes de Souffle. Expliquez-le aux joueurs : « Il esquive, mais il n'en a plus beaucoup ! »</li>
<li>Ils attaquent les villageois paniqués s'il n'y a pas de PJ à côté : donnez aux joueurs l'occasion de protéger quelqu'un.</li>
<li>Tactique simple : voir ${gm("tactiques", "Tactiques des démons")}.</li>
</ul>
${box("Moment pour la démoniste", `<p>Quand un Rôdeur perd un bras, ou après sa décapitation, ${pc.tamaki} peut manger un morceau de sa chair pour gagner des BDP (bouton sur sa fiche). Décrivez la réaction choquée des villageois... et de ses camarades ! Avec son sens du goût, elle sent le papier brûlé et l'huile de lampe dans la chair : ce démon s'est nourri près de l'atelier.</p>`)}
<h2>L'enlèvement de Mii</h2>
<p>À la fin du 3<sup>e</sup> round (ou quand le premier Rôdeur tombe), jouez cette scène :</p>
${readAloud(`<p>Sur le parapet du pont, une silhouette mince est apparue sans un bruit. Un kimono d'artisan brûlé, un visage caché derrière un masque de papier huilé, deux yeux bleus qui brillent au travers. Dans ses bras, une petite fille endormie, qui serre un sachet rouge.</p><p>Mii.</p><p>La silhouette incline poliment la tête, comme un apprenti devant son maître : « Pardon. Elle avait froid. Je l'emmène voir son frère. » Puis elle s'envole dans un tourbillon de papier et de lumières bleues, vers la colline.</p>`)}
<ul>
<li>Tomoshibi ne combat pas ici : il fuit. Aucune attaque ne peut l'arrêter (il est déjà hors de portée).</li>
<li>Les Rôdeurs survivants en profitent pour attaquer, ou fuient si l'un d'eux est mort.</li>
</ul>
<h2>Après le combat</h2>
<ul>
<li>Les personnages peuvent récupérer une ${link.item("lanterne-bleue", "lanterne bleue")} sur la rivière.</li>
<li>${npc.oume}, bouleversée, a vu le masque : « Ce masque... c'est le papier qu'il utilisait. Kansuke ? » Elle demande à venir.</li>
<li><strong>Petit repos (5 minutes de marche)</strong> : chaque personnage peut faire un Souffle de récupération, utiliser un objet de soin et décrire comment il se prépare. Les PR ne reviennent pas (ils ne reviennent qu'avec un vrai repos).</li>
</ul>
<p>Transition : les lumières bleues tracent un chemin dans la forêt, comme des miettes de pain. → ${gm("acte-3", "Acte 3")}</p>`,
  },
  {
    key: "acte-3",
    name: "6. Acte 3 — L'atelier abandonné (60 min)",
    content: `
<p><strong>But de l'acte :</strong> le combat final, libérer les captifs, et décider comment finit l'histoire de Kansuke. Scène : ${link.scene("atelier", "L'atelier abandonné")}.</p>
${readAloud(`<p>Au sommet de la colline, au milieu d'une clairière, se dressent les restes noircis d'un grand atelier. Le toit a disparu. Des poutres calcinées pointent vers les étoiles. À l'intérieur brillent trois énormes lanternes de papier, grandes comme des hommes. Dans chacune, une silhouette recroquevillée.</p><p>Une voix douce chante une berceuse. Au milieu des ruines, la créature au masque de papier plie une feuille autour d'une petite fille endormie, avec des gestes d'artisan patient.</p>`)}
<h2>L'approche</h2>
<ul>
<li>Un test de <strong>Ruse DD 13</strong> pour approcher en silence (chaque personnage, ou un seul pour le groupe s'il guide les autres). Si la majorité réussit : les personnages agissent tous avant Tomoshibi au premier round (round de surprise).</li>
<li>Si les personnages foncent ou crient, pas de surprise : Tomoshibi se retourne et dit : « Vous êtes venus pour la fête ? Vous avez froid, vous aussi ? »</li>
<li>${pc.mizuki} (odorat) sent que la créature et Oume ont « la même odeur de teinture » : c'est bien Kansuke.</li>
</ul>
<h2>Ce qu'il y a sur la carte</h2>
<ul>
<li><strong>Mii</strong> : au départ dans les bras de Tomoshibi. Au premier tour du démon, il la dépose dans une lanterne inachevée près du four : elle est <strong>Emprisonnée</strong>. Un personnage au contact peut couper le papier (une action, automatique).</li>
<li><strong>Les trois cocons</strong> (${npc.sota}, ${npc.fumi}, ${npc.jiro}) : un personnage au contact peut couper un cocon (une action, automatique). Le captif tombe, sonné.</li>
<li><strong>Évacuer</strong> : au round 2, ${npc.shinpei} arrive (avec Oume si elle les suit). Il emporte un captif libéré par round vers la forêt. Les joueurs peuvent aussi porter quelqu'un (déplacement divisé par deux, pas d'attaque).</li>
<li><strong>Le four</strong> : la cachette de Tomoshibi. <strong>La trappe</strong> près du four mène à une cave vide (cul-de-sac).</li>
</ul>
<h2>Le combat</h2>
<p>${npc.tomoshibi} a 50 PV, CA 15, <strong>6 PR</strong> et <strong>2 actions par tour</strong>. Il utilise ses arts de sang depuis sa fiche. Tactique détaillée : ${gm("tactiques", "Tactiques des démons")}.</p>
<p>Le combat est plus dur que celui du pont. Rappelez aux joueurs :</p>
<ul>
<li>de dépenser leurs PR pour esquiver les arts de sang les plus dangereux ;</li>
<li>que ses PR sont limités : en enchaînant les formes de Souffle, ils finiront par le toucher ;</li>
<li>que libérer les captifs compte autant que frapper.</li>
</ul>
<h2>Le nom de Kansuke</h2>
<p>Si ${npc.oume} est là, ou si un personnage a lu le carnet, quelqu'un peut appeler le démon par son vrai nom en lui parlant de sa vie d'avant (une action). Tomoshibi fait alors un test d'<strong>Endurance DD 15</strong> (il a 0 en Endurance : jet de 1d20 seul). S'il rate, il devient <strong>Triste</strong> et perd sa prochaine action (choix du scénario). Une seule fois par combat.</p>
${readAloud(`<p>« Kansuke. » La voix d'Oume tremble. « Tu avais toujours froid aux mains. Je te les réchauffais dans les miennes, tu te souviens ? » Le démon se fige. Derrière le masque, les yeux bleus vacillent comme une flamme sous le vent.</p>`)}
<h2>La fin du combat</h2>
<ul>
<li><strong>Victoire</strong> : quand Tomoshibi est décapité, son corps se défait en cendres et en papier brûlé. Jouez la ${gm("epilogue", "dernière scène")}.</li>
<li><strong>S'il est en mauvaise posture</strong> (moins de 15 PV et plus de BDP pour se soigner) : il tente de se réfugier dans le four. Bloquer l'entrée du four est une bonne idée de joueur !</li>
<li><strong>Si les personnages sont en mauvaise posture</strong> : voir ${gm("secours", "Si ça tourne mal")}.</li>
</ul>`,
  },
  {
    key: "epilogue",
    name: "7. Épilogue",
    content: `
<h2>La dernière lumière de Kansuke</h2>
<p>Comme souvent dans <em>Demon Slayer</em>, le démon retrouve un peu de son humanité au moment de disparaître.</p>
${readAloud(`<p>La tête roule sur le plancher brûlé. Le masque de papier se détache. Dessous, il n'y a qu'un visage de garçon, couvert de vieilles cicatrices, qui regarde le ciel.</p><p>« Grand-mère... j'ai froid aux mains. »</p><p>Le corps s'effrite en cendres et en flocons de papier bleu, qui montent vers les étoiles comme des lanternes.</p>`)}
<ul>
<li>Si Oume est là, elle prend la main qui s'efface. Si elle n'est pas là, un personnage peut le faire. Laissez ce moment respirer.</li>
<li>Certains personnages auront pitié, d'autres non (${pc.itsuki} déteste les démons). Les deux réactions sont justes : c'est un beau moment de roleplay.</li>
</ul>
<h2>Le retour au village</h2>
<ul>
<li>Au lever du jour, les captifs sont soignés à l'auberge. ${npc.sota} retrouve Mii. Si un personnage rend l'omamori à Sota, Mii lui saute au cou.</li>
<li>${npc.gonbei} présente des excuses maladroites. Il propose qu'à la prochaine fête, une lanterne bleue soit posée sur la rivière pour Kansuke.</li>
<li>Oume offre à chaque personnage une petite lanterne de papier.</li>
<li>Les corbeaux arrivent : « KAA ! Mission accomplie ! Repos ! Puis nouvelle mission ! KAA ! »</li>
</ul>
<h2>Bilan de mission</h2>
<table>
<tr><th>Résultat</th><th>Conséquence</th></tr>
<tr><td>Les 4 captifs sauvés (Mii, Sota, Fumi, Jirō)</td><td>Victoire totale : le village gardera toujours une chambre pour les pourfendeurs.</td></tr>
<tr><td>1 ou 2 captifs perdus</td><td>Victoire amère : jouez le deuil avec sobriété.</td></tr>
<tr><td>Tomoshibi en fuite</td><td>Il reviendra. Une suite toute trouvée !</td></tr>
</table>
<h2>Et si vous continuez la campagne ?</h2>
<p>Après une mission réussie, un personnage qui a la compétence <em>Pratiquer un souffle secondaire</em> peut apprendre une forme (bouton de progression de mission sur la fiche). Pour la montée en rang, suivez le chapitre « Progression » du livre.</p>
<h2>Les objectifs personnels</h2>
<p>Demandez à chaque joueur si son personnage a atteint son petit objectif (voir les pages de présentation des prétirés). Applaudissez ceux qui l'ont joué !</p>`,
  },
  {
    key: "pnj",
    name: "8. PNJ — fiches rapides",
    content: `
<p>Une phrase pour les jouer, une phrase pour ce qu'ils savent.</p>
<table>
<tr><th>PNJ</th><th>Comment le jouer</th><th>Ce qu'il sait / fait</th></tr>
<tr><td>${npc.shinpei}</td><td>Voix tremblante, se cache derrière son sac, s'excuse tout le temps.</td><td>La liste des disparus. Livre un objet par personnage. Évacue les captifs à l'Acte 3.</td></tr>
<tr><td>${npc.gonbei}</td><td>S'évente nerveusement, parle d'argent, finit par avoir honte.</td><td>L'incendie, la lanterne « bizarre » refusée. Le registre.</td></tr>
<tr><td>${npc.okiku}</td><td>Rit fort, tutoie tout le monde, nourrit tout le monde.</td><td>Les lumières bleues, les détails sur les disparus, le lien avec Oume.</td></tr>
<tr><td>${npc.oume}</td><td>Parle peu, lentement, les mains toujours occupées.</td><td>Kansuke, le bleu, le carnet, la stèle. Peut appeler le démon par son nom.</td></tr>
<tr><td>${npc.mii}</td><td>Petite voix, regarde ses pieds, puis vous fixe droit dans les yeux.</td><td>A vu Sota partir avec « le monsieur à tête de lanterne ». Son dessin.</td></tr>
<tr><td>Captifs : ${npc.sota}, ${npc.fumi}, ${npc.jiro}</td><td>Faibles, perdus, comme réveillés d'un rêve.</td><td>« Il nous parlait. Il disait qu'on était sa famille. »</td></tr>
</table>`,
  },
  {
    key: "tactiques",
    name: "9. Tactiques des démons",
    content: `
<h2>${npc.rodeur} (Acte 2) — démons faibles</h2>
<p><strong>35 PV, CA 11, 4 PR, 1 action par tour.</strong> Morsure 1d4+2, Griffure 3. Deux jetons, un seul acteur.</p>
<ol>
<li>Ils attaquent la cible la plus proche (un PJ ou un villageois).</li>
<li>Ils dépensent un PR pour esquiver chaque forme de Souffle tant qu'ils en ont.</li>
<li>Sous 15 PV, chacun utilise une fois <em>Guérison démoniaque</em> (conseil MJ : une seule fois, pour garder le combat court).</li>
<li>Si l'un des deux est décapité, l'autre tente de fuir vers la forêt.</li>
</ol>
<h2>${npc.tomoshibi} (Acte 3) — démon de rang élevé</h2>
<p><strong>50 PV, CA 15, 6 PR, 50 BDP, 2 actions par tour.</strong> Morsure 1d4+3, Griffure 4, et ses arts de sang (sur sa fiche) :</p>
<ul>
<li><strong>Feu follet bleu</strong> (3 BDP) : attaque à 9 m, 1d6 + Finesse, Brûlure.</li>
<li><strong>Lueur d'oubli</strong> (5 BDP) : attaque à 9 m, 1d4, Charmé.</li>
<li><strong>Lanterne-prison</strong> (6 BDP) : attaque à 4,5 m, 1d4, Emprisonné.</li>
<li><strong>Guérison démoniaque</strong> (2 BDP) : il se soigne de 2d10 PV.</li>
</ul>
<h3>Son plan, round par round</h3>
<table>
<tr><th>Round</th><th>Action 1</th><th>Action 2</th></tr>
<tr><td>1</td><td>Dépose Mii dans une lanterne (elle est Emprisonnée).</td><td>Lueur d'oubli sur le personnage qui semble le plus fort.</td></tr>
<tr><td>2</td><td>Feu follet bleu sur un personnage à distance.</td><td>Lanterne-prison sur quiconque s'approche d'un cocon.</td></tr>
<tr><td>3 et après</td><td>Griffure ou Feu follet sur le personnage le plus blessé.</td><td>Sous 25 PV : Guérison démoniaque. Sinon, Lanterne-prison.</td></tr>
</table>
<h3>Ses réactions</h3>
<ul>
<li>Il esquive (1 PR) les formes de Souffle qui font le plus mal (Coup de tonnerre et éclair, Univers flamboyant, Tigre de flamme...).</li>
<li>Il ne dépense pas de PR contre les attaques normales : il compte sur sa CA.</li>
<li>Quand il n'a plus de PR, décrivez qu'il commence à paniquer.</li>
</ul>
<h3>Ce qu'il dit</h3>
<ul>
<li>« Ne criez pas. Ici, personne n'a froid. Personne n'est seul. »</li>
<li>« Vous voulez une lanterne, vous aussi ? Je peux en faire une très belle. »</li>
<li>(Blessé) « Pourquoi ? Pourquoi personne ne veut rester avec moi ? »</li>
</ul>
${box("Régler la difficulté", `<p><strong>Table de 3 joueurs, ou joueurs en difficulté :</strong> retirez-lui 2 PR (4 au lieu de 6) et 10 PV au départ. <strong>Table expérimentée :</strong> laissez-le utiliser Guérison démoniaque deux fois. Ces réglages sont des choix de MJ, pas des règles du livre.</p>`)}`,
  },
  {
    key: "secours",
    name: "10. Si ça tourne mal",
    content: `
<h2>Un personnage tombe à 0 PV</h2>
<p>Suivez les règles de blessures graves et de mort du livre (chapitres « Blessures » et « Mort »). Pour un one-shot débutant, nous conseillons de ne pas tuer de personnage avant l'Acte 3 : un PJ à 0 PV à l'Acte 2 est simplement assommé et se réveille après le combat avec 1 PV.</p>
<h2>Le groupe va perdre le combat final</h2>
<ul>
<li><strong>La demande d'assistance</strong> (règle du livre) : un personnage peut utiliser le code d'urgence pour appeler des pourfendeurs plus expérimentés. Au bout de 3 rounds, un pourfendeur de haut rang arrive : utilisez par exemple <em>Renjiro, Hashira de la Flamme</em> du compendium « Acteurs - Slayers ». Il met fin au combat en un coup... mais les personnages sauront qu'ils ont eu besoin d'aide.</li>
<li><strong>Oume</strong> arrive et appelle Kansuke (si ce n'est pas déjà fait).</li>
<li><strong>L'aube</strong> : si le combat traîne vraiment, décrivez le ciel qui pâlit. Tomoshibi doit fuir vers le four : les personnages peuvent l'en empêcher pour que le soleil le brûle.</li>
</ul>
<h2>Les joueurs ne trouvent pas la piste</h2>
<p>L'Acte 2 les met de toute façon sur le chemin : Mii est enlevée et les lumières bleues montrent la route.</p>
<h2>Les joueurs veulent attaquer Tomoshibi au pont</h2>
<p>Il est déjà hors de portée et disparaît dans la forêt. Ne lancez pas de dés : c'est une scène de transition.</p>
<h2>Un joueur arrive en retard ou part tôt</h2>
<p>Son personnage peut être avec Shinpei (il arrive avec lui à l'Acte 3) ou rester au village pour protéger les villageois.</p>`,
  },
  {
    key: "aide-memoire",
    name: "11. Aide-mémoire des tests",
    content: `
<table>
<tr><th>Moment</th><th>Test</th><th>DD</th><th>Réussite</th></tr>
<tr><td>Accueil du chef</td><td>Intuition</td><td>13</td><td>Il a peur et cache un vieil incendie.</td></tr>
<tr><td>Faire parler le chef</td><td>Intimidation ou Tromperie</td><td>13</td><td>L'histoire de Kansuke.</td></tr>
<tr><td>Auberge</td><td>Perception ou Intuition</td><td>13</td><td>Le bleu rappelle celui d'Oume.</td></tr>
<tr><td>Atelier d'Oume</td><td>Social (ou l'aider)</td><td>10</td><td>Elle parle de Kansuke.</td></tr>
<tr><td>Atelier d'Oume</td><td>Enquête</td><td>13</td><td>Trois grands moules ont disparu.</td></tr>
<tr><td>Hutte du charbonnier</td><td>Social ou Performance (si brusque)</td><td>13</td><td>Mii parle et montre son dessin.</td></tr>
<tr><td>Hutte du charbonnier</td><td>Perception</td><td>13</td><td>Cire bleue, cendre de papier, traces vers la colline.</td></tr>
<tr><td>Sous le pont</td><td>Enquête</td><td>13</td><td>La gourde de Tatsu : il est mort.</td></tr>
<tr><td>Chemin de la colline</td><td>Perception</td><td>13</td><td>Herbe roussie en cercles.</td></tr>
<tr><td>Chemin de la colline</td><td>Survie ou Nature</td><td>13</td><td>Les traces montent, aucune ne redescend.</td></tr>
<tr><td>Registre du chef</td><td>Enquête</td><td>10</td><td>Les dates coïncident avec l'incendie.</td></tr>
<tr><td>Approche de l'atelier</td><td>Ruse</td><td>13</td><td>Round de surprise.</td></tr>
<tr><td>Se libérer d'une Lanterne-prison</td><td>Force</td><td>13</td><td>Libre (ou un allié coupe le papier).</td></tr>
<tr><td>Appeler « Kansuke »</td><td>Endurance (pour le démon)</td><td>15</td><td>S'il rate : Triste, perd sa prochaine action.</td></tr>
</table>
<p><em>Les DD 10/13/16 sont des repères de ce scénario ; le livre laisse le MJ fixer la difficulté. Le DD 15 de l'état Triste vient du livre.</em></p>`,
  },
];
