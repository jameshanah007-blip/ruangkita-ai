import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), 'utf8');

const genres = ['monster_tamer','farming','adventure','rpg','platformer','racing','puzzle','shooter','strategy','simulation','survival'];
const definitions = read('app/fun-zone/phaser/genreDefinitions.ts');
const runtime = read('app/fun-zone/phaser/runtime.ts');
const builder = read('app/fun-zone/phaser/builder.ts');
const authority = read('app/fun-zone/engine2d/authoritative2D.ts');

for (const genre of genres) {
  if (!definitions.includes('genre: "' + genre + '"')) throw new Error('Missing Phaser genre definition: ' + genre);
}

for (const marker of ['Phaser.Scene','new Phaser.Game','Phaser.AUTO','Phaser.Scale.FIT','__RK_GAME_TEST__','__RK_2D_ENGINE_V2__','performTestAction','restart']) {
  if (!runtime.includes(marker)) throw new Error('Missing runtime marker: ' + marker);
}

if (!builder.includes('buildPhaserRuntime')) throw new Error('Phaser builder is not connected to the runtime.');
if (!authority.includes('buildAuthoritativePhaserGame')) throw new Error('Authoritative 2D compatibility shim is not routed to Phaser.');
if (authority.includes('build2DGameHtml') || authority.includes('buildGenreRuntime')) throw new Error('Authoritative shim still depends on legacy engine2d runtime.');

console.log('Fun Zone Phaser architecture test: PASS');
console.log('Genres checked: ' + genres.length);
console.log('Runtime: Phaser 3.90.0');