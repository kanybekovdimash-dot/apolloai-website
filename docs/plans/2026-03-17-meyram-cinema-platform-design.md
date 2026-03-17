# Meyram Cinema Universe — Platform Design

## 1. Product Vision

PWA-platform (app.apolloai.biz) — casting aggregator for children's film industry.
"Disney meets casting" — magical universe where kids become stars, parents stay in control.

**Core value:** smart role matching by age+gender, competition transparency (application counters), deadline urgency (live timers).

## 2. Architecture

```
app.apolloai.biz (PWA - React + Vite)
├── Frontend: React 19 + Vite + React Router
├── Backend: Supabase (Auth, PostgreSQL, Storage, Realtime)
├── AI Chat: existing Cloudflare Worker (Llama 4 Scout via Groq)
├── Deploy: Cloudflare Pages
├── Casting Test: MediaPipe Face Landmarker (existing, enhanced)
└── PWA: Service Worker + Web App Manifest
```

apolloai.biz (existing) — agency landing page with hero, slider, contact info.
app.apolloai.biz (new) — the platform described below.

## 3. User Roles

| Role | Description |
|------|-------------|
| Actor (actor) | Registers, fills profile, browses feed, applies for roles |
| Parent (parent) | Same as actor but manages child profiles (under 18) |
| Superadmin (superadmin) | Creates projects/roles, reviews applications, approves actors |

## 4. Authentication

Free OAuth providers via Supabase Auth:
- Google Sign-In (Android users, majority)
- Apple Sign-In (iOS users, required by Apple for App Store)
- Telegram Login Widget (popular in Kazakhstan, free)

No SMS OTP — all providers are free and unlimited.

## 5. Database Schema

### Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id),
  role_type TEXT CHECK (role_type IN ('actor', 'parent', 'superadmin')) DEFAULT 'actor',
  full_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female')),
  avatar_url TEXT,
  portfolio_links JSONB DEFAULT '[]',
  physical_params JSONB DEFAULT '{}',
  -- physical_params: { height_cm, weight_kg, hair_color, eye_color }
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Parent-Child relationship
```sql
CREATE TABLE parent_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES users(id),
  child_id UUID REFERENCES users(id),
  UNIQUE(parent_id, child_id)
);
```

### Projects (Films)
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  genre_tags TEXT[] DEFAULT '{}',
  status TEXT CHECK (status IN ('active', 'upcoming', 'archived')) DEFAULT 'active',
  casting_deadline TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Roles
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  req_gender TEXT CHECK (req_gender IN ('male', 'female', 'any')) DEFAULT 'any',
  req_age_min INT,
  req_age_max INT,
  is_open BOOLEAN DEFAULT true,
  approved_actor_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Applications
```sql
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id),
  applied_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role_id, actor_id) -- spam protection: one application per role per actor
);
```

### Casting Test Results
```sql
CREATE TABLE casting_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  scores JSONB NOT NULL, -- [{ emotion, label, score }]
  total_score INT NOT NULL,
  tested_at TIMESTAMPTZ DEFAULT now()
);
```

