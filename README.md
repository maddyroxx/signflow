# SIGNFLOW — Speak. Sign. Flow.

**Indian Sign Language, made accessible.**

SignFlow is a full-stack, accessible web application that translates typed or spoken English into validated Indian Sign Language (ISL) gloss sequences and animates a coordinated 3D humanoid avatar to perform the signs in real time.

---

## Key Features

1. **Dual Input Methods (Text & Voice)**:
   - Type conversational English sentences with instant translation and character counter.
   - Speak naturally through your microphone using the browser's Web Speech API with live interim speech preview and continuous Live Mode.

2. **Hybrid Translation Pipeline**:
   - **AI Engine (Online)**: Server-side Google Gemini 2.5 Flash (`app/api/translate-isl`) translating English into grammatically structured ISL gloss (Temporal markers first, SOV order, question words and negations at clause ends).
   - **Deterministic NLP Engine (Offline)**: Built-in rule-based converter (`lib/islTranslator.ts`, `components/avatar/textToGloss.js`) with lemmatization, contraction expansion, and idiom mapping that works 100% offline without API keys or internet connection.
   - **Vocabulary Validation**: Sanitizes all tokens against supported vocabulary and automatically expands unsupported terms and names into A–Z fingerspelling.

3. **Coordinated 3D Humanoid Avatar**:
   - **Turquoise Robot Rig**: Signature turquoise humanoid aesthetic featuring sleek teal/cyan armor accents, clean titanium pearl plating, and illuminated visor/core accents.
   - **Stylized Human Rig**: Procedural facial features (eyes, eyebrows, nose, mouth, hair) layered on the skeletal rig.
   - **Classic Rig**: Unmodified neutral humanoid robot.
   - **Full Upper-Body Articulation**: Coordinated movement of neck, shoulders, upper arms, forearms, wrists, and individual 5-finger joints for both left and right hands.
   - **Playback Controls**: Play, Pause (freezes avatar mid-pose), Resume, Stop (eases smoothly to rest), Instant Reset, Replay, and adjustable Speed (0.75×, 1.0×, 1.25×, 1.5×).

4. **Real-Time Interactive Gloss Timeline**:
   - Displays generated ISL gloss sequence as interactive chips.
   - Highlights the currently active sign in real time.
   - Visually distinguishes completed signs, upcoming signs, whole-word signs, and A–Z fingerspelling tokens.
   - Replay individual signs simply by clicking on any chip in the sequence.

5. **Linguistic Integrity & Transparency**:
   - 140+ fully articulated whole-word ISL signs across Social, Family, Medical, Questions, Actions, and Places.
   - A–Z Indian Sign Language fingerspelling fallback.
   - Transparent educational guidance regarding ISL as an independent, rich natural language.

6. **Refined Design System (Light Theme Only)**:
   - Primary purple: `#6C4CE8`
   - Deep purple: `#4B35A8`
   - Fresh green: `#24A875`
   - Soft green: `#E8F7EF`
   - Page background: `#F8F9FC`
   - Main text: `#202238`, Secondary text: `#72758A`, Borders: `#E8E9F1`.

---

## Architecture & Data Flow

```
[ User Input: Speech (Web Speech API) or Typed Text ]
                    │
                    ▼
[ Hybrid Translation Layer ]
    ├── Online: POST /api/translate-isl (Google Gemini 2.5 Flash + Grammar Rules)
    └── Offline Fallback: textToGloss.js (Deterministic NLP, SOV ordering, Idiom Dictionary)
                    │
                    ▼
[ Token Sanitizer & Validator (lib/islVocabulary.ts) ]
    ├── Supported Tokens -> Direct Word Sign Animation
    └── Unknown Words/Names -> A-Z Fingerspelling Sequence
                    │
                    ▼
[ 3D Animation Sequence Controller (AvatarPlayer.tsx) ]
    ├── Token Progress Dispatcher -> Synchronized UI Gloss Timeline
    ├── Multi-bone Ease & Keyframe Controller (speed-scaled interpolation)
    └── Three.js WebGL SkinnedMesh Renderer (Turquoise Robot / Human / Classic)
```

---

## Getting Started

### Prerequisites

- Node.js 18+ (tested on Node.js 24)
- npm or pnpm

### Installation

```bash
# Clone or navigate to the project directory
cd yap-render-main

# Install dependencies
npm install
```

### Environment Variables (Optional)

The application works completely offline out of the box using its built-in rule-based ISL engine.

To enable online AI translation via Google Gemini:

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   *(Obtain a free key at [Google AI Studio](https://aistudio.google.com/apikey))*

### Running Locally

```bash
# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
# Compile and build production bundle
npm run build

# Start production server
npm start
```

### Running Automated Tests

```bash
# Run unit tests for ISL vocabulary, NLP pipeline, and animation mappings
npm test
```

---

## Project Structure

```
├── app/
│   ├── api/translate-isl/route.ts  # Next.js API route for Gemini ISL translation
│   ├── globals.css                 # SignFlow light-theme design system tokens & layout
│   ├── layout.tsx                  # Root HTML metadata and font configuration
│   └── page.tsx                    # Main SignFlow two-panel application
├── components/
│   ├── SignFlowLogo.tsx            # Custom SignFlow logo & branding mark
│   ├── avatar/
│   │   ├── AvatarPlayer.tsx        # Three.js 3D character animation runtime & controls
│   │   ├── humanLayer.ts           # Procedural human face layer for YBot rig
│   │   ├── textToGloss.js          # Deterministic ISL NLP rule engine & lemmatizer
│   │   ├── glossDictionary.js      # ISL gloss term & noun dictionaries
│   │   └── animations/
│   │       ├── words.js            # 140+ ISL whole-word sign exports
│   │       ├── alphabets.js        # A–Z ISL fingerspelling exports
│   │       ├── defaultPose.js      # Rest / neutral avatar pose
│   │       ├── Alphabets/          # Individual A–Z animation instruction modules
│   │       └── Words/              # Categorized sign instruction modules
├── lib/
│   ├── islTranslator.ts            # Client-side hybrid translation bridge
│   ├── islVocabulary.ts            # Canonical supported vocabulary & sanitization
│   └── utils.ts                    # CSS utility helpers
├── public/
│   └── models/
│       ├── ybot.glb                # Adobe Mixamo Y-Bot 3D skeletal mesh
│       └── ATTRIBUTION.md          # 3D model licensing and attribution
└── tests/
    └── islPipeline.test.mjs        # Automated unit tests
```

---

## Linguistic Integrity & Limitations

- **Natural Language Reality**: Indian Sign Language (ISL) is a rich, autonomous natural language featuring distinct morphology, non-manual facial cues, head shifts, and 3D spatial referencing.
- **Scope & Purpose**: SignFlow provides educational, visual gloss demonstrations using 3D skeletal animation. It is intended for bridging communication and learning, not for certified medical, courtroom, or legal translation.
- **Unsupported Vocabulary**: Unsupported terms or names automatically fall back to A–Z fingerspelling to ensure accurate communication without fabricating inaccurate signs.

---

## Attribution & Licenses

- 3D Avatar rig (`ybot.glb`) is from Adobe Mixamo (free for commercial and non-commercial use). See `public/models/ATTRIBUTION.md`.
- Original base project created by Mitarth Pathak, Navneet Singh, Gaurav Soni, Deep Panchal, and Nooren Qureshi.
- Transformed and upgraded into **SignFlow** with coordinated 3D avatar signing, light-theme design system, real-time timeline synchronization, and hybrid offline/online translation.
