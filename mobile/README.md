# Coop Avola Mobile

Applicazione Android basata su Capacitor che apre direttamente la Lavagna Pianificazione e applica un adattamento mobile.

## Funzioni

- login manuale nel portale originale;
- pulsante `☰ Commesse` per aprire l'elenco delle commesse padre;
- schede delle commesse disposte verticalmente;
- campo per memorizzare localmente il nome dell'operatore;
- pulsante `La mia squadra` per mostrare la scheda contenente l'operatore;
- selezione `Tutte le commesse` per filtrare una singola commessa;
- supporto verticale e orizzontale.

L'adattamento riconosce gli elementi visuali del portale perché non sono disponibili API o sorgenti della Lavagna. Se il portale cambia struttura, può essere necessario aggiornare `www/mobile-adapter.js`.

## Sviluppo

```bash
npm install
npx cap sync android
npx cap open android
```