### AI Chat Leads (from Meyram AI widget)
```sql
CREATE TABLE chat_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  child_name TEXT,
  child_age TEXT,
  parent_name TEXT,
  phone TEXT,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## 6. Navigation

Bottom tab bar (mobile-first):
```
🎬 Кастингтер  |  🔍 Іздеу  |  🎭 Кастинг-тест  |  👤 Профиль
```

Floating AI chat button (bottom-right, over all pages) — existing Meyram AI widget.

## 7. Screens

### 7.1 Feed ("Кастингтер" — Home)

Three sections:
1. **Hero Carousel** — auto-scrolling posters of active projects. Each slide: full-width poster, title, genre badge, live countdown timer, dot indicators. Swipe on mobile, arrows on desktop. Tap → project detail page.

2. **"Саған сәйкес рөлдер"** (Matching roles) — horizontal scroll of role cards matched by actor's age + gender. Each card: role title, age range, application counter.

3. **"Барлық кастингтер"** (All castings) — vertical list of all active projects sorted by deadline (soonest first).

**Smart matching algorithm:**
1. Top: roles where actor's age falls within req_age_min..req_age_max AND gender matches
2. Below: sorted by casting_deadline ASC (soonest deadline first)

Age is calculated dynamically: `EXTRACT(YEAR FROM AGE(NOW(), birth_date))`.

### 7.2 Project Detail

- Large poster header
- Title + genre badges + year
- Live countdown timer with progress bar
- Plot description (logline)
- List of roles:
  - Role title, required gender, age range
  - 4 mini-avatars of recent applicants + counter ("+18 адам")
  - "ТАНДАУ" button (gold, animated)
  - If role matches actor: gold border + "Саган сайкес!" badge
  - If role closed: grey, lock icon, "Актер бекiтiлдi"
- After applying: confetti animation + "Сатті! Сіздің өтінішіңіз қабылданды"

### 7.3 Casting Test (separate tab)

Full-screen camera with MediaPipe face landmark overlays (lips, eyes, brows, face oval).
5 random emotions, 6 seconds each, scored in %.

Below camera:
- **History** — past test results with dates and scores (stored in Supabase)
- **Leaderboard** — global ranking of actors by best casting test score

Results linked to actor profile → visible to admin when reviewing applications.

### 7.4 Search ("Іздеу")

Filter/search castings by:
- Genre tags
- Age range
- Gender
- Status (open/upcoming)

### 7.5 Actor Profile

- Avatar + name + dynamic age + gender
- Photo portfolio (up to 10 photos)
- Video greeting (recorded via built-in recorder)
- Physical parameters (height, weight, hair color, eye color)
- Casting test stats (best score, last score, total tests)
- Application history with statuses:
  - 🟢 Кутілуде (Pending)
  - ⭐ Бекітілді (Approved!)
  - 🔴 Мерзімі өтті (Deadline passed)

Parent accounts can manage multiple child profiles.

### 7.6 Onboarding

Step 1: Account type (Actor 18+ / Parent of child)
Step 2: Auth (Google / Apple / Telegram)
Step 3: Basic info (name, birth date, gender) — progress 1/3
Step 4: Photo upload (skippable) — progress 2/3
Step 5: Physical params (height, weight, hair, eye color) — progress 3/3
Welcome screen: star animation + "Қош келдіңіз, [name]!"

### 7.7 Admin Panel (web only, desktop)

Accessible only by superadmin role_type. Sections:
- **Dashboard** — total actors, active castings, today's applications, avg casting test score
- **Projects CRUD** — create/edit/archive films with poster, description, genre, deadline
- **Roles CRUD** — add roles to projects, set requirements, open/close
- **Applications** — list all applicants per role with photo, video, casting test score. Approve/reject buttons.
- **Chat Leads** — leads collected by Meyram AI (moved from Telegram to admin panel)
- **Actors DB** — full searchable/filterable actor database
- **Excel export** — download applicant lists

## 8. Visual Design: "Meyram Cinema Universe"

**Color palette:**
- Primary background: deep dark blue (#0a0e27) — cosmic night sky
- Secondary background: (#111638) — card surfaces
- Gold accent: (#c8a264) — buttons, highlights, star elements
- Bright gold: (#f0d478) — active states, hover
- Text primary: white (#ffffff)
- Text secondary: (#9ca3af)
- Success: (#4caf50)
- Danger/timer: (#ef4444)
- Card gradient: dark blue → slightly lighter blue

**Typography:**
- Headings: bold, slightly rounded (Inter or Nunito)
- Body: clean, readable (Inter)
- Kazakh language throughout UI

**Visual effects:**
- Subtle star particles on background (CSS/canvas)
- Gold glow on interactive elements
- Confetti animation on successful application
- Smooth page transitions
- Card hover: slight lift + gold border glow
- Countdown timers: red pulsing when < 24h remaining

**Film cards in feed (premium quality):**
- Full poster as background with gradient overlay (bottom dark)
- Title in bold white over gradient
- Genre badge (pill-shaped, semi-transparent)
- Countdown timer (red, monospace font, live ticking)
- Aspect ratio 2:3 (standard movie poster)
- Smooth scroll with snap points
- Shadow and depth on hover/touch

**Mascot:**
- Meyram AI avatar — the chatbot IS the mascot of the universe
- Appears as floating FAB and inside chat

## 9. Data Flow Changes

**Before:** AI Chat → LEAD_DATA extraction → Telegram channel
**After:** AI Chat → LEAD_DATA extraction → Supabase `chat_leads` table → visible in Admin panel

The Cloudflare Worker `/lead` endpoint will POST to Supabase instead of Telegram Bot API.

## 10. PWA Features

- `manifest.json` — app name, icons, theme color, display: standalone
- Service Worker — offline caching of static assets, shell
- Install prompt — "Қосымшаны орнату" banner
- Push notifications (future) — new castings matching your profile

## 11. Deployment

- **Frontend:** Cloudflare Pages (auto-deploy from GitHub)
- **Subdomain:** app.apolloai.biz → CNAME to Cloudflare Pages
- **Supabase:** hosted, free tier (500MB DB, 1GB storage, 50k auth users)
- **AI Worker:** existing Cloudflare Worker (apolloai-meyram-api)

## 12. No Geography

No city field anywhere. Platform is location-agnostic.
Matching is purely by age + gender.
Leaderboard is global, not city-based.
