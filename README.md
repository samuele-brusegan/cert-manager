# Cert Manager

Sistema web per la gestione di certificati **X.509** con una propria **CA root**, integrato con **Nginx Proxy Manager (NPM)**.

Permette di:

- Creare o importare una **CA root** e firmare certificati X.509.
- Generare **script di trust** per Linux, macOS e Windows così che i client si fidino della CA (niente più avvisi "self-signed").
- Gestire i **Proxy Host** di NPM (creazione, lista, attiva/disattiva, SSL con Force SSL, HSTS, HSTS sub-domains, HTTP/2, WebSocket).
- Inviare i certificati emessi direttamente a NPM e consultare la **lista dei certificati**.

## Architettura

| Componente | Stack |
|------------|-------|
| Backend    | Node.js + Express, certificati con `node-forge` |
| Frontend   | React + Vite + Tailwind CSS |
| Storage    | Filesystem locale (`data/`) — nessun database applicativo |
| Dati NPM   | API di Nginx Proxy Manager |
| Deploy     | Docker Compose |

I dati persistenti (CA, certificati emessi, credenziali NPM) risiedono in `data/`
(o nel volume Docker `cert_data`). La chiave privata della CA è salvata con permessi `600`.

## Avvio con Docker Compose

```bash
docker compose up -d --build
```

UI disponibile su **http://localhost:8091**.

Il campo **Host di forward** dei Proxy Host propone i container collegati alla
rete Docker `reverse-proxy`, separando quelli non ancora utilizzati da quelli
già associati. Il backend legge questa informazione dal Docker Engine tramite
`/var/run/docker.sock`; se la rete o il socket non sono disponibili, è sempre
possibile scegliere **Inserisci manualmente** e usare un IP o hostname.

> Per gli script di trust scaricati dai client, imposta `PUBLIC_URL` nel
> servizio `backend` del `docker-compose.yml` con l'URL pubblico raggiungibile
> dai client (es. `https://certs.example.com`).

## Sviluppo locale

```bash
# Backend (porta 3001)
cd backend && npm install && npm run dev

# Frontend (porta 5173, proxy /api -> :3001)
cd frontend && npm install && npm run dev
```

## Primo utilizzo

1. **Setup** → al primo avvio inserisci l'URL di NPM (verifica di raggiungibilità).
2. **Login** → accedi con le **credenziali NPM** (vedi sotto).
3. **CA Root** → crea una nuova CA o importane una esistente (cert + chiave PEM).
4. **Certificati SSL** → emetti certificati firmati dalla CA root senza creare un Proxy Host. Puoi scaricarli oppure caricarli come certificati custom su NPM.
5. **Proxy Hosts** → crea i proxy host scegliendo il certificato e le opzioni SSL.
6. **Script di Trust** → scarica/copia lo script per l'OS del client ed eseguilo come admin.

## Autenticazione

L'accesso alla UI è protetto e si appoggia all'**auth di Nginx Proxy Manager**: si
accede con le **stesse credenziali** (email + password) di NPM, verificate live
contro `/api/tokens`.

- **Setup iniziale**: l'URL di NPM si imposta in una schermata pubblica al primo
  avvio; dopo, è modificabile solo da utenti autenticati.
- **Sessioni**: per-client e gestite lato server (in memoria). Il logout invalida
  davvero la sessione; alla scadenza idle (default 8h, `SESSION_TTL_HOURS`) o al
  riavvio del server è necessario ri-loggarsi.
- **Cookie**: `HttpOnly`, `SameSite=Lax`. Dietro HTTPS attiva `COOKIE_SECURE=true`.
- Tutte le API sono protette tranne `GET /api/ca/download` (il certificato root è
  pubblico ed è scaricato dai client tramite gli script di trust senza sessione).

## Script di Trust

Disponibili sia generati dinamicamente dalla UI (con URL del cert già impostato),
sia come file standalone in `scripts/`:

```bash
# Linux (Debian/Ubuntu, RHEL/Fedora, Arch)
sudo ./scripts/trust-linux.sh https://certs.example.com/api/ca/download

# macOS
sudo ./scripts/trust-macos.sh https://certs.example.com/api/ca/download

# Windows (PowerShell come Amministratore)
.\scripts\trust-windows.ps1 -Source "https://certs.example.com/api/ca/download"
```

Gli script accettano anche un percorso a un file `.crt` locale invece di un URL.

