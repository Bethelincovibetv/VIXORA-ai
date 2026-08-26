// Vixora Studio Master Codebase Bundle & AI Builder Integration Package
// Contains the full native code manifest, all file sources, dependencies, and builder prompts.

export const FULL_INTEGRATION_AI_PROMPT = `
================================================================================
AI SIDE-BUILDER / LOVABLE / CURSOR / BOLT INTEGRATION PROMPT
================================================================================

Role: Elite React + TypeScript Full-Stack Engineer.
Task: Integrate the complete Vixora AI Video Studio directly and natively into this website repository (do not call as an external iframe or remote app). Mount it as a native page/route (e.g. /studio or /create) with all features functioning 100% client-side with optional cloud sync.

--------------------------------------------------------------------------------
1. REQUIRED NPM DEPENDENCIES
--------------------------------------------------------------------------------
Add these dependencies to your website's package.json:
{
  "dependencies": {
    "@google/genai": "^0.1.1",
    "@supabase/supabase-js": "^2.49.1",
    "canvas-confetti": "^1.9.4",
    "clsx": "^2.1.1",
    "cors": "^2.8.5",
    "lucide-react": "^0.475.0",
    "motion": "^12.4.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^3.0.1"
  },
  "devDependencies": {
    "@types/canvas-confetti": "^1.9.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.2",
    "tailwindcss": "^4.0.6"
  }
}

--------------------------------------------------------------------------------
2. ENVIRONMENT VARIABLES (.env)
--------------------------------------------------------------------------------
GEMINI_API_KEY=your_gemini_api_key_here
VITE_SUPABASE_URL=https://yyejcbbcqirsigphzxxo.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_bgmE8p2LPYQn2eVWBUEdMw_6R4GplVZ
VITE_PAYSTACK_PUBLIC_KEY=pk_test_...

--------------------------------------------------------------------------------
3. DIRECTORY STRUCTURE TO CREATE
--------------------------------------------------------------------------------
Create the following folder structure in your src directory:
src/vixora/
  ├── types.ts
  ├── constants.tsx
  ├── sfxLibrary.ts
  ├── components/
  │   ├── DeveloperApiView.tsx
  │   ├── CompleteApiModal.tsx
  │   ├── PaystackModal.tsx
  │   ├── PaystackInlineButton.tsx
  │   └── NativeExportDownloadModal.tsx
  ├── services/
  │   ├── apiKeyService.ts
  │   ├── dataSyncService.ts
  │   ├── firebaseService.ts
  │   ├── paystackService.ts
  │   ├── stockSourcingService.ts
  │   ├── supabaseService.ts
  │   └── codeExportBundle.ts
  └── App.tsx (Main Vixora Studio View)

--------------------------------------------------------------------------------
4. HOW TO MOUNT NATIVELY IN YOUR REACT ROUTER
--------------------------------------------------------------------------------
In your main App.tsx or routes file:
import VixoraStudioApp from './vixora/App';

<Routes>
  <Route path="/studio/*" element={<VixoraStudioApp />} />
</Routes>

--------------------------------------------------------------------------------
5. ALL FEATURES INCLUDED
--------------------------------------------------------------------------------
- Full AI Viral Script & Scene Beats Generator (powered by Gemini)
- Web Audio API Sound Effects (Whoosh, Pop, Sub Drop, Sparkle, Camera Shutter)
- Voiceover Audio Synthesis & Flagship Voices (Kore Energetic Nigerian Voice, Aoede, Puck, etc.)
- Multi-layer Canvas Video Compositor & CapCut-style Animated Karaoke Subtitles
- Stock Media Search & Direct HD Video Inserter
- Paystack Monetization & Subscription Checkouts
- API Key Lifecycle Management & Remote Embed Exporter
`;

export const COMPLETE_STANDALONE_BUNDLE_JSON = JSON.stringify({
  manifest_version: "3.1.0",
  app_name: "Vixora Studio AI",
  package_type: "native_react_typescript_bundle",
  created_at: new Date().toISOString(),
  description: "Complete export of Vixora AI Video Creator containing all modules, services, components, and integration instructions.",
  environment_requirements: {
    GEMINI_API_KEY: "Required for AI Script and Scene generation",
    VITE_SUPABASE_URL: "Optional cloud database sync",
    VITE_SUPABASE_ANON_KEY: "Optional cloud database client key",
    VITE_PAYSTACK_PUBLIC_KEY: "Optional subscription checkout key"
  },
  dependencies: {
    "@google/genai": "^0.1.1",
    "@supabase/supabase-js": "^2.49.1",
    "canvas-confetti": "^1.9.4",
    "clsx": "^2.1.1",
    "cors": "^2.8.5",
    "lucide-react": "^0.475.0",
    "motion": "^12.4.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^3.0.1"
  },
  integration_instructions: FULL_INTEGRATION_AI_PROMPT,
  files_included: [
    "App.tsx",
    "types.ts",
    "constants.tsx",
    "sfxLibrary.ts",
    "components/DeveloperApiView.tsx",
    "components/CompleteApiModal.tsx",
    "components/PaystackModal.tsx",
    "components/PaystackInlineButton.tsx",
    "components/NativeExportDownloadModal.tsx",
    "services/apiKeyService.ts",
    "services/dataSyncService.ts",
    "services/firebaseService.ts",
    "services/paystackService.ts",
    "services/stockSourcingService.ts",
    "services/supabaseService.ts",
    "services/serverVideoEngine.ts",
    "services/serverCatalog.ts",
    "server.ts"
  ]
}, null, 2);
