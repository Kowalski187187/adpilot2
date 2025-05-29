# AdPilot – AI-drevet markedsføringsplattform for Shopify

**AdPilot** er en modulær AI-drevet markedsføringsplattform utviklet for Shopify-butikker. Plattformen automatiserer opprettelse og optimalisering av annonsekampanjer gjennom A/B-testing av produkter og annonser. AdPilot består av flere mikrotjenester som samarbeider for å kjøre annonser på tvers av Meta (Facebook/Instagram) og Google Ads, spore konverteringer, beregne **ROAS** (Return on Ad Spend, dvs. avkastning på annonsekostnad) og automatisk justere kampanjene for best resultat.

Denne README beskriver systemarkitekturen, hvordan man installerer og kjører AdPilot lokalt med Docker Compose, detaljer om hver modul, hvordan modulene kommuniserer, hvordan man starter en testkampanje og overvåker ROAS, eksempler på API-kall, samt tips for produksjonssetting.

## Systemarkitektur

AdPilot er bygget som en **mikrotjenestearkitektur** der hver komponent har et tydelig avgrenset ansvar. Kommunikasjon mellom tjenestene skjer hovedsakelig via REST API-kall over et internt nettverk (i Docker Compose). Under er en oversikt over arkitekturen og hvordan komponentene henger sammen:

* **Frontend Dashboard (React + Tailwind + Zustand)** – Et webbasert dashbord som brukes av markedsførere/butikkeiere til å konfigurere kampanjer, starte A/B-tester og se resultater. Frontend-appen kommuniserer kun med Orchestrator API for alle operasjoner (via HTTPS/REST).
* **Orchestrator API (Node.js + Express)** – Kjernen i systemet og fungerer som API-gateway og koordinator. Orchestrator mottar forespørsler fra frontend og kaller videre de underliggende mikrotjenestene etter behov. Orchestrator håndterer også vedvarende lagring (MongoDB) og caching (Redis).
* **Test Engine Service** – En bakgrunnstjeneste som håndterer logikken for A/B-testing av produkter og annonser. Når en ny testkampanje startes, bestemmer Test Engine hvordan testen skal kjøres (f.eks. hvilke varianter som skal annonseres), overvåker kampanjeytelse (ROAS) og **automatisk bytter** til vinner-varianten basert på forhåndsbestemte kriterier for ROAS.
* **Meta Ads Manager Service** – En integrasjonstjeneste mot Facebook/Meta Marketing API. Denne tjenesten oppretter og administrerer Facebook/Instagram-annonser (kampanjer, annonsesett, annonser) via Meta API, på vegne av AdPilot.
* **Google Ads Manager Service** – Tilsvarende integrasjonstjeneste for Google Ads. Den er skrevet i Python og bruker Googles offisielle `google-ads-python` SDK for å opprette og styre kampanjer på Google Ads-plattformen.
* **Tracking Layer** – Sporingslaget samler inn data om brukeradferd og konverteringer. Dette kan settes opp ved hjelp av **RudderStack (open source)** som datarouter eller ved å bruke en **Google Tag Manager (GTM) webhook**. Tracking Layer sender konverteringshendelser (f.eks. kjøp i nettbutikken) tilbake til Orchestrator (eller direkte til databasen) slik at AdPilot kan knytte annonsekostnad til inntekt og beregne ROAS.
* **Data Store** – Deles av plattformen for lagring og rask data-tilgang:

  * **MongoDB** brukes som vedvarende lagringsdatabase for konfigurasjon av kampanjer, testresultater (ROAS per variant, valgt vinner, historikk) og produktstatistikk.
  * **Redis** brukes som cache for å mellomlagre ofte brukte data og redusere responstid. Eksempler på data som kan caches er resultatberegninger, tilgangstoken for APIer, eller produktinformasjon fra Shopify.

**Arkitekturdiagram (logisk oppbygning):**

```
Frontend Dashboard (React) --[REST]--> Orchestrator API (Node/Express)
    |                                  |---> Test Engine Service (A/B-test logikk)
    |                                  |         |---> Meta Ads Manager Service (Facebook API)
    |                                  |         `---> Google Ads Manager Service (Google Ads API)
    |                                  |---> Tracking Layer (RudderStack / GTM Webhook)
    |                                  |---> MongoDB (kampanjedata, resultater)
    |                                  `---> Redis (cache)
    \ 
     `-- (Brukeren interagerer med Frontend Dashboard for å styre AdPilot) 
```

*Forklaring:* Frontend-appen kommuniserer med Orchestrator API for alle handlinger (f.eks. starte en test). Orchestrator kaller så Test Engine Service for å sette opp A/B-testen. Test Engine bruker Meta Ads og Google Ads tjenestene til å opprette faktiske annonser via eksterne API-er. Konverteringsdata fra nettbutikken strømmer inn gjennom Tracking Layer (RudderStack eller GTM) tilbake til Orchestrator/DB. Orchestrator og Test Engine benytter MongoDB for lagring av kampanjestatus og resultater, og Redis for å cache data som trengs raskt (f.eks. midlertidige beregninger eller tokens).

## Komponenter i AdPilot

Nedenfor følger en detaljert forklaring av hver modul/tjeneste, inkludert ansvar, teknologier, konfigurasjon og hvordan man kjører og tester dem individuelt.

### Frontend Dashboard (React)

**Ansvar og funksjon:** Frontend Dashboard er brukergrensesnittet til AdPilot. Det lar Shopify-butikkeiere opprette nye kampanjer, velge produkter som skal A/B-testes, sette budsjetter og varighet, samt overvåke resultater (ROAS, konverteringer, valgt vinnervariant). Dashbordet presenterer data hentet fra Orchestrator API og gir sanntidsinnsikt i pågående tester. Det inkluderer visuelle komponenter for grafer, tabeller over kampanjer, og kontrollpanel for å starte/stoppe tester.

**Teknologi:** Implementert som en **Single Page Application** i React. UI er bygget med Tailwind CSS for rask styling og responsivt design, og Zustand brukes for state management på klientsiden (for å håndtere globale tilstander som brukervalgt butikk, innloggingsstatus, valgte produkter osv.). Applikasjonen kan ha blitt bootstrapet med Create React App eller Vite, og er skrevet i moderne JavaScript/TypeScript. Bygget resulterer i statiske filer som kan serveres via en webserver.

**Miljøvariabler og konfigurasjon:** Frontend-appen krever typisk noen få miljøvariabler, hovedsakelig for å vite hvordan den skal kommunisere med backend-APIet. I utviklingsmodus ligger disse i en `.env`-fil i frontend-mappen. Nøkler som kan konfigureres inkluderer for eksempel:

* **REACT\_APP\_API\_BASE\_URL** – Basis-URL til Orchestrator API. Dette må peke på endepunktet hvor Orchestrator kjører (f.eks. `http://localhost:4000/api` under lokal utvikling).
* **REACT\_APP\_TRACKING\_KEY** – (Valgfritt) ID eller nøkkel for sporing dersom frontend laster inn et sporingsskript (f.eks. RudderStack write key eller GTM container ID).
* **NODE\_ENV** – Settes til `development` for lokal kjøring (typisk automatisk satt av react-scripts).

**Oppstart (lokalt utviklingsmiljø):** For å kjøre dashbordet lokalt uten Docker, gå til `frontend/`-mappen og kjør:

```bash
npm install          # Installer avhengigheter
npm start            # Starter utviklingsserver (typisk http://localhost:3000)
```

Dette vil starte en utviklingsserver som automatisk åpner applikasjonen i nettleseren. Frontenden vil proxye API-kall til Orchestrator (dersom det er konfigurert i f.eks. package.json eller .env). Sørg for at Orchestrator API kjører for at dashbordet skal få kontakt.

I **Docker Compose** kjører frontend som en egen container. Dockerfile-en vil bygge appen (f.eks. kjøre `npm run build`) og deretter kunne servere de statiske filene via en enkel server (nginx eller en node server). Alternativt kan man i dev-mode mappe port 3000 fra containeren for hot-reloading. I vår Docker Compose-konfigurasjon er det enklest å bygge frontenden som statisk side: React-appens build kjøres og filene blir servert. Du kan deretter nå dashbordet på `http://localhost:3000` (hvis port 3000 er eksponert) eller annen konfigurert port.

**Testing av Frontend:** Siden frontend hovedsakelig er et grensesnitt, testing gjøres manuelt ved å interagere med applikasjonen i nettleseren. Etter oppstart, naviger gjennom påloggingsflyt (hvis relevant), forsøk å opprette en kampanje, og bekreft at data hentes korrekt (du må ha backend kjørende og konfigurert). Det er også mulig å skrive enhetstester for React-komponenter (f.eks. med Jest/React Testing Library), men detaljene på dette avhenger av implementasjonen. For formålet med plattformen fokuserer man mest på integrasjonstesting: at hele kjeden fra frontend til backend fungerer.

### Orchestrator API (Node.js + Express)

**Ansvar:** Orchestrator API er navet i AdPilot. Det utgjør backendens **RESTful API** som frontend-klienten bruker. Hovedansvarene inkluderer:

* Motta API-forespørsler fra frontend (f.eks. opprette ny testkampanje, hente status/resultater).
* Validere input (sjekke at parametere er gyldige, f.eks. at produktIDer er angitt, budsjetter er tall, osv.).
* **Orkestrere** de underliggende tjenestene: Basert på forespørselen kaller Orchestrator de nødvendige mikrotjenestene. For eksempel, når en ny test skal startes, vil Orchestrator involvere Test Engine Service (og indirekte Meta/Google Ads Services via Test Engine).
* Kommunisere med **databasen**: Orchestrator leser fra og skriver til MongoDB for å lagre informasjon om kampanjer, annonser og resultater. For eksempel lagres en ny kampanjeoppføring når en test startes, og resultater oppdateres når de foreligger.
* Håndtere konverteringshendelser: Orchestrator kan eksponere et webhook/endepunkt for sporingssystemet (RudderStack/GTM) slik at innkommende hendelser som kjøp registreres i systemet.
* Tjene som et samlet grensesnitt: Skjuler kompleksiteten ved de ulike mikrotjenestene fra frontend. Frontend trenger kun å forholde seg til Orchestrator API, som tilbyr konsise endepunkter for nødvendige operasjoner (f.eks. `POST /api/campaigns` for å starte test, `GET /api/campaigns/{id}` for status).

**Teknologi og implementasjon:** Orchestrator er implementert i Node.js med Express rammeverket for å håndtere HTTP-endepunkter. Express gjør det enkelt å definere ruter som fanger opp spesifikke URL-mønstre og knytte dem til kontrollere (funksjoner som utfører logikk). Strukturen kan f.eks. være:

* `routes/` mappe med definisjon av REST-ruter (f.eks. `campaignRoutes.js` som definerer ruter som `/api/campaigns`).
* `controllers/` mappe med logikk for hver rute (f.eks. `campaignController.js` med funksjoner `startCampaign`, `getCampaignResult` etc.).
* `services/` eller `clients/` for å kalle eksterne tjenester (f.eks. en klient for Test Engine API, en for Meta Ads API, osv., som igjen gjør HTTP-forespørsler til disse).
* Databasetilgang via et bibliotek som Mongoose (ODM) eller Native MongoDB driver. Her kan Orchestrator definere modeller for f.eks. Campaign, TestResult, ProductStats etc.

**Miljøvariabler:** Orchestrator krever en del konfigurasjon via miljøvariabler. Disse settes i en `.env`-fil for lokal kjøring, og i Docker Compose legges de inn under tjenesten. Viktige variabler inkluderer:

