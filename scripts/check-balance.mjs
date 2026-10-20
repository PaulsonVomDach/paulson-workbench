// Prüft, ob jeder Trainingstag alle geforderten Bewegungsmuster abdeckt.
// Aufruf: node scripts/check-balance.mjs  → Exit-Code 1, wenn ein Muster fehlt.
//
// WORKOUTS_DATA steht in workouts.js, einem normalen Browser-Script ohne export
// (kein Build, GitHub Pages liefert es direkt aus). Das Skript führt die Datei in
// einer leeren VM-Sandbox aus und liest die Konstante als letzten Ausdruck zurück.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'workouts.js'), 'utf8');
const WORKOUTS_DATA = vm.runInNewContext(`${source}\n;WORKOUTS_DATA`);

// Gezählt werden Hauptteil und Cool-down. Das Warm-up nicht, weil dort Übungen
// nur als Mobilisation laufen (z. B. Cossack Squat in B1) und kein Trainingsreiz sind.
const SECTIONS = ['main', 'cooldown'];

// Dehnungen und Faszienrolle decken kein Kraftmuster ab, auch wenn sie
// z. B. "Bizeps" oder "Adduktoren" im Namen tragen.
const EXCLUDE = /dehnung|stretch|faszienrolle|child's pose|forward fold|thoracic rotation/i;

// Zuordnung nur über den Übungsnamen, nicht über den Cue: Cues enthalten Verweise
// wie "SUPERSET mit Face Pull" und würden sonst falsche Treffer erzeugen.
const PATTERNS = {
  upper: [
    ['vertikaler Zug', /klimmz/i],
    ['horizontaler Zug', /\brow\b|rudern/i],
    ['vertikaler Druck', /pike push-up|schulterdrücken|überkopfdrücken|handstand/i],
    ['horizontaler Druck', /decline push-up|archer|liegestütz|bankdrücken|floor press/i],
    ['Außenrotation', /externe rotation|außenrotation/i],
    ['Innenrotation', /interne rotation|innenrotation/i],
    ['Abduktion Schulter', /seitheben/i],
    ['Protraktion/Serratus', /serratus|scapular push-up/i],
    ['Ellbogenbeugung', /bizeps|band curl|hammer curl/i],
    ['Ellbogenstreckung', /trizeps|dips|french press|kickback/i],
  ],
  legs: [
    ['knie-dominant', /squat|kniebeuge|ausfallschritt|step-up|pistol/i],
    ['hüft-dominant', /kreuzheben|glute bridge|hip thrust/i],
    ['Knieflexion', /nordic curl|beinbeuger|leg curl/i],
    ['Abduktion Hüfte', /seitliches beinheben|clamshell|monster walk|abduktion/i],
    ['Adduktion Hüfte', /adduktoren-slides|copenhagen|adduktion/i],
    ['Wade gestreckt', /wadenheben gestreckt|calf raise/i],
    ['Wade gebeugt', /wadenheben gebeugt|soleus/i],
    ['Schienbein', /tibialis|schienbein/i],
  ],
  core: [
    ['Anti-Extension', /hollow|dead bug|rollout|unterarmstütz|^plank/i],
    ['Anti-Lateralflexion', /side plank|seitstütz|suitcase|koffer/i],
    ['Anti-Rotation', /pallof|anti-rotation/i],
    ['Flexion', /crunch|sit-up|hollow rocks|beinheben hängend/i],
  ],
};

// Jede Prüfung: Titel, welche Workouts zusammen betrachtet werden, welche Muster.
const CHECKS = [
  { label: 'Oberkörper A', keys: ['A'], patterns: PATTERNS.upper },
  { label: 'Oberkörper W3', keys: ['W3'], patterns: PATTERNS.upper },
  { label: 'Beine B1 + B2', keys: ['B1', 'B2'], patterns: PATTERNS.legs },
  { label: 'Rumpf B2', keys: ['B2'], patterns: PATTERNS.core },
];

function exercisesFor(keys) {
  return keys.flatMap(key => {
    const w = WORKOUTS_DATA[key];
    if (!w) throw new Error(`Workout ${key} fehlt in WORKOUTS_DATA`);
    return SECTIONS.flatMap(section =>
      (w[section] || [])
        .filter(ex => !EXCLUDE.test(ex.name))
        .map(ex => ({ key, section, name: ex.name })));
  });
}

const SECTION_LABEL = { main: 'Hauptteil', cooldown: 'Cool-down' };
let missing = 0;

for (const check of CHECKS) {
  const exercises = exercisesFor(check.keys);
  const rows = check.patterns.map(([pattern, regex]) => {
    const hits = exercises.filter(ex => regex.test(ex.name));
    if (hits.length === 0) missing++;
    const where = hits
      .map(h => `${h.name} (${check.keys.length > 1 ? h.key + ', ' : ''}${SECTION_LABEL[h.section]})`)
      .join('; ');
    return [pattern, hits.length ? 'ja' : 'NEIN', where || '–'];
  });

  const header = ['Muster', 'abgedeckt', 'Übung'];
  const widths = [0, 1].map(i => Math.max(header[i].length, ...rows.map(r => r[i].length)));
  const line = r => `${r[0].padEnd(widths[0])}  ${r[1].padEnd(widths[1])}  ${r[2]}`;

  console.log(`\n${check.label}`);
  console.log(line(header));
  console.log(line(['-'.repeat(widths[0]), '-'.repeat(widths[1]), '-----']));
  rows.forEach(r => console.log(line(r)));
}

console.log(missing
  ? `\n${missing} Muster fehlen.`
  : '\nAlle Muster abgedeckt.');
process.exit(missing ? 1 : 0);
