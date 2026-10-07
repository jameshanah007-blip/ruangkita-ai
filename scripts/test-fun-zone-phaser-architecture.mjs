import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), 'utf8');

const genres = ['monster_tamer','farming','adventure','rpg','platformer','racing','puzzle','shooter','strategy','simulation','survival'];
const definitions = read('app/fun-zone/phaser/genreDefinitions.ts');
const contracts = read('app/fun-zone/phaser/contracts.ts');
const runtime = read('app/fun-zone/phaser/runtime.ts');
const builder = read('app/fun-zone/phaser/builder.ts');
const laboratory = read('app/api/fun-zone/laboratory/route.ts');
const debugRoute = read('app/api/fun-zone/debug/route.ts');
const legacyEngineDir = join(root, 'app/fun-zone/engine2d');

for (const genre of genres) {
  if (!definitions.includes('genre:"' + genre + '"') && !definitions.includes('genre: "' + genre + '"')) {
    throw new Error('Missing Phaser genre definition: ' + genre);
  }
  if (!contracts.includes(genre + ':')) {
    throw new Error('Missing Phaser genre contract: ' + genre);
  }
}

for (const marker of ['Phaser.Scene','new Phaser.Game','Phaser.AUTO','Phaser.Scale.FIT','__RK_GAME_TEST__','__RK_2D_ENGINE_V2__','__RK_PHASER_BOOT_SPEC__','performTestAction','restart']) {
  if (!runtime.includes(marker)) throw new Error('Missing runtime marker: ' + marker);
}

if (!builder.includes('buildPhaserRuntime')) throw new Error('Phaser builder is not connected to the runtime.');
if (!laboratory.includes('buildAuthoritativePhaserGame')) throw new Error('Laboratory route is not connected to the authoritative Phaser builder.');
if (!debugRoute.includes('Phaser 3.90.0')) throw new Error('Debugger route does not enforce Phaser 3.90.0 authority.');
if (existsSync(legacyEngineDir)) throw new Error('Legacy app/fun-zone/engine2d path must remain removed from the active architecture.');
if (runtime.includes('window.parent.postMessage')) throw new Error('Phaser runtime must not communicate with the parent window.');
if (debugRoute.includes('engine2d/')) throw new Error('Debugger route must not import the legacy engine2d path.');
if (laboratory.includes('engine2d/')) throw new Error('Laboratory route must not import the legacy engine2d path.');

console.log('Fun Zone Phaser architecture test: PASS');
console.log('Genres checked: ' + genres.length);
console.log('Runtime: Phaser 3.90.0');
