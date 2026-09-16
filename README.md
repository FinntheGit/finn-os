# Finn OS v0.1

Persoonlijke mobiele webapp voor **Sport, Gewicht, Geld, Agenda en je dagelijkse dashboard**.

## Wat zit er al in deze starter?

- Responsive dashboard voor telefoon + laptop
- Light/dark mode via systeeminstelling
- Pagina's voor Vandaag, Sport, Gewicht, Geld en Agenda
- 30-seconden dagcheck-in prototype
- Supabase browser/server clients voorbereid
- Next.js 16 Proxy voor Supabase sessierefresh
- SQL-schema voor alle v1-tabellen
- Row Level Security op elke persoonlijke tabel
- Money Vault: financiële data is ontworpen als client-side versleutelde JSON
- Web Crypto helper met PBKDF2 + AES-GCM als basis voor Money Lock

## Belangrijk

De schermen bevatten bewust nog geen persoonlijke financiële bedragen of gezondheidsdata in de broncode. Die worden pas na login vanuit jouw database geladen.

## Stack

- Next.js 16.3.4
- React 19.2.8
- Supabase Auth + Postgres
- `@supabase/ssr`
- Vercel voor hosting

## 1. Lokaal draaien

```bash
npm install
npm run dev
```

Open daarna `http://localhost:3000`.

## 2. Supabase koppelen

1. Maak een Supabase-project.
2. Kopieer `.env.example` naar `.env.local`.
3. Vul je Project URL en Publishable Key in.
4. Open Supabase > SQL Editor.
5. Voer `supabase/migrations/001_finn_os_v1.sql` uit.
6. Maak één gebruiker aan voor jezelf via Supabase Auth.
7. Schakel publieke sign-ups uit zodra je account bestaat.

`.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## 3. GitHub + Vercel

- Maak bij voorkeur een **private GitHub repository**.
- Push deze map naar GitHub.
- Importeer de repository in Vercel.
- Voeg dezelfde twee Supabase environment variables toe in Vercel.
- Deploy.

Zo draait Finn OS volledig in de browser; op de werklaptop hoeft dan geen speciale software geïnstalleerd te worden voor dagelijks gebruik.

## Money Lock

`src/lib/money-crypto.ts` bevat de technische basis. Het principe:

1. Jij ontgrendelt Money met een aparte geheime code/passphrase.
2. De browser leidt daar lokaal een encryptiesleutel uit af.
3. Bedragen en financiële details worden lokaal versleuteld.
4. Alleen ciphertext gaat naar Supabase.
5. De geheime code zelf wordt niet opgeslagen.

Voor productie kiezen we bij voorkeur een sterke passphrase of een langere PIN. Een simpele 4-cijferige PIN is niet sterk genoeg tegen offline brute-force als een databasekopie ooit uitlekt.

## Eerstvolgende bouwstappen

1. Auth + pagina-afscherming activeren.
2. Gewicht toevoegen/bewerken + 4-weken-trend.
3. Sportmoment toevoegen + gymsets + PR-detectie.
4. Money Lock UI + versleutelde financiële CRUD.
5. ING CSV-import + categorisatie.
6. Eigen agenda-items + Top 3.
7. Dashboard koppelen aan echte data.
8. Monday 08:00 weekly review en maandreview.

## Data die nog later ingevuld kan worden

- exacte vaste lasten
- actuele beleggingen
- DUO-schuld + maandaflossing
- actuele gewichtsmeting

Deze gegevens zijn **niet nodig om de app verder te bouwen**.
