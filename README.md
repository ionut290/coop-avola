# Coop Avola Desktop

Applicazione desktop Windows dedicata al portale:

`https://coopavola.eggsnext.cloud/main/functions/home`

## Funzioni incluse

- URL integrato nel codice: l'utente non deve copiarlo o digitarlo.
- Accesso manuale: ogni utente inserisce il proprio username e la propria password direttamente nel portale.
- Sessione temporanea cancellata alla chiusura dell'app; nessuna credenziale viene memorizzata dall'app desktop.
- Barra superiore sempre visibile con stato Internet, server e latenza.
- Test reale di download e upload tramite Cloudflare Speed Test; aggiornamento ogni 10 minuti e pausa di 30 minuti dopo un errore.
- Numero reale di PC con Coop Avola Desktop aperta sulla stessa rete locale, senza servizi Firebase esterni.
- Tempo trascorso dall'ultimo salvataggio confermato da una risposta HTTP positiva del server.
- Modalità Lavagna configurabile dal menu Diagnosi: apertura automatica, schermo intero e pannelli laterali nascosti.
- Controllo automatico ogni 15 secondi.
- Protezione locale automatica dei campi modificati e non ancora confermati dal server, senza premere “Salva” e senza bloccare la lavagna.
- Nessuna ricarica automatica quando ritorna Internet: la pagina e la sessione aperta vengono mantenute.
- Avviso di sicurezza prima delle ricariche manuali quando esiste una bozza non salvata.
- Pulsanti Indietro, Avanti, Home, Ricarica e Diagnosi.
- Ricarica senza cache, riavvio della pagina e strumenti tecnici.
- Registro degli errori di rete, caricamento e console, copiabile.
- Rilevamento pagina bloccata o processo interrotto.
- Link esterni aperti nel browser predefinito; il portale resta nell'app.
- Download e finestre del portale gestiti dal motore desktop.
- Aggiornamenti futuri scaricati automaticamente da `ionut290/coop-avola`; quando sono pronti basta scegliere “Riavvia e aggiorna”.

## Avvio in modalità sviluppo

1. Installare Node.js LTS.
2. Aprire un terminale nella cartella del progetto.
3. Eseguire `npm install`.
4. Eseguire `npm test` per controllare sintassi, versione e protezioni.
5. Eseguire `npm start`.

## Creazione installer Windows

Per chi riceve l'applicazione è sufficiente fare doppio clic sul file
`Coop-Avola-Desktop-Setup-1.2.5.exe`. Non servono Node.js, terminale o file aggiuntivi.
Questa è l'ultima versione che richiede un'installazione manuale: dalla versione successiva l'app controlla e scarica gli aggiornamenti da sola.

La sezione seguente serve esclusivamente allo sviluppatore che vuole ricompilare i sorgenti.

Metodo manuale, su un PC Windows, dalla cartella del progetto:

1. Eseguire `npm install`.
2. Eseguire `npm run setup:win` per ottenere `Coop-Avola-Desktop-Setup-1.2.5.exe`, il relativo file `.blockmap` e `latest.yml`.

L'installer crea il collegamento sul desktop e nel menu Start. Disinstallando l'app, i dati della sessione non vengono cancellati automaticamente.

## Nota tecnica

L'app utilizza Electron/Chromium in una finestra dedicata. Questo elimina interferenze tipiche del browser normale (schede, estensioni, barre, apertura accidentale di altre pagine), ma un problema reale del server remoto o della rete non può essere eliminato: viene riconosciuto, descritto e gestito con gli strumenti di recupero inclusi.

La protezione locale può ripristinare automaticamente campi di testo, selezioni e controlli della pagina. Le operazioni complesse della lavagna (per esempio trascinamenti gestiti internamente dal portale) restano visibili finché la pagina non viene ricaricata, ma non possono essere ricostruite con garanzia senza un'API del portale: per questo l'app evita ogni ricarica automatica e chiede conferma prima di quelle manuali.