* **PORT** – Porten som Orchestrator API skal kjøre på (f.eks. 4000). I Docker Compose kan denne eksponeres ut til host.
* **MONGODB\_URI** – MongoDB-forbindelsesstreng. F.eks. `mongodb://mongo:27017/adpilot` dersom MongoDB kjører som container med navnet `mongo`. Alternativt kan man angi separat `MONGO_HOST`, `MONGO_PORT`, `MONGO_DB` og bygge URI ut fra det.
* **REDIS\_HOST** / **REDIS\_PORT** – Konfigurasjon for Redis. Lokalt i Docker Compose vil `redis` være host-navnet (container-navnet) om de deler nettverk.
* **TESTENGINE\_URL** – Basis-URL for Test Engine Service API. F.eks. `http://test-engine:5000` (hvor `test-engine` er container-navnet og 5000 er porten Test Engine kjører på internt). Orchestrator bruker denne for å delegere testoppgaver.
* **METAADS\_URL** – URL for Meta Ads Manager Service. For eksempel `http://meta-ads:5001` om den kjører på port 5001 internt.
* **GOOGLEADS\_URL** – URL for Google Ads Manager Service (f.eks. `http://google-ads:5002`).
* **TRACKING\_WEBHOOK\_SECRET** – (Hvis aktuelt) en hemmelig nøkkel for å verifisere at sporingshendelser kommer fra en gyldig kilde (f.eks. GTM webhook kan inkludere en token som må matche denne).
* **FACEBOOK\_APP\_ID**, **FACEBOOK\_APP\_SECRET** – *Valgfritt:* Orchestrator trenger vanligvis ikke FB App ID/Secret direkte, da Meta Ads Service håndterer integrasjonen. Men hvis Orchestrator skal initiere OAuth-flow eller verifisere ting med Facebook, kan disse være aktuelle.
* **GOOGLE\_OAUTH\_CLIENT\_ID**, **GOOGLE\_OAUTH\_CLIENT\_SECRET** – Tilsvarende for Google integrasjon (som regel ikke direkte brukt av Orchestrator med mindre Orchestrator håndterer OAuth-autorisasjon for Google Ads-kontoen).
* **JWT\_SECRET** – *Valgfritt:* Hvis Orchestrator implementerer autentisering/innlogging (f.eks. JWT for å sikre API-et, noe som kan være aktuelt i en produksjonssetting slik at kun autoriserte brukere får aksess).

*(Ovenstående variabler er eksempler; faktiske navn kan variere avhengig av implementasjon. Sjekk `.env.example` eller dokumentasjon i koden for nøyaktige variabler.)*

**Oppstart (uten Docker):** For å kjøre Orchestrator lokalt på utviklingsmaskinen, kreves Node.js (f.eks. v14+). Gjør følgende i `orchestrator/` mappen:

```bash
npm install             # Installerer Node-avhengigheter
npm run dev             # Starter server i utviklingsmodus (f.eks. med nodemon for autoreload)
# Alternativt:
npm start               # Starter server (produksjonsmodus, uten autoreload)
```

Hvis alt er konfigurert riktig, vil Orchestrator starte opp og lytte på definert PORT (for eksempel `http://localhost:4000`). Du bør se loggmeldinger som indikerer at serveren kjører, tilkobling til MongoDB er etablert osv. For å teste kjapt kan du i en nettleser eller med `curl` gjøre et kall til f.eks. `http://localhost:4000/health` eller tilsvarende endepunkt (om definert) for å sjekke status. Orchestrator bør returnere en respons (f.eks. `{ status: "ok" }` eller liknende).

I **Docker Compose** startes Orchestrator som en container definert i `docker-compose.yml`. Den vil typisk bygge fra Dockerfile i `orchestrator/` som kopierer koden, kjører `npm install` og eksponerer porten. Orchestrator-containeren kobles på samme nettverk som de andre tjenestene slik at den kan nå `mongo`, `redis`, `test-engine`, `meta-ads` osv. via deres tjenestenavn.

**Testing av Orchestrator API:** Med Orchestrator kjørende kan du teste funksjonalitet via verktøy som **curl eller Postman**. Noen vanlige scenarier:

* **Hente tilgjengelige kampanjer:** `GET http://localhost:4000/api/campaigns` skal returnere en liste (JSON) over kampanjer/tester (muligens tom første gang).
* **Starte en ny kampanje/test:** `POST http://localhost:4000/api/campaigns` med nødvendig JSON-body (mer detaljert eksempel i eget avsnitt nedenfor). Forventer at en ny kampanje opprettes, at Orchestrator kaller under-tjenestene (du kan se i Orchestrator-logger at den f.eks. sender forespørsel til Test Engine), og at du får en respons med detaljer om opprettet test (inkludert et generert test-ID, status osv.).
* **Hente resultater:** Etter at en test har kjørt en stund, `GET http://localhost:4000/api/campaigns/{id}` bør gi detaljer inkludert beregnet ROAS for variantene, konverteringsstatistikk og om testen er avsluttet/vinner valgt.
* **Simulere konverterings-webhook:** (Valgfritt) `POST http://localhost:4000/api/track` med en simulert hendelse for å se at Orchestrator tar imot og lagrer det. Dette krever at Orchestrator har et slikt endepunkt implementert.

Merk at Orchestrator i seg selv ikke utfører tunge dataoppgaver; det overlater den til Test Engine og de andre tjenestene. Dermed bør svarene fra Orchestrator være relativt kjappe (den venter typisk ikke på at en hel A/B-test skal fullføres – den starter prosessen og svarer at testen er i gang).

### Test Engine Service

**Ansvar:** Test Engine Service er hjernen bak A/B-testingen. Dens hovedoppgave er å ta imot instruks om en ny test, gjennomføre testen over tid, og optimalisere basert på resultat:

* **Opprette varianter:** Når en testkampanje startes, genererer Test Engine to (eller flere) testvarianter – f.eks. to forskjellige produkter eller annonsebudskap som skal sammenlignes. Variantene defineres basert på input (typisk to produkt-IDer fra Shopify som skal testes mot hverandre, eller to forskjellige annonsetekster).
* **Opprette annonser via annonseservicene:** Test Engine håndterer kommunikasjon mot Meta Ads og Google Ads tjenestene for å lansere annonser for hver variant. Dette inkluderer å sende nødvendige parametere (målgruppe, budsjett, varighet, kreativt materiale som tekst/bilde) til de respektive API-ene slik at en annonsekampanje for hver variant opprettes på de eksterne plattformene.
* **Overvåking av ytelse:** Etter oppstart vil Test Engine overvåke hvordan hver variant presterer. Dette kan skje på to måter (ofte en kombinasjon):

  1. **Polling av annonsestatistikk:** Test Engine kan med jevne mellomrom (f.eks. hver time) spørre Meta Ads Manager og Google Ads Manager om oppdaterte metrikk for variant-annonsene (impressions, klikk, kostnad, konverteringer osv.). Hver av de to plattformtjenestene eksponerer et endepunkt for å hente statistikk, som Test Engine kaller.
  2. **Lytting på konverteringshendelser:** Når sporingslaget sender inn konverteringsdata (kjøp, inntekt), kan Test Engine fange opp disse (enten via Orchestrator som formidler dem, eller direkte hvis integrert) og knytte dem til riktig variant.
