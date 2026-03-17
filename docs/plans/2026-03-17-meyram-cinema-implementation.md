# Meyram Cinema Universe — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a PWA casting platform at app.apolloai.biz where actors browse film castings, apply for roles, take emotion tests, and admins manage everything via web panel.

**Architecture:** React 19 + Vite frontend deployed on Cloudflare Pages. Supabase for auth (Google/Apple/Telegram), PostgreSQL database, file storage, and realtime subscriptions. Existing Cloudflare Worker adapted for AI chat with leads going to Supabase instead of Telegram.

**Tech Stack:** React 19, Vite 6, React Router 7, Supabase JS client, TailwindCSS 4, Framer Motion, MediaPipe Face Landmarker, Cloudflare Pages.

---

## Phase 1: Project Scaffolding & Supabase Setup

### Task 1: Create new React+Vite project in subdirectory

**Files:**
- Create: `app/package.json`
- Create: `app/vite.config.js`
- Create: `app/index.html`
- Create: `app/src/main.jsx`
- Create: `app/src/App.jsx`
- Create: `app/tailwind.config.js`
- Create: `app/postcss.config.js`

**Step 1: Scaffold Vite project**

```bash
cd "E:\Проект в гитхабе"
npm create vite@latest app -- --template react
```

**Step 2: Install dependencies**

```bash
cd app
npm install react-router-dom @supabase/supabase-js framer-motion
npm install -D tailwindcss @tailwindcss/vite
```

**Step 3: Configure Vite with Tailwind**

`app/vite.config.js`:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 3000 }
})
```

**Step 4: Configure Tailwind with Meyram Cinema theme**

`app/src/index.css`:
```css
@import "tailwindcss";