## API del backend

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/ca` | Info CA root |
| POST | `/api/ca` | Crea CA root |
| POST | `/api/ca/import` | Importa CA root |
| GET | `/api/ca/download` | Scarica cert root (.crt) |
| DELETE | `/api/ca` | Elimina CA root |
| GET | `/api/certs` | Lista certificati emessi |
| POST | `/api/certs` | Emetti certificato X.509 |
| GET | `/api/certs/:id/download?file=cert\|key\|fullchain` | Scarica file |
| POST | `/api/certs/:id/push-to-npm` | Invia il certificato a NPM |
| DELETE | `/api/certs/:id` | Elimina certificato |
| GET | `/api/npm/proxy-hosts` | Lista proxy host |
| POST | `/api/npm/proxy-hosts` | Crea proxy host |
| PUT | `/api/npm/proxy-hosts/:id` | Modifica proxy host |
| POST | `/api/npm/proxy-hosts/:id/enable\|disable` | Attiva/disattiva |
| DELETE | `/api/npm/proxy-hosts/:id` | Elimina proxy host |
| GET | `/api/npm/certificates` | Lista certificati NPM |
| GET | `/api/npm/access-lists` | Lista access list |
| GET/PUT/POST | `/api/settings`, `/api/settings/npm`, `/api/settings/npm/test` | Config NPM |
| GET | `/api/scripts/:os` | Script di trust (`linux`/`macos`/`windows`) |
| GET | `/api/auth/status` | Stato auth (configured/authenticated/user) |
| POST | `/api/auth/setup` | Imposta l'URL NPM (setup iniziale) |
| POST | `/api/auth/login` | Login con credenziali NPM |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/hosts` | Legge il file hosts (contenuto + voci gestite + scrivibilità) |
| POST | `/api/hosts` | Aggiunge voci: `{ ip, domains: [...] }` |
| DELETE | `/api/hosts` | Rimuove voci gestite: `{ domains: [...] }` |
| PUT | `/api/hosts` | Sovrascrive l'intero file: `{ content }` |

## Troubleshooting: connessione a NPM

L'URL di NPM inserito nelle Impostazioni viene risolto **dall'interno del container
backend**, non dal tuo browser. Scegli l'URL in base a dove gira NPM:

| Dove gira NPM | URL da usare nella UI | Note |
|---------------|-----------------------|------|
| Altro compose, **stesso host** (porta 81 pubblicata) | `http://host.docker.internal:81` | Richiede `extra_hosts: host.docker.internal:host-gateway` (già nel compose) |
| **Stessa rete Docker** di Cert Manager | `http://<nome-container-npm>:81` | Collega il backend alla rete di NPM (vedi blocco `networks` commentato nel compose) |
| **Host/VM separata** | `http://<ip-o-dominio>:81` | NPM raggiungibile in rete |
| **Bare-metal sull'host** | `http://host.docker.internal:81` (o IP host) | Stessa logica del primo caso |

### Errori comuni e cosa significano

Il backend ora restituisce messaggi diagnostici espliciti (codice errore incluso):

- **`ENOTFOUND`** → DNS fallito: l'hostname non è risolvibile *da dentro il container*.
  Causa tipica: hai usato `localhost` (= il container stesso) o il nome di un container
  che sta su un'altra rete Docker. **Non** è un URL malformato e **non** è un errore 5xx
  (un 500 implica che la connessione è riuscita).
- **`ECONNREFUSED`** → host risolto ma porta chiusa: porta sbagliata (la admin è di solito `81`).
- **`ETIMEDOUT`** → host irraggiungibile: rete/firewall.
- **`ERR_SSL_WRONG_VERSION_NUMBER`** → stai usando `https://` su una porta `http`. Usa `http://`.
- **HTTP 401** → credenziali (email/password) errate.
- **"Risposta non in formato JSON"** → l'URL non punta davvero all'API di NPM.

Diagnosi rapida dall'interno del container:

```bash
docker compose exec backend wget -qO- http://host.docker.internal:81/api/ || \
  echo "NPM non raggiungibile con questo URL"
```

Il timeout delle richieste verso NPM è configurabile con la variabile d'ambiente
`NPM_TIMEOUT` (millisecondi, default `15000`).

## File hosts (DNS locale)

Quando crei un proxy host puoi spuntare **"Aggiungi a /etc/hosts"**: appare un campo
per l'IP di destinazione (default `127.0.0.1`) e i domini del proxy host vengono
scritti nel file hosts del **server** che esegue il backend.

- Il percorso è rilevato automaticamente in base all'OS del server
  (`/etc/hosts` su Linux/macOS, `C:\Windows\System32\drivers\etc\hosts` su Windows)
  ed è sovrascrivibile con la variabile d'ambiente `HOSTS_FILE`.
- Le righe gestite sono marcate con `# cert-manager`, quindi le altre voci non
  vengono mai toccate; riaggiungere lo stesso dominio aggiorna l'IP.
- La scrittura richiede permessi adeguati (root/Administrator). La UI segnala se il
  file non è scrivibile.

La pagina **File Hosts** mostra tutte le voci del file (IP, hostname, origine
*Cert Manager* o *manuale*) e il contenuto grezzo, e permette di rimuovere le voci
gestite. Inoltre, nella pagina **Proxy Hosts**, per ogni proxy host i cui domini
(non IP) non sono ancora nel file hosts compare un pulsante rapido per aggiungerli
(verso `127.0.0.1`).

**In Docker** il `/etc/hosts` del container è effimero. Per modificare quello reale
dell'host, monta il file e imposta `HOSTS_FILE` (vedi `docker-compose.yml`):

```yaml
environment:
  - HOSTS_FILE=/host-etc-hosts
volumes:
  - /etc/hosts:/host-etc-hosts
```

## Note di sicurezza

- La chiave privata della CA non lascia mai il server e non è esposta via API.
- Le credenziali NPM sono salvate in `data/config.json` (permessi `600`); la
  password non viene mai restituita dalle API di lettura.
- Esegui il servizio dietro HTTPS in produzione e proteggi l'accesso alla UI.