* **ROAS-beregning:** For hver variant beregner tjenesten fortløpende ROAS (Return on Ad Spend). ROAS = (Generert inntekt fra varianten) / (Annonsekostnad for varianten). Denne beregningen oppdateres kontinuerlig når nye data kommer inn.
* **Auto-switch logikk:** Test Engine inneholder den **automatiske beslutningslogikken** som avgjør når en test skal konkluderes. Basert på forhåndsdefinerte kriterier (som kan være:

  * Minimum løpstid eller datasett for at resultatene skal være pålitelige (f.eks. la testen gå minst 3 dager).
  * Signifikant forskjell i ROAS mellom variantene (f.eks. en variant har ROAS som er minst 20% høyere enn den andre over en gitt periode).
  * Kostnadstak eller budsjettforbruk (om budsjettet for testen nesten er brukt opp).

  Når kriteriene er møtt, vil Test Engine automatisk **velge en vinner**. Det innebærer:

  * Stans av den tapende varianten: via annonseservicene skrur den av/pause kampanjen for varianten med lavere ROAS.
  * Omfordeling av budsjett (valgfritt): Test Engine kan velge å øke budsjettet på vinnervarianten for å maksimere avkastningen, spesielt dersom testen fortsatt pågår.
  * Oppdatere status: Markere i databasen (kampanjedokumentet) at testen er avsluttet og hvilken variant som vant, samt hva oppnådd ROAS var.
* **Kommunikasjon tilbake til Orchestrator/frontend:** Test Engine kan sende hendelser eller oppdatere databasen slik at Orchestrator (og dermed frontend) blir klar over testresultatet. I noen design kan Test Engine sende en melding eller gjøre et callback til Orchestrator når testen er ferdig, eller Orchestrator kan periodisk spørre Test Engine om status.

**Teknologi:** Test Engine Service kan implementeres i Node.js (for enklere integrasjon med Orchestrator og Meta-tjenesten) eller et annet språk. For enkelhet antar vi at Test Engine er en Node.js-tjeneste (med Express eller et minimalt rammeverk for å eksponere et API til Orchestrator). Den kan også ha en intern scheduler. Teknologier som kan være i bruk:

* **Express/fastify**: for å lage et lite API som tar imot start/stopp kommandoer fra Orchestrator.
* **node-cron** eller tilsvarende: for å sette opp jevnlige jobbkjøringer (polling av statistikk).
* **MongoDB klient**: Test Engine kan koble til MongoDB for å lese/oppdatere kampanjeinformasjon direkte.
* Evt. et meldingssystem: I mer avansert arkitektur kunne Test Engine abonnere på hendelser via en kø (f.eks. RabbitMQ eller Redis pub/sub) i stedet for polling. I vår beskrivelse holder vi oss til polling og webhook-hendelser.

**Miljøvariabler:**

* **PORT** – Port som Test Engine sitt API kjører på (f.eks. 5000).
* **MONGODB\_URI** – (Hvis Test Engine skal lese/lagre data selv). Alternativt kan den få DB-konfig som separate variabler.
* **METAADS\_URL** – URL til Meta Ads Manager Service (for å lage/oppdatere Facebook-annonser).
* **GOOGLEADS\_URL** – URL til Google Ads Manager Service.
* **CHECK\_INTERVAL** – (Opsjonalt) intervall for hvor ofte tjenesten skal hente ny statistikk fra annonseplattformene, i sekunder eller cron-uttrykk. For eksempel `CHECK_INTERVAL=3600` for hver time.
* **ROAS\_THRESHOLD** – (Opsjonalt) terskelverdi eller regel for når auto-switch skal inntreffe. Dette kan være en enkel prosentdifferanse eller en mer kompleks formel. F.eks. `ROAS_THRESHOLD=0.2` for 20% bedre.
* **MIN\_TEST\_DURATION** – (Opsjonalt) Minimum varighet (i timer eller dager) en test skal kjøre før auto-switch tillates.
* **BUDGET\_REALLOCATION** – (Opsjonalt) Parameter for om budsjett skal omfordeles automatisk til vinner (true/false).

**Oppstart:** I Docker Compose startes Test Engine som en egen tjeneste basert på sin Dockerfile. Uten Docker kan man kjøre den ved å navigere til `test-engine/` katalogen:

```bash
npm install
npm start   # eller npm run dev for utviklingsmodus
```

Ved oppstart bør den koble seg til MongoDB (hvis konfigurert til det) og lytte på sin PORT. Orchestrator vil ved behov sende en HTTP-forespørsel til f.eks. `http://localhost:5000/startTest` (avhengig av API-design) med informasjon om testen som skal kjøres.

**Testing av Test Engine isolert:** Det primære grensesnittet til Test Engine er Orchestrator (ikke direkte sluttbruker), men man kan teste den ved å simulere en kallelse:

* Start tjenesten og gjør en POST mot dens `/start`-endepunkt med en JSON som beskriver en test (for eksempel produktIDer, budsjett). Se eksempel i API-kall seksjonen.
* Kontroller at Test Engine logger at den mottok testen og forsøker å opprette varianter.
* Man kan også teste dens interne funksjoner ved å utløse dens statistikk-polling manuelt. For eksempel kan det finnes et endepunkt `/collectStats` som trigger en umiddelbar innhenting av statistikk for en gitt test (avhengig av implementasjon).
* I loggene til Test Engine vil du kunne se om den lykkes i å kalle Meta/Google tjenester (forutsetter at de kjører og er riktig konfigurert).
* For å teste auto-switch logikk kan man fôre inn dummy data: f.eks. manuelt kalle et endepunkt som oppdaterer inntekt/kostnad for variant A og B i databasen og så kalle en funksjon som evaluerer ROAS. Dette er avansert – et alternativ er å skrive enhetstester for funksjonen som sammenligner ROAS og bestemmer vinner.

### Meta Ads Manager Service (Facebook/Meta integrasjon)

**Ansvar:** Meta Ads Manager Service fungerer som bindeledd mellom AdPilot og Facebook/Meta sitt annonseøkosystem. Dens oppgaver inkluderer:

* Opprette annonsekampanjer, annonsesett og annonser på Facebook/Instagram via **Facebook Marketing API**. Den mottar forespørsler fra Orchestrator/Test Engine om å lage en ny annonse for et gitt produkt eller variant, og håndterer API-kallet til Facebook.
* Administrere livssyklusen til annonsene:

  * **Starte/stoppe** kampanjer: For eksempel hvis Test Engine bestemmer at variant B skal pauses, vil den sende en kommando hit for å pause den tilhørende Facebook-annonsen.
  * **Budsjettjustering**: Kan motta forespørsel om å øke/redusere budsjett på en annonse.
  * **Hente resultater**: Tilbyr endepunkt for å samle inn metrikk (impressions, klikk, kostnad, konverteringer via Facebook Pixel) for en gitt kampanje/annonsesett. Den vil typisk bruke Marketing APIets *insights* endepunkter for dette.
* Håndtere autentisering mot Facebook API: Bruke API-nøkler/access tokens konfigurert for å autorisere seg mot Facebook Graph/Marketing API.

**Teknologi:** Denne tjenesten er skrevet i Node.js. Den bruker et hjelpebibliotek for Facebook Marketing API, spesifikt `jewel-ai/facebook-marketing-api-wrapper`, som forenkler kall mot API-et. Under panseret kommuniserer dette med Meta's Graph API. Teknisk sett kan tjenesten være en Express-app med et par ruter, eller en enkel Node-prosess som lytter på meldinger/forespørsler:

* F.eks. en POST `/campaign` for å opprette en kampanje.
* Evt. GET `/campaign/{id}/insights` for å hente statistikk.
* Biblioteket håndterer detaljer som versjonsing av API, paging av resultater osv., slik at vi kan kalle relativt høy-nivå funksjoner.

**Miljøvariabler:** Integrasjon mot Facebook krever en del sensitive nøkler:

* **FB\_ACCESS\_TOKEN** – En gyldig access token med rettigheter til å administrere annonser. I utvikling kan dette være en langtids gyldig token knyttet til utviklerens annonskonto. I produksjon bør dette hentes via en autorisasjonsprosess (OAuth) for butikkens egen Facebook Business-konto.
* **FB\_AD\_ACCOUNT\_ID** – ID til Facebook annonsekontoen der kampanjene skal opprettes. Dette er typisk et tall med prefix `act_` (for eksempel `act_1234567890`). Annonsekonto må ha gitt rettigheter til appen som brukes.
* **FB\_APP\_ID** / **FB\_APP\_SECRET** – Applikasjons-ID og hemmelighet for Facebook appen (dersom man bruker en egen app for API-tilgang). Disse kan kreves hvis man må generere nye tokens eller bruke Facebook Marketing API SDK.
* **FB\_API\_VERSION** – (Valgfritt) Versjon av Marketing API, f.eks. `v16.0`, for kompatibilitet.
* **PORT** – Port for tjenesten (f.eks. 5001).

**Oppstart:** I Docker Compose bygges denne tjenesten fra sin Dockerfile, som sannsynligvis:

* Basert på en Node-alpine base.
* Kopierer kildekode, kjører `npm install` for å hente inn `facebook-marketing-api-wrapper` og andre avhengigheter.
* Starter appen (f.eks. `node index.js`).
  Uten Docker, kjør manuelt:

```bash
cd services/meta-ads
npm install
npm start   # Starter Express-server på konfigurert PORT
```

Forbindelse til Facebook skjer ved første API-kall. Det er lurt å sjekke at miljøvariablene for token og account ID er riktig satt; ellers vil API-kallene feile med autorisasjonsfeil.

**Testing av Meta Ads Service:** Denne tjenesten brukes internt av systemet, men man kan teste den direkte med f.eks. cURL for å verifisere integrasjonen:

* **Opprette test annonse:** Send en POST til `http://localhost:5001/campaigns` med en JSON body som inkluderer nødvendige felter for å opprette en annonse. Dette kan inkludere: `adName`, `adsetName`, `campaignName`, `creative` (tekst/bilde eller en mal), `productUrl` (lenke til produktsiden i Shopify), `budget`, `duration` osv. Eksempel:

  ```json
  {
    "campaignName": "Testkampanje A",
    "adsetName": "Variant A - Produkt X",
    "adName": "Ad for Produkt X",
    "objective": "CONVERSIONS",
    "budget": 50,
    "schedule": {"start": "2025-05-29", "end": "2025-06-05"},
    "creative": {
      "message": "Sjekk ut Produkt X!",
      "image_url": "https://link-til-bilde.jpg"
    },
    "targeting": { "location": "Norway", "age_min": 18, "age_max": 60 }
  }
  ```

  (Reelle kall til Facebook krever flere detaljer, men vårt API-wrapper kan fylle ut en del standardverdier.)
  Forventet respons er noe som inneholder IDer for opprettet kampanje/annonsesett/annonse, f.eks.:

  ```json
  { "campaignId": "1234", "adsetId": "5678", "adId": "9101112", "status": "ACTIVE" }
  ```
* **Hente innsiktsdata:** Etter at en annonse har kjørt en stund (eller hvis Facebook-kontoen har historiske data), kan man teste f.eks. `GET http://localhost:5001/campaigns/1234/insights`. Dette skal returnere aggregerte data for kampanje 1234, f.eks.:

  ```json
  {
    "campaignId": "1234",
    "spend": 10.5,
    "impressions": 1000,
    "clicks": 50,
    "conversions": 3,
    "purchase_value": 150.0
  }
  ```

  (Tallene er eksempler.)
* **Feilhåndtering:** Prøv også feilscenarioer: f.eks. kall tjenesten uten gyldig token (sett feil token i env) og se at den returnerer en brukbar feilmelding. Dette sikrer at feilmeldinger fra Facebook (som 400 Bad Request eller 401 Unauthorized) blir håndtert/videreformidlet.

**Merk:** For å faktisk gjennomføre slike tester, må man ha en gyldig Facebook annonsekonto og API-tilgang. I mange tilfeller vil man ikke kunne opprette faktiske annonser i et testmiljø uten kostnader. Det er vanlig å bruke Facebooks *Marketing API Sandbox* eller en testkonto, men denne har begrensninger. For ren utvikling kan man mocke svar for å ikke treffe ekte API hver gang.

### Google Ads Manager Service (Python)

**Ansvar:** Google Ads Manager Service integrerer AdPilot med Google Ads-plattformen. Funksjonene ligner på Meta Ads-tjenesten, men tilpasset Google Ads:

* **Opprette kampanjer/annonsgrupper/annonser på Google Ads**: Tar imot forespørsler via API fra Orchestrator/Test Engine om å opprette annonser for gitte produkter på Google. Den bruker Google Ads API til å opprette en kampanje (f.eks. en Search eller Display campaign), en ad group, og en annonse (f.eks. en tekstannonse eller bildetillat annonse).
* **Administrere annonser**: Kan pause/aktivere annonser basert på kommandoer (f.eks. Test Engine sier stopp variant B).
* **Hente resultater**: Spørr Google Ads API for statistikk om kampanjer/annonser. Google Ads API gir data som kostnader, klikk, konverteringer (hvis definert via konverteringssporing), etc. Tjenesten aggregerer disse dataene og sender dem tilbake til forespørrer.
* **Håndtere autentisering mot Google Ads API**: Bruke OAuth2 legitimasjon (klient-ID/hemmelighet, refresh token, developer token) for å få tilgang til API-et. Google Ads krever vanligvis en godkjent utviklerkonto og at man har autorisert en Google Ads-konto for API-tilgang.

**Teknologi:** Google Ads-tjenesten er skrevet i Python. Den bruker den offisielle **google-ads-python SDK**. Denne SDK-en forenkler kall til Google Ads API ved å tilby Python-klasser for ressurser som Campaign, AdGroup, osv., og tar seg av auth og protokollhåndtering.

* Sannsynligvis er det brukt et web-rammeverk som **Flask** eller **FastAPI** for å lage HTTP-endepunkter som kan motta forespørsler. For eksempel kan det finnes en route `/campaign` for å lage kampanje, `/campaign/<id>/stats` for å hente statistikk, etc.
* SDK-en krever en konfigurasjon (som typisk ligger i en `google-ads.yaml` fil eller via miljøvariabler). Tjenesten leser inn disse ved oppstart.

**Miljøvariabler:** Google Ads API krever flere konfigurasjonsverdier. De kan settes i en YAML-fil (`google-ads.yaml`) eller direkte som miljøvariabler. AdPilot bruker miljøvariabler (via Docker Compose) for enkelhets skyld:

* **GOOGLE\_ADS\_DEVELOPER\_TOKEN** – Utvikler-token fra Google Ads API Center. Dette er en nøkkel som identifiserer appen din for Google. (Format: en rekke tegn, f.eks. `ABcdeFGHIjkLMNopQR_stUvW`)
* **GOOGLE\_ADS\_CLIENT\_ID** – OAuth2-klient-ID for Google Cloud-prosjektet som er koblet til Google Ads API.
* **GOOGLE\_ADS\_CLIENT\_SECRET** – OAuth2-klient-hemmelighet.
* **GOOGLE\_ADS\_REFRESH\_TOKEN** – En refresh token som gir tjenesten offline tilgang til en spesifikk Google Ads-konto. Denne får man etter å ha gjennomført OAuth autorisasjon for en Google Ads bruker. Refresh token brukes til å generere access tokens automatisk.
* **GOOGLE\_ADS\_LOGIN\_CUSTOMER\_ID** – (Valgfritt) Manager-kunde-ID (MCC) om man opererer via en MCC. Hvis AdPilot administrerer flere kunders kontoer, vil dette typisk settes til partnerens MCC konto. Format er kundekonto-ID uten bindestrek (f.eks. `1234567890`).
* **GOOGLE\_ADS\_CUSTOMER\_ID** – Den spesifikke Google Ads-kontoen (kunden) der kampanjen opprettes. Også uten bindestrek. Denne kan overlates til API-kallet i stedet for env, men ofte setter man det som default her.
* **GOOGLE\_ADS\_USE\_PROTO\_PLUS** – (Valgfritt) Om man vil bruke protokoll-buffers klasser eller ikke. Kan settes til `True` eller `False`. Standard i ny SDK er True.
* **PORT** – Port for webserveren (f.eks. 5002).

I Docker Compose må disse variablene settes (helst via en `.env.google` fil som kun containere ser, siden de er sensitive). Alternativt kan de mountes via Docker Secrets i en prod-setting (mer om det senere).

**Oppstart:** Google Ads-tjenesten startes i Docker via en Dockerfile basert på Python (f.eks. python:3.9-slim). Dockerfilen vil:

* Kopiere kildekoden (som kan være en `app.py` eller et Flask-app oppsett).
* Installere `google-ads` pakken (fra PyPI) samt Flask/FastAPI.
* Kjøre applikasjonen (for Flask typisk `flask run`, for FastAPI uvicorn/gunicorn).
  Lokal kjøring uten Docker:

```bash
cd services/google-ads
pip install -r requirements.txt   # installer Python-avhengigheter
export GOOGLE_ADS_CLIENT_ID=<dinID> ...   # sett nødvendige env variabler
python app.py    # eller uvicorn main:app --reload (hvis FastAPI)
```

Ved korrekt oppsett vil appen starte og lytte på konfigurert port. Den vil også forsøke å autentisere mot Google Ads API (som regel skjer første gang man faktisk gjør et API-kall).

**Testing av Google Ads Service:** Direkte testing kan gjøres med f.eks. cURL:

* **Opprette kampanje:** `POST http://localhost:5002/campaigns` med JSON data. Dette må inneholde parametre Google Ads krever, for eksempel:

  ```json
  {
    "campaignName": "Test Campaign B",
    "campaignType": "SEARCH", 
    "dailyBudget": 50,
    "adGroups": [
      {
        "name": "AdGroup 1",
        "ads": [
          {
            "headline": "Kjøp Produkt Y i dag",
            "description": "Stor rabatt på Produkt Y, fri frakt!",
            "url": "https://din-butikk.no/produkt-Y",
            "image_url": null
          }
        ],
        "keywords": ["produkt Y", "kjøp Y"]
      }
    ],
    "targeting": {
      "locations": ["NO"], 
      "languages": ["no"]
    }
  }
  ```

  Avhengig av implementasjonen, vil tjenesten oversette dette til de rette Google Ads API-kallene (opprette kampanje, ad group, annonse). Responsen bør inkludere nye ID-er:

  ```json
  {
    "campaignResourceName": "customers/1234567890/campaigns/111",
    "campaignId": 111,
    "adGroupIds": [222],
    "adIds": [333],
    "status": "ENABLED"
  }
  ```
* **Hente statistikk:** `GET http://localhost:5002/campaigns/111/stats` (hvis et slikt endepunkt finnes). Google Ads API kan returnere mye data; vår tjeneste kan begrense seg til viktige felt:

  ```json
  {
    "campaignId": 111,
    "cost": 120.0,
    "impressions": 5000,
    "clicks": 300,
    "conversions": 5,
    "conversion_value": 250.0
  }
  ```

  Tallene indikerer at 120 kr er brukt, 5 konverteringer generert 250 kr i salg, etc.
* **Pause kampanje:** En mulig rute `POST /campaigns/111/pause` kan testes for å se at tjenesten klarer å endre status via API.
* Test også feil: For eksempel, hvis refresh token er utløpt eller ugyldig, vil tjenesten logge en feil fra Google Ads API. Sørg for at slike feil logges forståelig.

**Merk:** Google Ads API har strenge adgangskontroller. I et testmiljø kan man bruke en *test account* (Google Ads tilbyr testkontoer i sandbox, men de har begrensninger ift. data). I mange tilfeller under utvikling vil man bruke ekte Google Ads-konto med små budsjetter for å teste ende-til-ende.

### Tracking Layer (Sporingslag)

**Ansvar:** Sporingslaget samler inn data om brukeratferd og konverteringer (f.eks. når en butikkbesøkende klikker på en annonse og deretter kjøper noe i Shopify-butikken). Hensikten er å attribuere disse konverteringene til riktig annonsevariant i A/B-testen, slik at AdPilot kan beregne nøyaktig ROAS. Tracking Layer fungerer som en bro mellom Shopify-butikken (eller nettsiden) og AdPilot:

* **Innsamling av hendelser:** Det kan samle hendelser som *Page View*, *Add to Cart*, *Purchase* osv. Ideelt sendes disse hendelsene med metadata (f.eks. session id, eller en kampanje/annonse-ID) slik at man vet hvilken annonse brukeren kom fra.
* **Ruting av data:** Ved bruk av **RudderStack** (en åpen kildekode kundedata-plattform) kan hendelser fra nettbutikken sendes til flere destinasjoner, inkludert AdPilot. RudderStack vil typisk kjøre som en egen tjeneste som lytter etter hendelser via SDK eller webhook, og deretter videreposter dem til for eksempel Orchestrator API eller direkte til en database.
* **Alternativ: GTM Webhook:** Hvis man ikke ønsker å kjøre RudderStack, kan man benytte **Google Tag Manager** i nettbutikken. GTM kan trigge et webhook kall til AdPilot når en viss hendelse skjer (f.eks. etter en vellykket betaling). I praksis vil man i GTM opprette en tag av type HTTP Request som sender JSON-data til et AdPilot-endepunkt.
* **Databehandling:** Tracking Layer kan også formatere og berike data. For eksempel kan det legge ved kampanje- eller variantidentifikator basert på UTM-parameters i URLen som annonsen brukte. (Man kan sette opp at annonse-variant A bruker en spesiell URL med parameter `?variant=A` eller lignende, som så fanges opp.)
* **Levering til AdPilot:** Til syvende og sist skal dataene inn i systemet. Dette gjøres typisk ved at Orchestrator API har et endepunkt, f.eks. `POST /api/track` eller `/api/events`, der Tracking Layer sender JSON med detaljer:

  ```json
  {
    "event": "Purchase",
    "userId": "abc123", 
    "anonymousId": "xyz789",
    "properties": {
       "value": 500.00,
       "currency": "NOK",
       "orderId": "1001",
       "products": [ {"id": "prod_123", "price": 250.00}, {"id": "prod_456", "price": 250.00} ]
    },
    "context": {
       "campaignId": "campaign_abc",
       "variant": "A",
       "source": "facebook"
    },
    "timestamp": "2025-05-29T10:00:00Z"
  }
  ```

  Orchestrator vil ved mottak lagre denne hendelsen (f.eks. i en egen samling eller som en aggregert count per kampanje), og informere Test Engine eller oppdatere beregninger.

**Teknologi:**

* **RudderStack Open Source**: RudderStack består i open-source utgaven av to hovedkomponenter – en **kontroll-plane** (ofte en webapp for å konfigurere kilder og destinasjoner) og en **data-plane** (en server som mottar og videresender hendelser). Den krever en PostgreSQL database for lagring. I vår kontekst kan RudderStack kjøres som container(e) i Docker Compose. Konfigurasjon av RudderStack innebærer å definere en datakilde (for eksempel "Web SDK" for Shopify nettbutikken) og en destinasjon ("Webhook" med Orchestrator URL, eller direkte MongoDB).
* **Google Tag Manager**: Bruker man GTM, trenger man ikke ekstra backend-tjenester i AdPilot for sporing. Man konfigurerer i GTM et skript som kjører i nettbutikken, samt en "tag" som sender data. I AdPilot må vi da ha et endpoint og kunne autentisere/validere at forespørslene er ekte (derav en mulig secret token i miljøvariabler).
* **Shopify integrasjon**: AdPilot kan også integreres som en Shopify App for sporing. For eksempel injisere et skript som initialiserer RudderStack SDK med en Write Key. Skriptet vil automatisk fange opp sidevisninger og kjøpshendelser på Shopify (Shopify har event hooks for checkout). Dette er avansert, men mulig.

**Miljøvariabler:** For sporingslaget selv (f.eks. RudderStack container) kan det kreves:

* **RS\_WRITE\_KEY** – En nøkkel som identifiserer datakilden (tilsvarende Segment write key). Denne brukes av javascript-klienten som kjører i nettbutikken for å sende data til RudderStack.
* **RS\_WEBHOOK\_URL** – URL til hvor RudderStack skal sende data. Hvis RudderStack brukes, kan den konfigureres via UI eller env til å poste til Orchestrator.
* **RS\_DB\_USER/RS\_DB\_PASSWORD** – hvis RudderStack bruker Postgres, må DB-tilgang settes.
* **GTM\_WEBHOOK\_SECRET** – Hemmelig token for GTM webhook validering (som nevnt tidligere, samme som TRACKING\_WEBHOOK\_SECRET i Orchestrator).
* **PORT** – (Hvis en egen tracking service container, f.eks. en minimal express app som tar imot GTM webhook, ellers ikke relevant hvis alt håndteres av Orchestrator).

**Oppstart:**

* **Med RudderStack:** Docker Compose kan inneholde en service for RudderStack (noen Docker images finnes for rudderstack server). RudderStack trenger også Postgres database. Compose-konfigurasjonen vil starte RudderStack etter at Postgres er oppe. Man må så gå inn i RudderStack (via dens web UI eller config fil) og legge til:

  * Kilde: f.eks. "Website" med den RS\_WRITE\_KEY som brukes i frontend.
  * Destinasjon: Definer en "HTTP Webhook" destinasjon som peker til Orchestrator API endpoint for tracking, med inkludert auth header eller secret hvis brukt.
  * Etter dette vil RudderStack begynne å poste hendelser den mottar fra nettbutikken til Orchestrator.
* **Med GTM:** Ingen ny container kreves for GTM. I stedet må Orchestrator-endepunktet være klart til å motta. For lokal testing med GTM, kan det være tungvint fordi GTM scriptet på en lokal dev-butikkside ikke når en `localhost` API. Ofte må man bruke en verktøy som **ngrok** til å eksponere Orchestrator på en offentlig URL, og konfigurere GTM til å sende dit. For formålet med lokal utvikling er RudderStack enklere å teste med (man kan generere hendelser manuelt gjennom RudderStack CLI eller web UI).
* **Uten noen sporingstjeneste (for testing):** Det er mulig å simulere konverteringer ved å direkte kalle Orchestrator API som om det var en webhook (som vist i eksempelet over). Dette kan brukes i et utviklingsmiljø for å fake noen data inn i systemet.

**Testing av Tracking Layer:**

* **Med RudderStack:** Installer RudderStack JS SDK i nettbutikkens front (f.eks. i Shopify tema, eller via en script tag i head). Sett opp at den sender en testevent:

  ```js
  rudderanalytics.track("Purchase", {
      order_id: "1001", value: 99.90, currency: "NOK"
  });
  ```

  Sjekk RudderStack logs for at event ble mottatt, og at den prøver å sende til webhook. Sjekk så Orchestrator logs for at eventen kom fram.
* **Direkte webhook test:** Bruk curl for å sende en POST til Orchestrator:

  ```bash
  curl -X POST http://localhost:4000/api/track -H "Content-Type: application/json" \
    -d '{"event":"Purchase","properties":{"value": 99.90,"currency":"NOK"},"context":{"campaignId":"<kampanje-id>","variant":"A"}}'
  ```

  (inkluder secret f.eks. som header hvis det kreves). Forventet oppførsel: 200 OK svar. Deretter kan du sjekke at data havnet i DB (f.eks. i `conversions` kolleksjon eller at testens aggregerte verdier ble oppdatert).
* **Validering:** Prøv med feil secret token (hvis i bruk) for å se at Orchestrator avviser kall (får 401 Unauthorized). Dette sikrer at ikke hvem som helst kan poste falske konverteringer.

### Data Store (MongoDB og Redis)

**Ansvar:** Data Store-komponenten omfatter de databasene AdPilot bruker for lagring og caching. Selv om MongoDB og Redis ikke er "tjenester" med vår logikk, er de kritiske deler av arkitekturen og krever konfigurering.

* **MongoDB (kampanjedata):** Alle vedvarende data lagres her:

  * **Kampanjer/Tester:** En samling (collection) inneholder dokumenter for hver A/B-test-kampanje. Feltene kan inkludere unikt kampanje-ID, tidspunkt startet, hvilke varianter (produkt A, produkt B med referanser til produktene), budsjett, varighet, status (running/completed), vinnerVariant (når avsluttet), osv.
  * **Annonsedetaljer:** En egen samling kan lagre mapping fra variant til eksterne annonse-IDer. For eksempel, for kampanje X variant A, lagre Facebook adId = 123, Google adId = 456. Dette er nyttig for å hente statistikk senere.
  * **Resultater/Statistikk:** Man kan lagre tidsserier eller aggregerte resultater her. For enklere implementasjon oppdateres kampanjen dokumentet fortløpende med felter som `spendA`, `revenueA`, `roasA` (og tilsvarende B). Alternativt har en egen `results` samling der hver rad er per dag per variant, for historikk.
  * **Produktdata:** AdPilot kunne også lagre info om produkter fra Shopify (produktnavn, bilder) for å vise i dashbordet. Dette kan caches i MongoDB når man henter produktlisten via Shopify API første gang.
  * **Brukerdata:** Hvis AdPilot opererer som en SaaS for flere butikker, vil man ha en samling for brukere/butikker (med API-nøkler, tokens til Shopify, Facebook, Google knyttet til hver). I et enkeltstående oppsett for én butikk er ikke dette nødvendig å lagre i DB (man kan bruke .env).
* **Redis (cache):** Redis brukes der vi trenger rask tilgang eller midlertidig lagring:

  * Caching av *konfigurasjon*: f.eks. Shopify produktliste cache i noen minutter, så ikke Orchestrator trenger å slå opp produktene hver gang.
  * Caching av *tokens*: Access tokens fra Facebook/Google kan lagres i Redis med utløpstid, slik at om de utløper og fornyes, kan man oppdatere her uten å måtte skrive til fil/DB.
  * *Rate limiting* og køer: Man kan bruke Redis som en enkel kø for jobbene (f.eks. legge en melding om “hent statistikk for kampanje X” og Test Engine plukker det opp). Dette er avansert bruk; per nå antar vi direkte kall uten kø, men muligheten finnes.
  * Lagring av *session data* (hvis dashbordet har innlogging utover Shopify OAuth).
  * Midlertidige beregninger: Hvis det tar tid å beregne noe, kan en tjeneste legge resultat i Redis for rask henting av andre (f.eks. Orchestrator spør Test Engine om ROAS, Test Engine legger det i Redis og Orchestrator leser det).

**Miljøvariabler:**

* MongoDB i Docker Compose konfigureres typisk med:

  * **MONGO\_INITDB\_ROOT\_USERNAME**, **MONGO\_INITDB\_ROOT\_PASSWORD** – initial brukernavn/passord for administrasjon (kan være relevant å sette for prod, i dev kan man utelate for enkelhet).
  * **MONGO\_INITDB\_DATABASE** – initiell database å opprette (f.eks. `adpilot`).
  * Orchestrator/Test Engine trenger **MONGODB\_URI** som nevnt tidligere. Denne URI vil inkludere credentials dersom auth er på, f.eks. `mongodb://user:pass@mongo:27017/adpilot?authSource=admin`.
* Redis i Docker Compose kan settes opp uten passord for dev (default). For prod kan man sette passord:

  * **REDIS\_PASSWORD** – (valgfritt) passord for Redis, som da tjenestene må bruke i sin URI.
  * Tjenestene bruker typisk en **REDIS\_URL** env, f.eks. `redis://:password@redis:6379/0`. Nummeret på slutten indikerer database-index (0 er default).

**Oppstart (Docker):**

* **MongoDB:** I `docker-compose.yml` vil det være:

  ```yaml
  mongo:
    image: mongo:5.0           # MongoDB image
    container_name: mongo
    ports:
      - "27017:27017"          # eksponerer port hvis man vil koble til fra host (valgfritt i dev)
    environment:
      MONGO_INITDB_DATABASE: adpilot
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: example
    volumes:
      - mongo_data:/data/db
  ```

  Dette lager en MongoDB instance med en initial db `adpilot` og root brukeren. Data persisteres i en named volume `mongo_data` slik at data ikke forsvinner ved restart av container.
* **Redis:** I Compose:

  ```yaml
  redis:
    image: redis:6-alpine
    container_name: redis
    ports:
      - "6379:6379"
    # command: ["redis-server", "--requirepass", "password123"]  # om man vil sette passord
    volumes:
      - redis_data:/data
  ```

  Dette starter Redis som in-memory data store med vedvarende lagring til `redis_data` volum (så den kan skrive snapshot til disk).
* **Initialisering:** MongoDB krever ingen spesiell initialisering utover environment ovenfor (det vil lage db og brukere). Ingen forhåndsdata legges inn, men man kan senere lage indekser for ytelse (f.eks. indeks på kampanjeID i resultatsamling).
* **Tilgang fra tjenester:** Orchestrator og Test Engine vil bruke `mongo` som hostname (takket være Docker Compose DNS for tjenestenavn) og kan logge seg inn med brukeren definert (root/example i vårt dev-tilfelle).
  Redis nås på host `redis` port 6379, passord hvis definert.

**Testing av Data Store:**

* Sjekk at Orchestrator faktisk klarer å lagre og hente ut data: Start en testkampanje via API, og deretter bruk f.eks. MongoDB-kommandolinje (mongo shell) eller et GUI (Compass, Robo3T) til å se at en ny oppføring finnes i `adpilot.campaigns` kolleksjonen. Verifiser at feltene ser riktige ut.
* Test at oppdateringer skjer: Etter at Test Engine har kjørt en stund, refresh data i db for å se at f.eks. `roasA` feltet er satt og endres, eller at en `winner` felt dukker opp når auto-switch skjer.
* For Redis: Man kan koble seg til Redis med en klient (`redis-cli` i terminalen). Kjør `KEYS *` for å se hvilke nøkler som finnes. Under kjøring kan man se nøkler som caches. Hvis for eksempel Meta Ads Service cacher et access token, kan en nøkkel som `fb_access_token` dukke opp. Eller hvis Test Engine legger midlertidige resultater, kan f.eks. `campaign_<id>_latest_roas` finnes. Prøv å lese verdier med `GET keyname` kommando.
* Ytelsestest: For mange samtidige kampanjer, se om DB henger med. Dette er mest relevant i stress-testing (kan gjøres senere i optimalisering).

## Installasjon og oppsett (lokal utvikling med Docker Compose)

Denne seksjonen forklarer hvordan du får AdPilot til å kjøre på din lokale maskin ved hjelp av Docker Compose. Vi forutsetter at du har Docker og Docker Compose installert.

**1. Klon repository og forbered miljø:**

```bash
git clone https://github.com/your-org/AdPilot.git
cd AdPilot
```

Inne i prosjektmappen vil du se underkataloger for hver tjeneste (f.eks. `frontend/`, `orchestrator/`, `services/test-engine/` osv.), samt en `docker-compose.yml` fil.

**2. Sett opp miljøvariabler:**
For sikkerhetsgrunner er ikke sensitive nøkler inkludert i repoet. Du må opprette nødvendige `.env`-filer eller eksportere variabler før oppstart. Typisk oppsett:

* Opprett en fil `.env.orchestrator` og fyll inn verdier for Orchestrator (se tidligere liste). Minimum:

  ```
  PORT=4000
  MONGODB_URI=mongodb://mongo:27017/adpilot
  REDIS_HOST=redis
  REDIS_PORT=6379
  TESTENGINE_URL=http://test-engine:5000
  METAADS_URL=http://meta-ads:5001
  GOOGLEADS_URL=http://google-ads:5002
  TRACKING_WEBHOOK_SECRET=hemmelig123   # velg en hemmelig streng
  ```
* Opprett `.env.testengine`:

  ```
  PORT=5000
  MONGODB_URI=mongodb://mongo:27017/adpilot
  METAADS_URL=http://meta-ads:5001
  GOOGLEADS_URL=http://google-ads:5002
  CHECK_INTERVAL=3600        # sjekk hvert 3600 sek (1 time)
  ROAS_THRESHOLD=0.2         # 20% bedre ROAS kreves for å auto-switche
  MIN_TEST_DURATION_HOURS=72 # la testen gå minst 72 timer
  ```
* Opprett `.env.meta-ads`:

  ```
  PORT=5001
  FB_ACCESS_TOKEN=<DIN FACEBOOK TOKEN>
  FB_AD_ACCOUNT_ID=<DIN AD ACCOUNT>    # f.eks. act_1234567890
  FB_APP_ID=<DIN FACEBOOK APP ID>
  FB_APP_SECRET=<DIN FACEBOOK APP SECRET>
  FB_API_VERSION=v16.0
  ```

  *(Hent inn verdiene fra Facebook dev account. For testing kan du bruke en midlertidig token generert i Graph API Explorer med ads\_management rettigheter, og annonsørkontoen må matche tokenets bruker.)*
* Opprett `.env.google-ads`:

  ```
  PORT=5002
  GOOGLE_ADS_DEVELOPER_TOKEN=abcdefg...    # fra Google Ads API Center
  GOOGLE_ADS_CLIENT_ID=your.apps.googleusercontent.com
  GOOGLE_ADS_CLIENT_SECRET=XYZ123...
  GOOGLE_ADS_REFRESH_TOKEN=1//0AbCdEfGh...   # lang token
  GOOGLE_ADS_CUSTOMER_ID=1234567890      # din Google Ads konto-ID
  ```

  *(Hent verdiene fra Google Cloud Console og Google Ads. Se Google Ads API dokumentasjon for å få tak i refresh token via OAuth2.)*
* Opprett `.env.frontend` (alternativt sett direkte i compose filen hvis image bygges):

  ```
  REACT_APP_API_BASE_URL=http://localhost:4000/api
  REACT_APP_TRACKING_KEY=<RudderStack write key eller GTM ID hvis relevant>
  ```
* (Valgfritt) `.env.tracking` hvis du har en egen tracking service or RudderStack config via env.

**Tips:** I `docker-compose.yml` kan det være definert env\_file for hver service, som peker til disse filene. Sørg for at filnavnene matcher det som er oppgitt der. Om ikke, kan du også legge variablene direkte under hver service i compose-filen, men av sikkerhetshensyn er separate env-filer foretrukket.

**3. Start Docker Compose:**
Kjør kommandoen:

```bash
docker-compose up --build
```

`--build` flagget sørger for at Docker bygger nye images fra Dockerfilene hvis det ikke er gjort før (eller ved endringer). Første gang vil dette laste ned basis-images (node, python, mongo etc.) og kan ta litt tid.

Når oppstarten er i gang, vil du se logger fra de ulike containerne i terminalen. Verifiser følgende:

* **Mongo** container: logger som "Waiting for connections" (indikasjon på at den kjører).
* **Redis** container: logger typisk "Ready to accept connections".
* **Orchestrator**: Bør logge noe som "Connected to MongoDB at mongo:27017" og "Server listening on port 4000".
* **Test Engine**: Logger "Test Engine service started on 5000" og eventuelle meldinger om scheduling ("Scheduling stats check every 3600s").
* **Meta Ads**: Logger kan vise f.eks. "Meta Ads service listening on 5001". Første kall til APIet skjer når en test opprettes.
* **Google Ads**: Lytter på 5002. Kan logge suksess eller feilmeldinger hvis konfigurasjon av Google Ads SDK feiler (f.eks. feil token).
* **Frontend**: Hvis satt opp i compose, kan enten en dev-server kjøre (som viser compile output fra React) eller en statisk server. Sjekk at den bygget uten error ("Compiled successfully").

Når alle er oppe, la Docker Compose kjøre kontinuerlig.

**4. Tilgang til applikasjonen:**

* **Frontend UI:** Åpne nettleser på `http://localhost:3000` (juster port hvis du eksponerte en annen). Du bør se AdPilot påloggingsside eller dashboard. (Avhengig av implementasjon kan det være en pålogging integrert med Shopify OAuth. I en lokal dev kan det være en dummy login eller ingen auth.)
* **Backend API:** Orchestrator lytter på `http://localhost:4000`. Du kan teste et enkelt endepunkt:

  ```bash
  curl http://localhost:4000/api/campaigns
  ```

  Forventer 200 OK (sannsynlig tom liste i JSON).
* Sjekk at frontend klarer å hente data fra APIet: f.eks. dashbordet skal vise "Ingen kampanjer" hvis tomt, som betyr at kall til `/api/campaigns` fungerte.

**5. Kjør en testkampanje:**
Bruk dashbordet til å sette opp en test:

* Velg to produkter (for testing kan du angi dummy produktIDer om integrasjon mot Shopify ikke er fullt koblet til ennå).
* Angi budsjett (f.eks. 50 kr/dag) og varighet (f.eks. 7 dager).
* Velg kanaler: for eksempel huk av for både Facebook og Google for å teste begge integrasjoner.
* Start kampanjen.

Følg med på loggene i terminalen:

* Orchestrator-loggen bør vise at den mottok forespørselen, lagret en kampanje i DB, og sendte en forespørsel til Test Engine (f.eks. "Initiating test X, calling Test Engine...").
* Test Engine-loggen vil motta data: "Starting test for campaign X: variant A = Produkt1, variant B = Produkt2..." og deretter "Creating Facebook ad for variant A..." etc.
* Meta Ads service loggen: "Received request to create campaign (Produkt1)..." etterfulgt av evt. suksessmelding med ID. Hvis API-kallet til Facebook lykkes, ser du kanskje "Facebook campaign created, ID 123".
* Google Ads logg: tilsvarende melding for variant B.
* Tilbake i Test Engine logg: "Variant A ad IDs: FB=123, Google=456; Variant B ad IDs: FB=789, Google=012".
* Orchestrator logg: Den kan få respons fra Test Engine, og svare frontend med suksess (HTTP 201 Created for kampanje opprettet).

I frontend skal kampanjen nå vises i liste med status "Running". Du kan klikke på den for detaljer.

**6. Generer testdata (konverteringer):**
For at noe skal skje videre, må vi simulere at annonser får klikk og konverteringer:

* **Manuell måte:** Bruk cURL eller Postman til å sende noen "konvertering" events til Orchestrator:

  ```bash
  curl -X POST http://localhost:4000/api/track -H "Content-Type: application/json" \
    -d '{ "event": "Purchase", "properties": { "value": 200, "currency": "NOK" }, "context": { "campaignId": "<kampanje-id>", "variant": "A" } }'
  ```

  Fyll inn kampanje-id (og variant) fra den kjørende testen. Send f.eks. 3 events for variant A med forskjellige verdier, og 1-2 for variant B.
* **Alternativ måte:** Om du har RudderStack opp og tracking-script på en testside, utløser du kjøpshendelser der.
* **Stats polling:** Vent til Test Engine kjører en runde polling (eller kall dens stats-endepunkt hvis tilgjengelig) for å hente kostnadsdata. Alternativt kan du simulere kostnader også:
  Du kan oppdatere i MongoDB kampanjens `spendA`/`spendB` felt manuelt for testformål, eller implementere en midlertidig debug-rute i Meta/Google service for å innrapportere dummy kostnad. For enkelhet, anta at variant A kostet 100 kr og variant B 120 kr i annonseforbruk.

**7. Observer auto-switch:**
Etter at testdata er simulert, skal Test Engine oppdage at f.eks. variant A har f.eks. 200 kr inntekt på 100 kr spend (ROAS=2.0), mens variant B har 100 kr inntekt på 120 kr spend (ROAS=0.83). A er betydelig bedre. Hvis våre auto-switch kriterier er tilfredsstilt (og minimumstid evt. er passert), vil Test Engine:

* Logge "ROAS A=2.0, ROAS B=0.83 – variant A outperforming B by 140%. Switching to variant A."
* Kalle Meta Ads service for å pause variant B (sjekk Meta logg for "Paused campaign for variant B id ...").
* Kalle Google Ads service for å pause variant B.
* Oppdatere kampanjestatus i DB: marker winner=A, status="Completed".
* (Eventuelt sende melding til Orchestrator)

Frontend vil etter refresh (eller via websockets/polling om implementert) vise at kampanjen er ferdig og hvilken variant vant. Du kan se ROAS-tallene i UI.

**8. Feilsøking:** Hvis noe ikke fungerer:

* Sjekk at alle containere kjører (`docker-compose ps` for status).
* Bruk `docker-compose logs <service>` for detaljerte logger per service.
* Vanlige feil kan være feil i miljøvariabler (f.eks. feil formaterte tokens), nettverksproblemer (en tjeneste finner ikke den andre - sjekk at URLene/portene stemmer med compose definisjon), eller API-begrensninger (Facebook/Google nekter kall pga. rettigheter).
* Juster konfigurasjon, start compose på nytt om nødvendig (`docker-compose down && docker-compose up --build` for en helt ren omstart).

## Flyt og kommunikasjon mellom tjenestene

For å belyse hvordan modulene snakker sammen i praksis, beskriver vi her et typisk scenario steg for steg – fra oppstart av en testkampanje til evaluering av ROAS og auto-switch. Dette illustrerer datamodeller, API-kall og generell kommunikasjon i systemet:

1. **Oppstart av kampanje (Frontend → Orchestrator):** En bruker (markedsfører) logger inn i AdPilot dashbordet og fyller ut et skjema for å starte en ny A/B-test. For eksempel velger de *Produkt X* og *Produkt Y* som to varianter, setter dagsbudsjett 50 NOK, varighet 7 dager, og velger annonsekanaler (Facebook & Google). Når brukeren klikker "Start test", sender frontend en HTTP-forespørsel:

   ```http
   POST /api/campaigns HTTP/1.1
   Host: orchestrator:4000
   Content-Type: application/json

   {
     "name": "Testkampanje 1",
     "variants": [
       { "productId": "X", "produktNavn": "Produkt X", "creative": { "text": "Annonse for X", "image": "url-til-bilde-X" } },
       { "productId": "Y", "produktNavn": "Produkt Y", "creative": { "text": "Annonse for Y", "image": "url-til-bilde-Y" } }
     ],
     "budgetPerDay": 50,
     "durationDays": 7,
     "channels": ["facebook", "google"],
     "targeting": { "country": "NO", "language": "no" }
   }
   ```

   Orchestrator API mottar denne forespørselen på `/api/campaigns`-ruten (REST endepunkt for å opprette kampanje).

2. **Orchestrator håndtering:** Orchestrator validerer input (f.eks. sjekker at to varianter er oppgitt, budsjett er tall). Deretter oppretter den en **kampanjedokument** i MongoDB, i `campaigns` kolleksjonen:

   ```json
   {
     "_id": "kampanje_abc123", 
     "name": "Testkampanje 1",
     "variants": [
       { "id": "A", "productId": "X", "name": "Produkt X", "creative": {...}, "status": "pending" },
       { "id": "B", "productId": "Y", "name": "Produkt Y", "creative": {...}, "status": "pending" }
     ],
     "budgetPerDay": 50,
     "channels": ["facebook","google"],
     "startDate": ISODate("2025-05-29T..."),
     "durationDays": 7,
     "status": "running",
     "results": {
       "spendA": 0, "revenueA": 0, "roasA": 0,
       "spendB": 0, "revenueB": 0, "roasB": 0,
       "winner": null
     }
   }
   ```

   (Dette er et eksempel på struktur – faktisk modell kan variere.) Dokumentet initialiseres med 0-verdier for kost/inntekt.

   Etter lagring svarer Orchestrator *asynkront*. Det vil si, den sender respons tilbake til frontend med bekreftelse:

   ```json
   { "campaignId": "kampanje_abc123", "status": "running", "message": "Testkampanje opprettet og startet." }
   ```

   Frontend kan nå vise kampanjen i UI (med status "Running...").

   **Viktig:** Før Orchestrator sender svar, trigger den også det faktiske oppsettet av testen i bakgrunnen:

   * Orchestrator kaller **Test Engine Service** for å instruere den om å starte testen. Dette kan være et internt API-kall:

     ```http
     POST http://test-engine:5000/startTest
     Content-Type: application/json

     { 
       "campaignId": "kampanje_abc123",
       "variants": [...], "budgetPerDay": 50, "channels": ["facebook","google"], "durationDays": 7,
       "tracking": { "webhookUrl": "http://orchestrator:4000/api/track?campaignId=kampanje_abc123" }
     }
     ```

     Orchestrator inkluderer all nødvendig info, slik at Test Engine ikke trenger å slå opp kampanjedetaljene i DB (alternativt kan den bare sende `campaignId`, og Test Engine selv henter resten fra DB).

3. **Test Engine setter opp A/B-testen:** Når Test Engine mottar `/startTest`, begynner den å konfigurere variantene:

   * Den lager to interne objekter for variant A og B (basert på produkt X og Y). Den genererer for eksempel unike referanser for variantene internt eller gjenbruker `id: A`/`B`.
   * For hver kanal spesifisert:

     * **Facebook/Meta:** Siden "facebook" er valgt, må det opprettes kampanjer der.
       Test Engine gjør et kall til Meta Ads Manager Service:

       ```http
       POST http://meta-ads:5001/campaigns
       Content-Type: application/json

       {
         "campaignName": "Testkampanje 1 - Produkt X",
         "adsetName": "Variant A - Produkt X",
         "adName": "Variant A annonse",
         "productId": "X",
         "productName": "Produkt X",
         "creative": { "text": "Annonse for X", "image": "url-til-bilde-X" },
         "targeting": { "country": "NO", "language": "no" },
         "budgetPerDay": 25, 
         "durationDays": 7
       }
       ```

       (Her har vi for enkelhets skyld delt budsjettet likt i to, 25 kr hver variant, men det er designvalg – man kunne gi begge full budsjett og la dem uavhengig performe.)
       Meta Ads Service oppretter en ny kampanje, annonsesett osv. via Facebook API, og returnerer:

       ```json
       { "campaignId": "FBcampaign_11111", "adsetId": "FBadset_22222", "adId": "FBad_33333", "status": "ACTIVE" }
       ```

       Test Engine mottar disse IDene.
     * **Google Ads:** Tilsvarende sender Test Engine en forespørsel til Google Ads Manager Service:

       ```http
       POST http://google-ads:5002/campaigns
       Content-Type: application/json

       {
         "campaignName": "Testkampanje 1 - Produkt X",
         "productId": "X",
         "productName": "Produkt X",
         "adText": "Kjøp Produkt X i dag!",
         "url": "https://<din-butikk>.myshopify.com/products/X",
         "dailyBudget": 25,
         "targeting": { "locations": ["NO"], "language": "no" }
       }
       ```

       Google Ads Service kaller Google API og svarer:

       ```json
       { "campaignId": 444444, "adGroupId": 555555, "adId": 666666, "status": "ENABLED" }
       ```

       (Google IDs er tall).
     * Samme prosess gjentas for *Produkt Y* (variant B), så man får et eget sett med ID-er for variant B på Facebook og Google.
   * Test Engine lagrer nå disse **mappingene** (variant -> annonse-IDs) i databasen. Enten i kampanje-dokumentet:

     ```json
     "variants": [
        { "id": "A", ..., "facebookAdId": "FBad_33333", "googleAdId": "666666", "status": "active" },
        { "id": "B", ..., "facebookAdId": "FBad_88888", "googleAdId": "999999", "status": "active" }
     ]
     ```

     eller i en egen collection `ads`. Uansett, informasjonen er lagret for senere oppslag når resultater hentes.
   * Test Engine sin jobb nå er å overvåke disse kampanjene. Den kan logge "Testkampanje kampanje\_abc123: 2 varianter startet på Facebook og Google."

4. **Sporing av konverteringer (bruker → Shopify → Tracking → Orchestrator):** Når annonsene er live, vil trafikk begynne å strømme til nettbutikken:

   * En bruker ser *Variant A* sin annonse for Produkt X på Facebook, klikker på den og kommer til Shopify-butikken (Produkt X side). I URLen har vi kanskje lagt til parametere: `https://din-butikk.com/products/X?utm_campaign=kampanje_abc123&utm_variant=A&utm_source=facebook`.
   * På Shopify-siden kjører tracking-skriptet (RudderStack SDK eller GTM container). Dette skriptet registrerer at brukeren har kommet (page view) og lagrer cookies med kampanje og variant info om nødvendig.
   * Brukeren kjøper produktet. Når ordren fullføres, trigges et *Purchase*-event i nettbutikken. Via integrasjonen:

     * Hvis RudderStack: Shopify’s frontend/checkout kan kalle `rudderanalytics.track("Order Completed", {order_id:1234, total: 500, ...})`. RudderStack fanger opp dette og sender det videre som JSON til vårt webhook-endepunkt.
     * Hvis GTM: En forhåndsdefinert trigger (f.eks. på siden "Order Confirmation") sender en HTTP POST til AdPilot webhook med tilsvarende data.
   * Orchestrator mottar denne HTTP POST på f.eks. `/api/track`:

     ```json
     {
       "event": "Order Completed",
       "properties": {
         "orderId": "1001",
         "value": 500.00,
         "currency": "NOK",
         "products": [ {"id": "X", "price": 500.00} ]
       },
       "context": {
         "campaignId": "kampanje_abc123",
         "variant": "A",
         "source": "facebook"
       },
       "timestamp": "2025-05-30T12:00:00Z"
     }
     ```

     Orchestrator bekrefter at `campaignId` og `variant` finnes, kanskje sjekker `TRACKING_WEBHOOK_SECRET` om det var med for autentisitet, og lagrer hendelsen. Lagring kan skje på to måter:

     * Oppdaterer kampanjedokumentet: øker `revenueA` med 500.00 og kanskje teller konvertering +1.
     * Eller legger inn et nytt dokument i en `conversions` samling:

       ```json
       { "_id": ..., "campaignId": "kampanje_abc123", "variant": "A", "value": 500.00, "timestamp": ISODate("2025-05-30T12:00:00Z") }
       ```

     Orchestrator svarer 200 OK til webhook-kilden. (Hvis RudderStack, den forventer en 200 for å anse leveringen som vellykket.)

5. **Innsamling av annonsemetrikker (Test Engine → Ads Services):** Uavhengig av sporingshendelser, vil Test Engine periodisk hente *kostnadsdata* og andre metrikk fra annonseplattformene:

   * For Facebook: Test Engine kaller Meta Ads Service: `GET /campaigns/FBcampaign_11111/insights` (bruker kampanje-ID den fikk). Meta Ads Service bruker Facebook Marketing API **Insights** endpoint til å få data (f.eks. via wrapper: `getCampaignInsights(campaignId, date_preset=today)`).
     Den får svar som:

     ```json
     { "campaignId": "FBcampaign_11111", "spend": 30.00, "impressions": 500, "clicks": 40, "conversions": 2, "purchase_value": 500.00 }
     ```

     (Dette indikerer f.eks. at 30 kr er brukt så langt på variant A, 2 konverteringer sporet via Facebook Pixel med totalverdi 500 kr. Merk: Pixel tracking overlappet med vår egen sporing, men det gjør ingenting – vi kan bruke egne tall for inntekt for mer presisjon.)
   * For Google: Test Engine kaller Google Ads Service: `GET /campaigns/444444/stats`. Svar kan være:

     ```json
     { "campaignId": 444444, "cost": 25.00, "impressions": 300, "clicks": 20, "conversions": 1, "conversion_value": 250.00 }
     ```

     (25 kr brukt, 1 konvertering registrert med verdi 250 kr via Google Conversion Tracking.)
   * Test Engine oppdaterer nå sine tall for annonsekostnad. Den kan velge å bruke summen av Facebook+Google kost og inntekt, eller holde dem separat per kanal. Siden vi kjører samlet ROAS, summerer vi:

     * Variant A: spend = 30(FB)+25(G) = 55, revenue = 500 (fra tracking, samme som pixel-data tilsa), ROAS = 500/55 ≈ 9.09.
     * Variant B: si at variant B (Produkt Y) fikk mindre respons: Meta insights for variant B kanskje 40 kr spend, 1 konv 250 kr; Google 20 kr spend, 0 konv. Sum variant B: spend = 60, revenue = 250, ROAS ≈ 4.17.
   * Disse tallene lagres i DB (kampanjedokument oppdateres). Test Engine logger dem også for referanse.

6. **Evaluering og auto-switch (Test Engine beslutter):** Test Engine har nå oppdaterte ROAS verdier for A og B. Den sjekker auto-switch kriteriene:

   * Har testen kjørt minimum nødvendig tid? (Anta at ja, eller at vi ignorerer det for demo.)
   * Er forskjellen betydelig? Variant A har ROAS \~9.1, B \~4.2. A er over dobbelt så høy, altså 118% høyere ROAS. Dette overstiger vår terskel (20%).
   * Er datagrunnlaget adekvat? (Totalt 3 konverteringer A vs 1 B, litt lavt antall men la oss si ok for demo.)

   Test Engine bestemmer **variant A som vinner**. Den utfører auto-switch:

   * Logger "Auto-switch triggered: Variant A outperformer B. Stopping variant B ads."
   * Kaller Meta Ads Service: `POST /campaigns/FBcampaign_BBBBB/pause` (med B's kampanje-ID). Meta API endrer status til PAUSED.
   * Kaller Google Ads Service: `POST /campaigns/GGGGGG/pause` (B's Google kampanje-ID). Google API endrer status til PAUSED.
   * Oppdaterer MongoDB:

     ```json
     "status": "completed",
     "results": {
       "spendA": 55.00, "revenueA": 500.00, "roasA": 9.09,
       "spendB": 60.00, "revenueB": 250.00, "roasB": 4.17,
       "winner": "A"
     },
     "completedDate": ISODate("2025-05-31T..."),
     "message": "Variant A automatisk valgt som vinner basert på ROAS."
     ```
   * (Evt.) Sender en melding tilbake til Orchestrator: Noen design lar Test Engine slå direkte opp DB, andre kan gi Orchestrator et ping om fullført test. Uansett, Orchestrator kan når som helst lese kampanjestatus fra DB og se at den nå er "completed".

7. **Oppdatering på frontend (Orchestrator → Frontend):** Frontend-klienten vil med jevne mellomrom hente oppdatert info, eller få push (via WebSocket eller SSE hvis implementert). La oss si frontend spørr Orchestrator hvert minutt om status på aktive kampanjer:

   ```http
   GET /api/campaigns/kampanje_abc123
   ```

   Nå svarer Orchestrator med de nyeste data:

   ```json
   {
     "campaignId": "kampanje_abc123",
     "status": "completed",
     "winner": { "variant": "A", "productId": "X", "produktNavn": "Produkt X" },
     "results": {
       "A": { "spend": 55.0, "revenue": 500.0, "roas": 9.09, "conversions": 3 },
       "B": { "spend": 60.0, "revenue": 250.0, "roas": 4.17, "conversions": 1 }
     },
     "started": "2025-05-29T10:00:00Z",
     "ended": "2025-05-31T15:00:00Z",
     "message": "Variant A er automatisk valgt som vinner og variant B er deaktivert."
   }
   ```

   Frontend oppdaterer visningen: markerer kampanjen som avsluttet, viser at Produkt X (variant A) vant med ROAS \~9.1 vs \~4.2, samt grafer/tabeller med disse tallene. Brukeren kan nå forstå utfallet og eventuelt la AdPilot fortsette å kjøre den vinnende annonsen (om ønskelig).

8. **Etterspill:**

   * Den vinnende annonsen (variant A) kan fortsette å gå ut testperioden eller lengre, noe AdPilot kan tillate. Test Engine kan la variant A's kampanjer fortsette, eller også skalere opp budsjettet for den (om implementert).
   * Data lagret kan brukes for rapportering. Brukeren kan se historikken i dashbordet senere.
   * Systemet er klart for neste testkampanje, f.eks. teste Produkt X mot et annet produkt, etc.

Denne gjennomgangen viser hvordan modulene utveksler informasjon: via REST API-kall (Orchestrator→Test Engine, Test Engine→Ads Services, Tracking→Orchestrator) og via delt database (Test Engine og Orchestrator begge leser/skriver kampanjedata). Datamodellene (kampanje, varianter, resultater) er strukturert som JSON-lignende dokumenter i MongoDB, som mappes godt til JSON-responsene Orchestrator gir til frontend.

## Eksempler på API-kall

Nedenfor er noen konkrete eksempler på hvordan du kan bruke API-et til AdPilot via kommandoer (cURL). Disse er nyttige for å teste systemet eller integrere med andre verktøy (f.eks. Postman).

### 1. Starte en ny testkampanje (POST /api/campaigns)

For å starte en A/B-test uten å gå via frontend, kan man gjøre et POST-kall direkte til Orchestrator API. Eksempel:

```bash
curl -X POST http://localhost:4000/api/campaigns \
     -H "Content-Type: application/json" \
     -d '{
           "name": "Sommer-kampanje",
           "variants": [
             { "productId": "SKU123", "name": "Produkt A", "creative": { "text": "30% rabatt på Produkt A!", "image": "https://example.com/a.jpg" } },
             { "productId": "SKU456", "name": "Produkt B", "creative": { "text": "30% rabatt på Produkt B!", "image": "https://example.com/b.jpg" } }
           ],
           "budgetPerDay": 100,
           "durationDays": 10,
           "channels": ["facebook", "google"],
           "targeting": { "country": "NO", "ageMin": 18, "ageMax": 65 }
         }'
```

Forklaring:

* `name` er valgfri beskrivelse av kampanjen.
* `variants` er en liste av to (eller flere) varianter. Her har vi to produkter med unike SKU/ID. `creative` inneholder annonsetekst og bilde-URL for hver variant.
* `budgetPerDay` er total dagsbudsjett som vil fordeles (her 100 kr/dag, som trolig deles 50/50 mellom variantene hvis ikke annet er angitt).
* `durationDays` er planlagt varighet for testen.
* `channels` angir hvilke kanaler (annonseringsplattformer) vi ønsker å bruke.
* `targeting` inneholder demografisk/geo målretting felles for variantene (her hele Norge, alder 18-65).

**Respons:** Hvis vellykket, returnerer API-et 201 Created med JSON som:

```json
{
  "campaignId": "camp_60b8e5d9",
  "status": "running",
  "variants": [
    { "id": "A", "productId": "SKU123", "name": "Produkt A", "status": "launching" },
    { "id": "B", "productId": "SKU456", "name": "Produkt B", "status": "launching" }
  ],
  "message": "Kampanje opprettet og tester Produkt A vs Produkt B."
}
```

Her ser vi at kampanjen har fått en intern ID (`camp_60b8e5d9` eksempel), status er "running" (i gang), og variantene er i "launching" fase (annonser opprettes). Dette svaret betyr at Orchestrator har registrert kampanjen og gitt beskjed til Test Engine om å sette i gang.

### 2. Hente status for en testkampanje (GET /api/campaigns/{id})

Når en kampanje er i gang kan man sjekke status når som helst. Bruk ID fra forrige respons:

```bash
curl http://localhost:4000/api/campaigns/camp_60b8e5d9
```

**Respons eksempel (under testkjøring):**

```json
{
  "campaignId": "camp_60b8e5d9",
  "name": "Sommer-kampanje",
  "status": "running",
  "variants": [
    { "id": "A", "productId": "SKU123", "name": "Produkt A", "spend": 30.0, "revenue": 0.0, "roas": 0.0 },
    { "id": "B", "productId": "SKU456", "name": "Produkt B", "spend": 30.0, "revenue": 0.0, "roas": 0.0 }
  ],
  "startDate": "2025-05-29T10:15:00Z",
  "updateDate": "2025-05-29T15:15:00Z",
  "message": "Kampanje er aktiv - foreløpig ingen konverteringer."
}
```

Dette viser at begge varianter har brukt ca 30 kr hver så langt og ingen inntekter registrert (ROAS 0). `updateDate` viser når sist data ble oppdatert. `message` kan gi en menneskelig status.

**Senere i testen** (f.eks. etter at noen salg har skjedd og Test Engine har oppdatert):

```json
{
  "campaignId": "camp_60b8e5d9",
  "name": "Sommer-kampanje",
  "status": "running",
  "variants": [
    { "id": "A", "productId": "SKU123", "name": "Produkt A", "spend": 50.0, "revenue": 300.0, "roas": 6.0 },
    { "id": "B", "productId": "SKU456", "name": "Produkt B", "spend": 48.0, "revenue": 150.0, "roas": 3.125 }
  ],
  "startDate": "2025-05-29T10:15:00Z",
  "updateDate": "2025-05-30T10:15:00Z",
  "message": "Produkt A presterer bedre enn B (ROAS 6.0 vs 3.125). Overvåker..."
}
```

Nå ser vi faktisk tall: variant A har ROAS 6.0, B har 3.125. Systemet har kanskje enda ikke auto-switched fordi man venter litt til for signifikans. `message` reflekterer at A ligger foran og at den fortsetter å overvåke.

**Etter auto-switch (kampanje avsluttet):**

```json
{
  "campaignId": "camp_60b8e5d9",
  "name": "Sommer-kampanje",
  "status": "completed",
  "winner": { "variant": "A", "productId": "SKU123", "name": "Produkt A" },
  "variants": [
    { "id": "A", "productId": "SKU123", "name": "Produkt A", "spend": 80.0, "revenue": 480.0, "roas": 6.0 },
    { "id": "B", "productId": "SKU456", "name": "Produkt B", "spend": 75.0, "revenue": 225.0, "roas": 3.0 }
  ],
  "startDate": "2025-05-29T10:15:00Z",
  "endDate": "2025-06-02T08:00:00Z",
  "message": "Test avsluttet. Variant A ble automatisk valgt som vinner (Produkt A)."
}
```

Nå er `status: completed` og feltet `winner` forteller at variant A vant. Variantenes sluttverdier er angitt (disse tallene indikerer totalt forbruk og inntekt frem til switch). `message` bekrefter auto-switch og hvilken variant som vant.

### 3. Opptak av konverteringshendelser (POST /api/track)

Dette endepunktet kalles vanligvis av Tracking Layer automatisk, men under utvikling kan du simulere det. La oss si en kunde kjøpte Produkt A for 249 NOK:

```bash
curl -X POST http://localhost:4000/api/track \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: hemmelig123" \
  -d '{
        "event": "Purchase",
        "properties": { "orderId": "1005", "value": 249.0, "currency": "NOK" },
        "context": { "campaignId": "camp_60b8e5d9", "variant": "A", "source": "facebook" },
        "timestamp": "2025-05-30T09:30:00Z"
      }'
```

Merk at vi sender med en header `X-API-KEY` med en secret (hvis satt opp slik). Bodyen inneholder det viktigste: `campaignId` og `variant` knytter hendelsen til riktig test.

**Respons:** 200 OK (ingen spesiell body ved suksess). I Orchestrator-loggen bør du se noe slikt som "Received Purchase event for camp\_60b8e5d9 variant A, value=249". Og i kampanjestatus (som vist over) vil revenueA øke med 249.

### 4. Hente liste over kampanjer (GET /api/campaigns)

For oversikt kan man be om alle kampanjer:

```bash
curl http://localhost:4000/api/campaigns
```

**Respons:**

```json
[
  {
    "campaignId": "camp_60b8e5d9",
    "name": "Sommer-kampanje",
    "status": "completed",
    "winner": { "variant": "A", "productId": "SKU123", "name": "Produkt A" },
    "roasWinner": 6.0,
    "roasLoser": 3.0,
    "startDate": "2025-05-29T10:15:00Z",
    "endDate": "2025-06-02T08:00:00Z"
  },
  {
    "campaignId": "camp_70c1f3aa",
    "name": "Høst-kampanje",
    "status": "running",
    "variants": [
      { "id": "A", "productId": "SKU789", "name": "Produkt C", "roas": 0.0 },
      { "id": "B", "productId": "SKU012", "name": "Produkt D", "roas": 0.0 }
    ],
    "startDate": "2025-06-10T12:00:00Z"
  }
]
```

Her ser vi en fullført kampanje og en som kjører. Dette gir en rask oversikt for dashbordets forsidesliste.

### 5. (Valgfritt) Kontroll av annonse-tjenestene direkte

Disse API-kallene er mer for utviklere:

* Sjekk at Meta Ads Service lever:

  ```bash
  curl http://localhost:5001/health
  ```

  Forventer noe slikt som `{"status":"ok","facebookApi":"connected"}`.
* Sjekk at Google Ads Service lever:

  ```bash
  curl http://localhost:5002/health
  ```

  Svar: `{"status":"ok","googleAdsApi":"connected"}` eller lignende.

Disse hjelper å verifisere at integrasjoner fungerer (kanskje de prøver et lett API-kall med credentials for å bekrefte).

### 6. Avslutte en test manuelt (DELETE /api/campaigns/{id})

Dersom du ønsker å avslutte en testkampanje manuelt før auto-switch, kan det finnes et API-endepunkt for det (hvis implementert):

```bash
curl -X DELETE http://localhost:4000/api/campaigns/camp_70c1f3aa
```

Dette skal få Test Engine til å stoppe begge varianter umiddelbart:
**Respons:**

```json
{ "message": "Campaign camp_70c1f3aa stopped. All variants paused.", "status": "stopped" }
```

I praksis ville Orchestrator da kalt Meta/Google for å pause, og markert status "stopped" i DB. (Brukeren kan ha ønsket å stoppe en dårlig presterende test før tiden).

> **Merk:** API-designet kan variere. Den faktiske implementasjonen kan bruke litt andre URL-mønstre (f.eks. `/tests` i stedet for `/campaigns`, eller separate endpoints per tjeneste). Eksemplene over er basert på et forenklingsprinsipp der Orchestrator har en samlet `/campaigns`-resource. Rådfør deg med prosjektets API-dokumentasjon eller kildekode for nøyaktige endepunkter.

## Tips for produksjonsklar distribusjon

AdPilot kan kjøre i produksjon på en server eller skyplattform. Når man går fra lokal utvikling til produksjon, bør man ta hensyn til flere ting:

**1. Docker Swarm / Kubernetes orkestrering:** I produksjon vil man gjerne spre tjenestene over flere noder for å kunne skalere og håndtere feil:

* **Docker Swarm:** Du kan relativt enkelt ta docker-compose.yml og deploye som en stack i Swarm. Sørg for å bruke images (f.eks. bygg images og push til en registry) i stedet for å bygge lokalt i prod. Bruk `docker stack deploy -c docker-compose.yml adpilot` for å starte. Swarm håndterer service discovery likt Compose, men for robusthet kan du definere restart-politikk, flere replicas for kritiske tjenester (f.eks. 2 replicas av Orchestrator for høy tilgjengelighet).
* **Kubernetes:** Oversett Compose til Kubernetes Deployment/Service-manifester. Hver tjeneste blir en deployment med tilhørende service (for intern DNS). MongoDB og Redis kan kjøre som StatefulSets med persisterende lagring. Kubernetes gir mer kontroll på autoskalering (f.eks. auto-scale test-engine hvis mange kampanjer kjører parallelt).

**2. Håndtering av secrets:** Unngå å bake inn API-nøkler og passord i container-images eller i Compose-fil i ren tekst når du deployer:

* Bruk Docker Secrets (hvis Swarm): Du kan lagre f.eks. `FB_ACCESS_TOKEN`, `GOOGLE_ADS_CLIENT_SECRET` osv. som secrets. I compose/swarm definisjonen kan du da mounte disse som filer eller env. (F.eks. `GOOGLE_ADS_CLIENT_SECRET_FILE=/run/secrets/google_client_secret` og tjenesten leser fra fil).
* I Kubernetes, bruk **Secrets** objekter og referer dem i miljøvariabler.
* Alternativt, bruk en tjeneste som **HashiCorp Vault** eller cloud provider secret manager for å levere nøkler sikkert til appene.
* Aldri logg secrets og unngå å sjekke dem inn i kildekode. I produksjon bør .env-filer bare eksistere på serveren (eller CI pipeline) og ikke i repo.

**3. OAuth tokens og fornyelse:** Både Facebook og Google tokens kan utløpe:

* **Facebook:** Hvis du bruker en langtids virksomhetstilgangstoken (Business Integration token), kan den vare lenge, men for individual user tokens utløper de vanligvis etter \~60 dager. Overvåk tokenets gyldighet. Meta Ads Service kan implementere en rutine for å fornye token ved behov (f.eks. gjennom refresh med app secret, eller be admin re-auth if needed).
* **Google:** Refresh token varer til det blir revokert. Men access token generert fra det er gyldig i 1 time. Google Ads SDK håndterer automatisk refresh hvis config er satt opp riktig. Påse at refresh token ikke utløper (det skjer om brukeren som ga det trekker tilbake tilgang).
* Loggfør hvis API-svar indikerer utløpt/ugyldig token, så man kan reagere (f.eks. sende varsel om at ny auth er nødvendig).
* I produksjon kan det være lurt å integrere en mekanisme for at butikk-eieren kan koble til sine annonsekontoer via OAuth-prosedyre gjennom AdPilot, i stedet for at du manuelt setter tokens. Dette innebærer UI for autorisasjon (f.eks. "Koble til Facebook Ads" knapp som leder dem til Facebook OAuth og tilbake, hvorpå du lagrer tokens i DB).

**4. Skalerbarhet og ytelse:**

* **Orchestrator:** Bør være stateless (ingen sesjonsdata lokalt) slik at du kan kjøre flere instanser bak en load balancer. All deling skjer via DB/Redis. Sjekk at den håndterer concurrency (f.eks. to requests som starter to kampanjer samtidig).
* **Test Engine:** Hvis mange kampanjer kjører parallelt, kan du skalere ut Test Engine også (flere instanser). Men da må man passe på at man ikke dublerer jobbene – dvs. to instanser bør ikke behandle samme kampanje samtidig. Dette kan løses ved å fordele kampanjer mellom instanser eller bedre, introduksjon av en jobbkø hvor én instans tar en jobb. Alternativ arkitektur: kjøre Test Engine som en **scheduled job** i stedet (f.eks. en CronJob i Kubernetes som kjører hvert X minutt og poller alt i bulk).
* **MongoDB/Redis:** I større skala, vurder å kjøre disse som administrerte tjenester (f.eks. MongoDB Atlas, Redis Enterprise) eller i cluster mode for Redis (Redis Sentinel/Cluster for HA). Det sikrer at data lagres trygt og at du får automatiske backups, etc.
* **Logging & Monitoring:** Implementer aggregerte logger (f.eks. ELK stack eller cloud logging). Overvåk viktige metrikker:

  * CPU/memory bruk per tjeneste (spesielt Test Engine under last).
  * Antall API-kall mot Facebook/Google per tidsvindu (APIene har kvoter – loggfør kall og responser så du ser om du nærmer deg grenser).
  * Antall konverteringshendelser mottatt vs. registrert (slik at du ikke mister data i tracking).

**5. Sikkerhet:**

* **Autentisering og tilgang:** I et faktisk SaaS-produkt bør Orchestrator API kreve autentisering på alle endepunkter. Siden AdPilot er for Shopify-butikker, bør autentiseringen integreres med Shopify OAuth (dvs. at hver butikk som installerer AdPilot gir en token som identifiserer dem). Orchestrator kan da bruke denne til å skille data per butikk. Vår nåværende versjon har ikke implementert full auth; det bør legges til før prod, for å unngå at uvedkommende kan gjøre endringer. Alternativ for intern bruk: IP-whitelisting eller en enkel API-nøkkel mekanisme.
* **HTTPS:** All kommunikasjon i produksjon bør skje over HTTPS, spesielt siden vi sender sensitive nøkler/hendelser. Sett opp en reverse proxy (som Nginx, Traefik eller en cloud load balancer) med TLS-sertifikat for domenet ditt som videresender til Orchestrator (og eventuelt frontend som statisk side).
* **CORS:** Konfigurer Orchestrator til kun å tillate forespørsler fra kjente domener (f.eks. din frontend URL, eller Shopify embed app) for å hindre misbruk.
* **Rate limiting:** Implementer rate limit på Orchestrator API for å forhindre at en klient (eller feilaktig skript) spammer endepunkter og forårsaker unødig belastning eller overskrider API-kvoter ved å trigge masse FB/Google kall. Express middleware eller API gateway kan brukes til dette.

**6. Kontinuerlig deploy og CI/CD:**

* Bruk CI for å bygge og teste container-images på hver git push.
* Sett opp en pipeline for å pushe images til en registry (Docker Hub, ECR, etc.).
* Automatiser deploy til produksjon (f.eks. ved å bruke Terraform for infrastruktur og ArgoCD eller simple scripts for til å rulle ut nye versjoner).
* Ha separate miljøer: Dev/Staging for å teste med dummy annonsekontoer før du går live mot ekte kontoer i Prod.

**7. Overvåk ROI og budsjett:**

* I produksjon med ekte annonsepenger involvert, ha på plass overvåking som varsler om uventet adferd:
* Sette maksgrenser: f.eks. totalt budsjett tak for hva AdPilot kan bruke per dag for en kunde, i tilfelle noe går galt og ads ikke stopper.
* Varsling: Integrer med e-post eller Slack for å varsle dersom f.eks. ROAS er veldig dårlig etter X tid (slik at brukeren kan vurdere å avbryte), eller hvis integrasjonen mot en plattform feiler (så ads ikke blir laget eller stoppet som de skal).
* Logging av alle beslutninger (hvilken variant ble valgt og hvorfor) – dette er nyttig både for tillit og for debugging dersom en kunde spør "hvorfor valgte systemet variant A?".

**8. Fremtidige forbedringer:**

* **AI-optimalisering:** Dagens Test Engine bytter basert på ROAS-regler. I fremtiden kan man bruke mer avanserte AI/ML-modeller for å predikere vinner tidligere eller gjøre multi-armed bandit tilnærming i stedet for hard A/B (dynamisk fordeling av budsjett proporsjonalt med ytelse).
* **Støtte flere plattformer:** AdPilot kan utvides til andre kanaler (Snapchat, Pinterest, TikTok Ads) med tilsvarende microservice integrasjoner.
* **UI/UX:** Forbedre dashbordet med f.eks. live oppdatering via WebSockets, mer visualisering av statistikk, og onboarding-hjelp for brukere (f.eks. guider dem gjennom å hente sine tokens/API-nøkler).
* **Testing:** Skriv integrasjonstester som spinner opp en test stack (f.eks. med docker compose i CI) og kjører et helt scenario automatisk for å fange regresjoner.

Ved å følge disse retningslinjene og beste praksisene, vil AdPilot være bedre rustet for en stabil og sikker produksjonsdrift. Den modulære arkitekturen med containere gjør det fleksibelt å utvide og vedlikeholde systemet når det vokser i kompleksitet og bruk.

---

*Denne README.md dekker det meste av det tekniske ved AdPilot. For ytterligere detaljer, se gjerne i kildekoden for hver tjeneste (kommentarer og dokumentasjon der), eller kontakt utviklerteamet for spørsmål.*