@theme {
  --color-bg-primary: #0a0e27;
  --color-bg-card: #111638;
  --color-bg-card-hover: #1a1f4a;
  --color-gold: #c8a264;
  --color-gold-bright: #f0d478;
  --color-gold-deep: #8a6633;
  --color-danger: #ef4444;
  --color-success: #4caf50;
  --color-text-primary: #ffffff;
  --color-text-secondary: #9ca3af;
  --font-family-ui: "Inter", "Montserrat", sans-serif;
}
```

**Step 5: Set up basic App shell with router**

`app/src/App.jsx`:
```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Feed from './pages/Feed'
import Search from './pages/Search'
import CastingTest from './pages/CastingTest'
import Profile from './pages/Profile'
import ProjectDetail from './pages/ProjectDetail'
import Onboarding from './pages/Onboarding'
import Login from './pages/Login'
import Admin from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding/*" element={<Onboarding />} />
        <Route path="/admin/*" element={<Admin />} />
        <Route element={<Layout />}>
          <Route index element={<Feed />} />
          <Route path="/search" element={<Search />} />
          <Route path="/casting-test" element={<CastingTest />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/project/:id" element={<ProjectDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

**Step 6: Verify dev server starts**

```bash
cd app && npm run dev
```
Expected: Vite dev server on http://localhost:3000

**Step 7: Commit**

```bash
git add app/
git commit -m "feat: scaffold React+Vite+Tailwind app in /app directory"
```

---

### Task 2: Set up Supabase project and database schema

**Files:**
- Create: `app/supabase/schema.sql`
- Create: `app/src/lib/supabase.js`
- Create: `app/.env.local` (not committed)
- Create: `app/.env.example`

**Step 1: Create Supabase project**

Go to https://supabase.com/dashboard → New Project → Name: "meyram-cinema" → Region: closest to Kazakhstan (eu-central-1 or ap-southeast-1). Save the project URL and anon key.

**Step 2: Write full database schema**

`app/supabase/schema.sql`:
```sql
-- Users (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role_type TEXT CHECK (role_type IN ('actor', 'parent', 'superadmin')) DEFAULT 'actor',
  full_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female')),
  avatar_url TEXT,
  portfolio_photos TEXT[] DEFAULT '{}',
  video_url TEXT,
  physical_params JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Parent-child relationships
CREATE TABLE public.parent_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  child_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(parent_id, child_id)
);

-- Projects (Films)
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  genre_tags TEXT[] DEFAULT '{}',
  status TEXT CHECK (status IN ('active', 'upcoming', 'archived')) DEFAULT 'active',
  casting_deadline TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Roles within projects
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  req_gender TEXT CHECK (req_gender IN ('male', 'female', 'any')) DEFAULT 'any',
  req_age_min INT,
  req_age_max INT,
  is_open BOOLEAN DEFAULT true,
  approved_actor_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Applications (one per actor per role)
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  applied_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role_id, actor_id)
);

-- Casting test results
CREATE TABLE public.casting_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  scores JSONB NOT NULL,
  total_score INT NOT NULL,
  tested_at TIMESTAMPTZ DEFAULT now()
);

-- AI Chat leads
CREATE TABLE public.chat_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  child_name TEXT,
  child_age TEXT,
  parent_name TEXT,
  phone TEXT,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Dynamic age calculation function
CREATE OR REPLACE FUNCTION calculate_age(birth DATE)
RETURNS INT AS $$
  SELECT EXTRACT(YEAR FROM AGE(NOW(), birth))::INT;
$$ LANGUAGE SQL IMMUTABLE;

-- View: roles with application counts
CREATE OR REPLACE VIEW roles_with_counts AS
SELECT
  r.*,
  p.title AS project_title,
  p.cover_image AS project_cover,
  p.casting_deadline,
  p.status AS project_status,
  COUNT(a.id) AS application_count,
  ARRAY_AGG(u.avatar_url ORDER BY a.applied_at DESC) FILTER (WHERE u.avatar_url IS NOT NULL) AS recent_avatars
FROM roles r
JOIN projects p ON r.project_id = p.id
LEFT JOIN applications a ON a.role_id = r.id
LEFT JOIN users u ON u.id = a.actor_id
GROUP BY r.id, p.title, p.cover_image, p.casting_deadline, p.status;

-- RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casting_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_leads ENABLE ROW LEVEL SECURITY;

-- Users: read own profile, superadmin reads all
CREATE POLICY "Users read own" ON public.users FOR SELECT
  USING (auth_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role_type = 'superadmin'
  ));
CREATE POLICY "Users update own" ON public.users FOR UPDATE
  USING (auth_id = auth.uid());
CREATE POLICY "Users insert own" ON public.users FOR INSERT
  WITH CHECK (auth_id = auth.uid());

-- Projects: everyone reads, superadmin writes
CREATE POLICY "Projects read all" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Projects admin write" ON public.projects FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role_type = 'superadmin'));

-- Roles: everyone reads, superadmin writes
CREATE POLICY "Roles read all" ON public.roles FOR SELECT USING (true);
CREATE POLICY "Roles admin write" ON public.roles FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role_type = 'superadmin'));

-- Applications: actors insert own, read own, superadmin reads all
CREATE POLICY "Applications insert own" ON public.applications FOR INSERT
  WITH CHECK (actor_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));
CREATE POLICY "Applications read own" ON public.applications FOR SELECT
  USING (actor_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()) OR EXISTS (
    SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role_type = 'superadmin'
  ));

-- Casting results: actors insert own, read own + leaderboard, superadmin reads all
CREATE POLICY "Casting read" ON public.casting_results FOR SELECT USING (true);
CREATE POLICY "Casting insert own" ON public.casting_results FOR INSERT
  WITH CHECK (actor_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- Chat leads: superadmin only
CREATE POLICY "Leads admin only" ON public.chat_leads FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role_type = 'superadmin'));
CREATE POLICY "Leads insert any" ON public.chat_leads FOR INSERT WITH CHECK (true);

-- Enable realtime for applications (live counters)
ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;
```

**Step 3: Run schema in Supabase SQL Editor**

Go to Supabase Dashboard → SQL Editor → paste and execute.

**Step 4: Configure Auth providers**

Supabase Dashboard → Authentication → Providers:
- Enable Google (add client ID/secret from Google Cloud Console)
- Enable Apple (add service ID/key from Apple Developer)
- Enable custom provider for Telegram (via Edge Function)

**Step 5: Create Supabase client**

`app/src/lib/supabase.js`:
```js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

`app/.env.example`:
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_API_BASE=https://apolloai-meyram-api.kanybekovdimash.workers.dev
```

**Step 6: Commit**

```bash
git add app/supabase/ app/src/lib/ app/.env.example
git commit -m "feat: add Supabase schema, RLS policies, and client config"
```

---

## Phase 2: Auth & Onboarding

### Task 3: Auth context and login page

**Files:**
- Create: `app/src/contexts/AuthContext.jsx`
- Create: `app/src/pages/Login.jsx`
- Create: `app/src/hooks/useUser.js`

**Step 1: Create AuthContext**

`app/src/contexts/AuthContext.jsx`:
```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        if (session) await fetchProfile(session.user.id)
        else { setProfile(null); setLoading(false) }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(authId) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })

  const signInWithApple = () =>
    supabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: window.location.origin } })

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ session, profile, loading, signInWithGoogle, signInWithApple, signOut, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
```

**Step 2: Create Login page**

`app/src/pages/Login.jsx`:
```jsx
import { useAuth } from '../contexts/AuthContext'
import { Navigate } from 'react-router-dom'

export default function Login() {
  const { session, profile, loading, signInWithGoogle, signInWithApple } = useAuth()

  if (loading) return <LoadingScreen />
  if (session && profile) return <Navigate to="/" />
  if (session && !profile) return <Navigate to="/onboarding" />

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-6">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gold mb-2">MEYRAM</h1>
        <p className="text-gold-bright text-lg">CINEMA UNIVERSE</p>
        <p className="text-text-secondary mt-4 text-sm">Жулдыздар мунда басталады</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <button onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 py-3 px-6 rounded-xl font-medium">
          <GoogleIcon /> Google аркылы кіру
        </button>

        <button onClick={signInWithApple}
          className="w-full flex items-center justify-center gap-3 bg-black text-white py-3 px-6 rounded-xl font-medium">
          <AppleIcon /> Apple аркылы кіру
        </button>
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add app/src/contexts/ app/src/pages/Login.jsx app/src/hooks/
git commit -m "feat: add auth context with Google/Apple login"
```

---

### Task 4: Onboarding flow (3 steps)

**Files:**
- Create: `app/src/pages/Onboarding.jsx`
- Create: `app/src/pages/onboarding/StepType.jsx`
- Create: `app/src/pages/onboarding/StepBasicInfo.jsx`
- Create: `app/src/pages/onboarding/StepPhoto.jsx`
- Create: `app/src/pages/onboarding/StepParams.jsx`

Onboarding is a multi-step form:
1. Account type (actor 18+ / parent of child)
2. Basic info (name, birth date, gender)
3. Photo upload (skippable)
4. Physical params (height, weight, hair, eye color)

On completion: insert row into `users` table, redirect to feed.

**Step 1: Create step components** (each as a separate file with form fields and validation)
**Step 2: Create parent Onboarding component** with step state and progress bar
**Step 3: Test the flow** — register via Google, fill onboarding, verify user appears in Supabase
**Step 4: Commit**

---

## Phase 3: Core Pages

### Task 5: Layout with bottom navigation

**Files:**
- Create: `app/src/components/Layout.jsx`
- Create: `app/src/components/BottomNav.jsx`
- Create: `app/src/components/ChatFab.jsx`

Bottom tab bar with 4 tabs: Кастингтер, Іздеу, Кастинг-тест, Профиль.
Floating AI chat button (bottom-right corner, above tab bar).

**Step 1: Build Layout** — Outlet + BottomNav + ChatFab
**Step 2: Build BottomNav** — 4 tabs with icons, active state highlight (gold)
**Step 3: Build ChatFab** — floating round gold button (speech bubble SVG from existing code)
**Step 4: Commit**

---

### Task 6: Feed page — Hero Carousel

**Files:**
- Create: `app/src/pages/Feed.jsx`
- Create: `app/src/components/HeroCarousel.jsx`
- Create: `app/src/components/ProjectCard.jsx`
- Create: `app/src/components/CountdownTimer.jsx`

**CRITICAL: This must be premium quality. Film cards are the soul of the platform.**

`HeroCarousel` specifications:
- Full-width swipeable carousel (touch + mouse drag)
- Each slide: full poster as background, dark gradient overlay from bottom
- Title in bold white, genre pill badges, live countdown timer (red, monospace)
- Dot indicators at bottom, auto-scroll every 5 seconds
- Smooth CSS scroll-snap on mobile
- Aspect ratio 16:9 for carousel, 2:3 for poster images
- Subtle parallax effect on scroll
- Gold border glow on active dot

`CountdownTimer` specifications:
- Displays: "X кун Y:XX:XX калды"
- Updates every second via setInterval
- Red pulsing animation when < 24 hours remaining
- Shows "Мерзімі отті" (Expired) when deadline passed

`ProjectCard` (in "all castings" list):
- Poster thumbnail left, title + genre + timer right
- Subtle hover/tap animation (scale + gold glow)

**Step 1: Fetch projects from Supabase** where status = 'active', ordered by deadline
**Step 2: Build HeroCarousel** with touch swipe support
**Step 3: Build "Саган сайкес" matching section** — filter roles by user's age+gender
**Step 4: Build "Барлык кастингтер" list**
**Step 5: Test with sample data**
**Step 6: Commit**

---

### Task 7: Project Detail page

**Files:**
- Create: `app/src/pages/ProjectDetail.jsx`
- Create: `app/src/components/RoleBlock.jsx`
- Create: `app/src/components/ApplicantAvatars.jsx`

RoleBlock shows: role title, requirements (gender, age), mini-avatars of recent applicants + count, "ТАНДАУ" button. Gold border if role matches current user. Grey + lock if closed.

Uses Supabase Realtime subscription on `applications` table for live counter updates.

**Step 1: Fetch project + roles + application counts**
**Step 2: Build role blocks with applicant avatars**
**Step 3: Implement "ТАНДАУ" (Apply) button** — inserts into applications table, shows confetti
**Step 4: Subscribe to realtime** for live counter updates
**Step 5: Commit**

---

### Task 8: Casting Test page (port existing code to React)

**Files:**
- Create: `app/src/pages/CastingTest.jsx`
- Create: `app/src/components/casting/EmotionMeter.jsx`
- Create: `app/src/components/casting/FaceCanvas.jsx`
- Create: `app/src/components/casting/TestHistory.jsx`
- Create: `app/src/components/casting/Leaderboard.jsx`

Port the logic from `casting-test.js` into React components:
- Same MediaPipe Face Landmarker setup
- Same 6 emotions, 5 per test, 6 seconds each
- Same face landmark drawing (lips, eyes, brows, face oval)
- NEW: save results to Supabase `casting_results` table
- NEW: show test history from Supabase
- NEW: show global leaderboard

**Step 1: Port MediaPipe initialization** into a custom hook `useFaceLandmarker`
**Step 2: Port emotion detection loop** into `CastingTest` page
**Step 3: Port face landmark drawing** into `FaceCanvas` component
**Step 4: Add history and leaderboard** from Supabase queries
**Step 5: Save results** to Supabase on test completion
**Step 6: Commit**

---

### Task 9: Profile page

**Files:**
- Create: `app/src/pages/Profile.jsx`
- Create: `app/src/components/profile/PhotoGallery.jsx`
- Create: `app/src/components/profile/ParamsForm.jsx`
- Create: `app/src/components/profile/ApplicationHistory.jsx`
- Create: `app/src/components/profile/VideoRecorder.jsx`

Profile shows: avatar, name, age, gender, photo portfolio, video greeting, physical params, casting test stats, application history with statuses.

VideoRecorder: port from `video-record.js` — record 2-min video, upload to Supabase Storage.

**Step 1: Build profile header** (avatar, name, age, gender)
**Step 2: Build photo gallery** with upload to Supabase Storage
**Step 3: Port video recorder** from video-record.js into React component
**Step 4: Build params editor** (height, weight, hair, eyes)
**Step 5: Build application history** with status badges
**Step 6: Commit**

---

### Task 10: Search page

**Files:**
- Create: `app/src/pages/Search.jsx`
- Create: `app/src/components/SearchFilters.jsx`

Filter castings by: genre tags, age range, gender, status.
Full-text search on project title and description.

**Step 1: Build filter UI** with genre chips, age slider, gender toggle
**Step 2: Build Supabase query** with dynamic filters
**Step 3: Display results** as ProjectCard list
**Step 4: Commit**

---

## Phase 4: AI Chat Integration

### Task 11: Port chat widget to React + redirect leads to Supabase

**Files:**
- Create: `app/src/components/ChatWidget.jsx`
- Create: `app/src/components/ChatMessage.jsx`
- Create: `app/src/hooks/useChat.js`
- Modify: `local-worker/worker.js` (change lead destination from Telegram to Supabase)

Port the floating chat widget from `app.js`:
- Same session management (/session endpoint)
- Same chat flow (/chat endpoint with Llama 4 Scout)
- Same chat history (last 20 messages)
- NEW: leads extracted by worker go to Supabase `chat_leads` table (not Telegram)
- Chat widget floats over all pages via ChatFab button

**Worker change:** In `sendTelegramLead()`, replace Telegram API call with Supabase insert:
```js
// Instead of Telegram:
const response = await fetch(`https://xxxxx.supabase.co/rest/v1/chat_leads`, {
  method: 'POST',
  headers: {
    'apikey': env.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ session_id, child_name, child_age, parent_name, phone, raw_data })
})
```

**Step 1: Create useChat hook** with session/message state
**Step 2: Build ChatWidget** with message list, input, send button
**Step 3: Build ChatMessage** component (user/bot styling)
**Step 4: Update worker** to send leads to Supabase
**Step 5: Test full chat flow**
**Step 6: Commit**

---

## Phase 5: Admin Panel

### Task 12: Admin layout and dashboard

**Files:**
- Create: `app/src/pages/admin/AdminLayout.jsx`
- Create: `app/src/pages/admin/Dashboard.jsx`
- Create: `app/src/components/admin/StatsCard.jsx`
- Create: `app/src/components/admin/RecentApplications.jsx`

Desktop-only admin panel. Sidebar navigation: Dashboard, Projects, Roles, Applications, Chat Leads, Actors.
Protected by `role_type = 'superadmin'` check.

**Step 1: Build AdminLayout** with sidebar navigation
**Step 2: Build Dashboard** with stats cards (total actors, active castings, today's applications)
**Step 3: Build RecentApplications** feed (real-time)
**Step 4: Commit**

---

### Task 13: Admin — Project CRUD

**Files:**
- Create: `app/src/pages/admin/Projects.jsx`
- Create: `app/src/pages/admin/ProjectForm.jsx`

List all projects. Create/edit form with: title, description, poster upload, genre tags, deadline picker, status.

**Step 1: Build project list** with status badges
**Step 2: Build create/edit form** with image upload to Supabase Storage
**Step 3: Test CRUD operations**
**Step 4: Commit**

---

### Task 14: Admin — Roles CRUD

**Files:**
- Create: `app/src/pages/admin/Roles.jsx`
- Create: `app/src/pages/admin/RoleForm.jsx`

Add roles to projects. Form: title, required gender, age min/max, is_open toggle.
Approve actor button (sets `approved_actor_id` and `is_open = false`).

**Step 1: Build role list** grouped by project
**Step 2: Build role form**
**Step 3: Build approve actor flow**
**Step 4: Commit**

---

### Task 15: Admin — Applications view

**Files:**
- Create: `app/src/pages/admin/Applications.jsx`
- Create: `app/src/components/admin/ApplicantCard.jsx`

View all applications per role. Each card shows: actor photo, name, age, gender, casting test score, video link, portfolio. Approve/reject buttons. Excel export.

**Step 1: Build applications list** with filtering by project/role
**Step 2: Build applicant card** with full actor info
**Step 3: Add Excel export** (CSV download)
**Step 4: Commit**

---

### Task 16: Admin — Chat Leads + Actors DB

**Files:**
- Create: `app/src/pages/admin/ChatLeads.jsx`
- Create: `app/src/pages/admin/Actors.jsx`

Chat Leads: table of all leads from AI chat (name, age, phone, date).
Actors: searchable/filterable table of all registered actors.

**Step 1: Build chat leads table**
**Step 2: Build actors database** with search and filters
**Step 3: Commit**

---

## Phase 6: PWA & Deployment

### Task 17: PWA setup

**Files:**
- Create: `app/public/manifest.json`
- Create: `app/public/sw.js`
- Create: `app/public/icons/` (app icons in multiple sizes)

**Step 1: Create manifest.json**

```json
{
  "name": "Meyram Cinema Universe",
  "short_name": "Meyram",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0e27",
  "theme_color": "#c8a264",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Step 2: Register service worker** for offline caching
**Step 3: Add install prompt** component ("Косымшаны орнату")
**Step 4: Commit**

---

### Task 18: Deploy to Cloudflare Pages

**Files:**
- Create: `app/wrangler.toml` (Pages config)

**Step 1: Build the app**

```bash
cd app && npm run build
```

**Step 2: Deploy to Cloudflare Pages**

```bash
npx wrangler pages deploy app/dist --project-name=meyram-cinema
```

**Step 3: Configure custom domain**

Cloudflare Dashboard → Pages → meyram-cinema → Custom Domains → Add `app.apolloai.biz`

**Step 4: Set environment variables** in Cloudflare Pages dashboard (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE)

**Step 5: Test production deployment**

**Step 6: Commit any config changes**

---

## Phase 7: Polish & Visual Effects

### Task 19: Star particles background

CSS/canvas subtle star particle effect on dark blue background. Stars slowly drift. Creates the "cinema universe" atmosphere.

### Task 20: Animations

- Page transitions (Framer Motion)
- Card hover effects (scale + gold glow)
- Confetti on successful application
- Countdown timer pulse when < 24h
- Skeleton loading states
- Welcome animation after onboarding

### Task 21: Final testing and polish

- Test full user flow: login → onboarding → browse → apply → casting test
- Test admin flow: create project → add roles → view applications → approve
- Test PWA install on Android/iOS
- Test AI chat integration
- Responsive testing (mobile, tablet, desktop)
- Performance audit (Lighthouse)

---

## Execution Order Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-2 | Scaffolding + Supabase |
| 2 | 3-4 | Auth + Onboarding |
| 3 | 5-10 | Core pages (Feed, Project, Casting, Profile, Search) |
| 4 | 11 | AI Chat integration |
| 5 | 12-16 | Admin panel |
| 6 | 17-18 | PWA + Deploy |
| 7 | 19-21 | Polish + Testing |

Total: ~21 tasks, estimated 3-5 sessions of focused work.
