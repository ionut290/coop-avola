const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const config = JSON.parse(read('capacitor.config.json'));
const adapter = read('www/mobile-adapter.js');
const activity = read('android/app/src/main/java/it/coopavola/mobile/MainActivity.java');

assert.equal(config.appId, 'it.coopavola.mobile');
assert.equal(config.server.url, 'https://coopavola.eggsnext.cloud/main/functions/home');
assert(adapter.includes('☰ Commesse'), 'Pulsante commesse padre mancante.');
assert(adapter.includes('La mia squadra'), 'Filtro squadra mancante.');
assert(adapter.includes('Tutte le commesse'), 'Filtro commessa mancante.');
assert(adapter.includes('coop_avola_mobile_name'), 'Memorizzazione locale del nome mancante.');
assert(adapter.includes('data-coop-mobile-card'), 'Adattamento verticale delle schede mancante.');
assert(activity.includes('TRUSTED_HOST = "coopavola.eggsnext.cloud"'), 'Dominio autorizzato non configurato.');
assert(activity.includes('evaluateJavascript(mobileAdapter'), 'Iniezione adattamento mobile mancante.');
assert(!adapter.includes('password'), 'L’adattatore non deve leggere o memorizzare password.');

console.log('Verifica Coop Avola Mobile 0.1.0 superata.');
