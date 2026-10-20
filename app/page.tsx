'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AvatarPlayer,
  type SignProgress,
  type AvatarModelType,
  type ModelNotice,
} from '@/components/avatar/AvatarPlayer'
import {
  translateToGloss,
  translateOffline,
  TranslationAbortedError,
  type TranslationMode,
} from '@/lib/islTranslator'
import {
  SUPPORTED_TOKENS,
  isFingerspellToken,
} from '@/lib/islVocabulary'
import { SignFlowLogo } from '@/components/SignFlowLogo'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Hand,
  HelpCircle,
  Info,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Move3d,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Sparkles,
  Square,
  Volume2,
  X,
  Languages,
  ShieldCheck,
  Zap,
} from 'lucide-react'

type SpeechRecognitionResult = ArrayLike<{ transcript: string }> & { isFinal?: boolean }
type SpeechRecognitionConstructor = new () => {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechRecognitionResult> }) => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

const examplePhrases = [
  'Hello, how are you?',
  'Thank you',
  'I need help',
  'Where is the hospital?',
  'Nice to meet you',
  'Good morning',
  'What is your name?',
  'Please wait a minute',
  'I love you',
  'I want water',
]

const vocabularyCategories: Record<string, string[]> = {
  'Basic & Social': [
    'HELLO', 'THANK_YOU', 'PLEASE', 'SORRY', 'WELCOME', 'YES', 'NO', 'GOOD', 'BAD', 'HELP', 'STOP', 'WAIT',
  ],
  'People & Pronouns': [
    'I', 'MY', 'YOU', 'YOUR', 'PERSON', 'MAN', 'WOMAN', 'CHILD', 'BOY', 'GIRL', 'PARENT', 'FAMILY', 'FRIEND', 'MOTHER', 'FATHER', 'BROTHER', 'SISTER', 'NAME',
  ],
  'Questions': [
    'WHAT', 'WHY', 'WHEN', 'WHERE', 'WHO', 'HOW', 'WHICH', 'HOW_MUCH', 'HOW_MANY',
  ],
  'Daily Life & Health': [
    'FOOD', 'EAT', 'DRINK', 'WATER', 'SLEEP', 'TOILET', 'DOCTOR', 'HOSPITAL', 'PAIN', 'TIME', 'MONEY',
  ],
  'Actions & Verbs': [
    'COME', 'GO', 'GIVE', 'TAKE', 'WANT', 'NEED', 'LIKE', 'KNOW', 'UNDERSTAND', 'ASK', 'ANSWER', 'TELL', 'SHOW', 'LOOK', 'SEE', 'LISTEN', 'TALK', 'START', 'FINISH', 'AGAIN',
  ],
  'Places & Objects': [
    'HOME', 'HOUSE', 'ROOM', 'DOOR', 'WINDOW', 'CHAIR', 'TABLE', 'BAG', 'ROAD', 'CAR', 'BUS', 'TRAIN', 'MARKET', 'SHOP', 'CITY', 'PARK', 'OFFICE',
  ],
  'Education & Tech': [
    'SCHOOL', 'CLASS', 'TEACHER', 'STUDENT', 'BOOK', 'READ', 'WRITE', 'STUDY', 'LEARN', 'EXAM', 'QUESTION', 'COMPUTER', 'PHONE', 'MOBILE',
  ],
}

export default function SignFlowHome() {
  const [inputText, setInputText] = useState('Hello, how are you?')
  const [inputTab, setInputTab] = useState<'text' | 'voice'>('text')
  const [avatarPhrase, setAvatarPhrase] = useState('HELLO YOU HOW')
  const [activeGlossTokens, setActiveGlossTokens] = useState<string[]>(['HELLO', 'YOU', 'HOW'])
  const [avatarModel] = useState<AvatarModelType>('default')
  const [requestId, setRequestId] = useState(1)
  const [stopId, setStopId] = useState(0)
  const [resetId, setResetId] = useState(0)
  const [replayId, setReplayId] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [speed, setSpeed] = useState(1.0)
  const [avatarState, setAvatarState] = useState<'loading' | 'ready' | 'signing' | 'paused' | 'error'>('loading')
  const [currentProgress, setCurrentProgress] = useState<SignProgress>({
    currentSignIndex: -1,
    currentToken: '',
    totalTokens: 3,
    tokens: ['HELLO', 'YOU', 'HOW'],
    isFingerspelling: false,
  })

  const [isTranslating, setIsTranslating] = useState(false)
  const [translationEngine, setTranslationEngine] = useState<TranslationMode>('online')
  const [resolvedMode, setResolvedMode] = useState<TranslationMode>('offline')
  const [speechSupported, setSpeechSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [liveMode, setLiveMode] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [selectedVocabCategory, setSelectedVocabCategory] = useState('Basic & Social')

  const recognitionRef = useRef<InstanceType<SpeechRecognitionConstructor> | null>(null)
  const liveModeRef = useRef(false)
  const permissionDeniedRef = useRef(false)
  const translateAbortRef = useRef<AbortController | null>(null)
  const translationEngineRef = useRef<TranslationMode>('online')
  const liveChainRef = useRef<Promise<void>>(Promise.resolve())

  // Hybrid translation dispatcher: converts text into canonical ISL gloss tokens
  const dispatchTranslation = useCallback(async (rawText: string, options?: { append?: boolean }) => {
    const text = rawText.trim()
    if (!text) return

    // Live streaming speech path: queue with offline engine for zero lag
    if (options?.append) {
      liveChainRef.current = liveChainRef.current.catch(() => {}).then(() => {
        if (!liveModeRef.current) return
        const result = translateOffline(text)
        setResolvedMode(result.mode)
        setActiveGlossTokens((prev) => [...prev, ...result.tokens])
        setAvatarPhrase(result.glossText || text)
        setIsPaused(false)
        setRequestId((current) => current + 1)
      })
      return
    }

    translateAbortRef.current?.abort()
    translateAbortRef.current = null

    // Forced offline mode: local deterministic rule-based engine
    if (translationEngineRef.current === 'offline') {
      const result = translateOffline(text)
      setResolvedMode(result.mode)
      setActiveGlossTokens(result.tokens)
      setAvatarPhrase(result.glossText || text)
      setIsPaused(false)
      setRequestId((current) => current + 1)
      return
    }

    const controller = new AbortController()
    translateAbortRef.current = controller
    setIsTranslating(true)

    try {
      const result = await translateToGloss(text, controller.signal)
      if (controller.signal.aborted) return
      setResolvedMode(result.mode)
      setActiveGlossTokens(result.tokens)
      setAvatarPhrase(result.glossText || text)
      setIsPaused(false)
      setRequestId((current) => current + 1)
    } catch (error) {
      if (!(error instanceof TranslationAbortedError)) {
        console.warn('[SignFlow] Translation dispatch fallback:', error)
        const fallback = translateOffline(text)
        setResolvedMode('offline')
        setActiveGlossTokens(fallback.tokens)
        setAvatarPhrase(fallback.glossText || text)
        setIsPaused(false)
        setRequestId((current) => current + 1)
      }
    } finally {
      if (translateAbortRef.current === controller) {
        translateAbortRef.current = null
        setIsTranslating(false)
      }
    }
  }, [])

  const chooseTranslationEngine = (engine: TranslationMode) => {
    translationEngineRef.current = engine
    setTranslationEngine(engine)
    if (engine === 'offline') {
      translateAbortRef.current?.abort()
      translateAbortRef.current = null
      setIsTranslating(false)
    }
    setResolvedMode(engine)
  }

  // Speech Recognition Setup
  useEffect(() => {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!SpeechRecognition) return

    setSpeechSupported(true)
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-IN'

    recognition.onstart = () => {
      setIsListening(true)
      setMicError(null)
      permissionDeniedRef.current = false
    }

    recognition.onend = () => {
      setIsListening(false)
      if (liveModeRef.current && !permissionDeniedRef.current) {
        window.setTimeout(() => {
          try {
            recognition.start()
          } catch {
            // Recognizer already restarting
          }
        }, 250)
      }
    }

    recognition.onerror = (event) => {
      setIsListening(false)
      if (event.error === 'not-allowed') {
        permissionDeniedRef.current = true
        setMicError('Microphone permission was denied. Please allow microphone access in your browser.')
        setLiveMode(false)
        liveModeRef.current = false
      } else if (event.error !== 'no-speech') {
        setMicError(`Voice recognition error: ${event.error}`)
      }
    }

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i]
        const transcript = item[0]?.transcript || ''
        if (item.isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }

      if (interim) {
        setInterimText(interim)
      }

      if (final) {
        const cleanFinal = final.trim()
        setInputText(cleanFinal)
        setInterimText('')
        if (liveModeRef.current) {
          void dispatchTranslation(cleanFinal, { append: true })
        }
      }
    }

    recognitionRef.current = recognition
    return () => {
      recognition.abort()
      recognitionRef.current = null
    }
  }, [dispatchTranslation])

  const handleStartTranslate = () => {
    if (!inputText.trim()) return
    void dispatchTranslation(inputText)
  }

  const handleQuickPhrase = (phrase: string) => {
    setInputText(phrase)
    void dispatchTranslation(phrase)
  }

  const handlePlaySingleSign = (token: string) => {
    setAvatarPhrase(token)
    setIsPaused(false)
    setRequestId((c) => c + 1)
  }

  const toggleVoice = () => {
    const recognition = recognitionRef.current
    if (!recognition) return
    if (isListening) {
      recognition.stop()
      if (interimText && !liveMode) {
        setInputText(interimText)
        void dispatchTranslation(interimText)
        setInterimText('')
      }
    } else {
      setMicError(null)
      try {
        recognition.start()
      } catch (err) {
        console.error('Recognition start error:', err)
      }
    }
  }

  const toggleLive = () => {
    const next = !liveMode
    liveModeRef.current = next
    setLiveMode(next)
    const recognition = recognitionRef.current
    if (!recognition) return
    if (next && !isListening) {
      try {
        recognition.start()
      } catch {}
    } else if (!next && isListening) {
      recognition.stop()
    }
  }

  const handleStop = () => {
    liveModeRef.current = false
    setLiveMode(false)
    if (isListening) recognitionRef.current?.stop()
    setIsPaused(false)
    setStopId((c) => c + 1)
  }

  const handleReset = () => {
    setIsPaused(false)
    setResetId((c) => c + 1)
  }

  const handleReplay = () => {
    setIsPaused(false)
    setReplayId((c) => c + 1)
  }

  const togglePauseResume = () => {
    if (avatarState === 'signing') {
      setIsPaused(true)
    } else if (avatarState === 'paused') {
      setIsPaused(false)
    } else {
      handleReplay()
    }
  }

  const handleProgress = (progress: SignProgress) => {
    setCurrentProgress(progress)
  }

  return (
    <div className="app-shell">
      {/* Top Navigation */}
      <header className="topbar" role="banner">
        <a href="#top" className="brand-wrapper" aria-label="SignFlow Home">
          <SignFlowLogo size={38} />
          <div className="brand-titles">
            <span className="brand-name">
              SIGN<span>FLOW</span>
            </span>
            <span className="brand-subtitle">Indian Sign Language, made accessible.</span>
          </div>
        </a>

        <nav className="nav-links" aria-label="Main Navigation">
          <a href="#translate" className="nav-link">
            Translate
          </a>
          <a href="#how-it-works" className="nav-link">
            How it works
          </a>
          <a href="#vocabulary" className="nav-link">
            Vocabulary
          </a>
          <a href="#about" className="nav-link">
            About ISL
          </a>
        </nav>

        <div className="nav-status-badge" title="Translation engine connection state">
          <span className="status-dot" />
          <span>
            {isTranslating
              ? 'Translating…'
              : translationEngine === 'offline'
              ? 'Offline Engine'
              : resolvedMode === 'online'
              ? 'AI Engine Online'
              : 'Local Fallback'}
          </span>
        </div>
      </header>

      {/* Hero Intro */}
      <section className="hero-header" id="top">
        <div className="hero-pill">
          <Sparkles size={14} /> Speak. Sign. Flow.
        </div>
        <h1 className="hero-title">Turn your words into signs.</h1>
        <p className="hero-subtitle">
          Translate typed or spoken English into grammatically validated Indian Sign Language (ISL) gloss and watch the
          3D humanoid avatar perform the signs in real time.
        </p>
      </section>

      {/* Main Two-Panel Translator Workspace */}
      <main className="translator-workspace" id="translate">
        {/* Left Panel: Input & Settings */}
        <section className="input-panel" aria-label="Input and Translation Options">
          <div className="panel-header">
            <div className="panel-title-group">
              <h2>Input Sentence</h2>
              <p>Type English text or speak via microphone</p>
            </div>
            <div className="segmented-control" role="tablist" aria-label="Input method">
              <button
                type="button"
                role="tab"
                aria-selected={inputTab === 'text'}
                className={`segment-btn ${inputTab === 'text' ? 'active' : ''}`}
                onClick={() => setInputTab('text')}
              >
                Text
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inputTab === 'voice'}
                className={`segment-btn ${inputTab === 'voice' ? 'active' : ''}`}
                onClick={() => setInputTab('voice')}
              >
                <Mic size={13} /> Voice
              </button>
            </div>
          </div>

          {inputTab === 'text' ? (
            <div className="text-input-wrapper">
              <textarea
                className="input-textarea"
                value={inputText}
                maxLength={600}
                placeholder="Type a sentence in English (e.g., 'Hello, how are you? I need help' or 'Where is the school?')..."
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleStartTranslate()
                  }
                }}
                aria-label="Text to translate into Indian Sign Language"
              />
              <div className="textarea-footer">
                <span>{inputText.length} / 600 characters</span>
                {inputText.length > 0 && (
                  <button type="button" className="clear-btn" onClick={() => setInputText('')}>
                    Clear text
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="voice-area-card">
              <button
                type="button"
                className={`mic-action-btn ${isListening ? 'listening' : ''}`}
                onClick={toggleVoice}
                disabled={!speechSupported}
                aria-label={isListening ? 'Stop listening' : 'Start speaking'}
                title={speechSupported ? 'Click to toggle microphone' : 'Voice recognition not supported in this browser'}
              >
                {isListening ? <MicOff size={26} /> : <Mic size={26} />}
              </button>
              <span className="voice-status-text">
                {!speechSupported
                  ? 'Speech recognition is not supported in this browser. Please use Chrome or Edge.'
                  : isListening
                  ? 'Listening to speech in English (IN)...'
                  : 'Click the microphone to start speaking'}
              </span>
              <p className="voice-interim-text">{interimText ? `“${interimText}”` : ''}</p>
              {micError && <p className="clear-btn" style={{ color: '#E53E3E' }}>{micError}</p>}
            </div>
          )}

          {/* Engine Selector and Live Mode */}
          <div className="engine-bar">
            <div className="engine-pills" role="group" aria-label="Translation Engine">
              <button
                type="button"
                className={`engine-pill ${translationEngine === 'online' ? 'selected' : ''}`}
                onClick={() => chooseTranslationEngine('online')}
                title="Google Gemini AI online model for contextual ISL grammar"
              >
                <Sparkles size={11} /> AI Engine
              </button>
              <button
                type="button"
                className={`engine-pill ${translationEngine === 'offline' ? 'selected' : ''}`}
                onClick={() => chooseTranslationEngine('offline')}
                title="Built-in rule-based offline engine (instant, zero internet required)"
              >
                <Zap size={11} /> Offline
              </button>
            </div>

            <button
              type="button"
              className={`live-toggle-btn ${liveMode ? 'active' : ''}`}
              onClick={toggleLive}
              disabled={!speechSupported}
              title="Continuously convert spoken sentences into signs"
            >
              <span className="status-dot" style={{ width: 6, height: 6 }} />
              Live Mode
            </button>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            className="translate-cta-btn"
            onClick={handleStartTranslate}
            disabled={isTranslating || !inputText.trim()}
          >
            {isTranslating ? (
              <>
                <Sparkles size={16} className="animate-spin" /> Translating to ISL...
              </>
            ) : (
              <>
                Translate &amp; Sign <ArrowRight size={17} />
              </>
            )}
          </button>

          {/* Example Phrase Chips */}
          <div className="examples-section">
            <span className="examples-label">Try example phrases</span>
            <div className="example-chips-wrap">
              {examplePhrases.map((phrase) => (
                <button
                  type="button"
                  key={phrase}
                  className="example-chip"
                  onClick={() => handleQuickPhrase(phrase)}
                >
                  {phrase}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right Panel: Interactive 3D Avatar Workspace */}
        <section
          className={`avatar-panel ${isMaximized ? 'is-maximized' : ''}`}
          aria-label="3D Avatar Signing Stage"
        >
          {/* Avatar Toolbar */}
          <div className="avatar-toolbar">
            <div className="avatar-title-badge" title="Classic 3D Humanoid Avatar (Y-Bot)">
              <span>🦾</span>
              <span>Classic Avatar</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className={`avatar-status-pill ${avatarState}`}>
                <span className="status-dot" style={{ width: 6, height: 6 }} />
                {avatarState === 'signing'
                  ? 'Signing'
                  : avatarState === 'paused'
                  ? 'Paused'
                  : avatarState === 'loading'
                  ? 'Loading'
                  : 'Ready'}
              </span>

              <button
                type="button"
                className="ctrl-btn"
                style={{ width: 32, height: 32 }}
                onClick={() => setIsMaximized((prev) => !prev)}
                title={isMaximized ? 'Restore View' : 'Maximize Avatar'}
                aria-label={isMaximized ? 'Restore View' : 'Maximize Avatar'}
              >
                {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            </div>
          </div>

          {/* 3D Canvas Viewport */}
          <div className="avatar-viewport-container">
            <AvatarPlayer
              phrase={avatarPhrase}
              requestId={requestId}
              model={avatarModel}
              appendToQueue={liveMode}
              stopId={stopId}
              resetId={resetId}
              replayId={replayId}
              isPaused={isPaused}
              speed={speed}
              onStateChange={setAvatarState}
              onProgress={handleProgress}
            />

            {/* Live Sign Badge Overlay */}
            {avatarState === 'signing' && currentProgress.currentToken && (
              <div className="current-sign-overlay">
                <span>
                  {currentProgress.isFingerspelling ? 'Fingerspelling' : 'Signing'}:
                </span>
                <strong>
                  {currentProgress.isFingerspelling && currentProgress.letter
                    ? `${currentProgress.currentToken} (${currentProgress.letter})`
                    : currentProgress.currentToken}
                </strong>
                {currentProgress.totalTokens > 0 && currentProgress.currentSignIndex >= 0 && (
                  <span className="current-sign-badge">
                    {currentProgress.currentSignIndex + 1} of {currentProgress.totalTokens}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Controls Bar */}
          <div className="avatar-controls-bar">
            <div className="control-buttons-group">
              <button
                type="button"
                className="ctrl-btn primary"
                onClick={togglePauseResume}
                title={
                  avatarState === 'signing'
                    ? 'Pause signing'
                    : avatarState === 'paused'
                    ? 'Resume signing'
                    : 'Replay signs'
                }
                aria-label={
                  avatarState === 'signing'
                    ? 'Pause signing'
                    : avatarState === 'paused'
                    ? 'Resume signing'
                    : 'Replay signs'
                }
              >
                {avatarState === 'signing' ? (
                  <Pause size={17} />
                ) : (
                  <Play size={17} style={{ marginLeft: 2 }} />
                )}
              </button>

              <button
                type="button"
                className="ctrl-btn"
                onClick={handleStop}
                title="Stop and return to rest pose"
                aria-label="Stop playback"
              >
                <Square size={15} fill="currentColor" />
              </button>

              <button
                type="button"
                className="ctrl-btn"
                onClick={handleReset}
                title="Reset avatar bones immediately"
                aria-label="Reset avatar"
              >
                <RotateCcw size={15} />
              </button>

              <button
                type="button"
                className="ctrl-btn"
                onClick={handleReplay}
                title="Replay entire sequence from start"
                aria-label="Replay sequence"
              >
                <RotateCw size={15} />
              </button>
            </div>

            {/* Playback Speed Control */}
            <div className="speed-control-wrap">
              <span>Speed</span>
              <div className="speed-chips" role="group" aria-label="Playback Speed">
                {[0.75, 1.0, 1.25, 1.5].map((rate) => (
                  <button
                    type="button"
                    key={rate}
                    className={`speed-chip-btn ${speed === rate ? 'active' : ''}`}
                    onClick={() => setSpeed(rate)}
                  >
                    {rate}×
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Gloss and Playback Timeline */}
      <section className="gloss-timeline-card" aria-label="ISL Gloss Sequence Timeline">
        <div className="timeline-header">
          <div>
            <h3>Generated ISL Gloss Sequence</h3>
            <p>Tokens ordered by natural Indian Sign Language grammar. Click any chip to replay its sign.</p>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--secondary-text)' }}>
            {activeGlossTokens.length} {activeGlossTokens.length === 1 ? 'sign' : 'signs'}
          </span>
        </div>

        <div className="gloss-chips-track">
          {activeGlossTokens.length > 0 ? (
            activeGlossTokens.map((token, index) => {
              const isActive = currentProgress.currentSignIndex === index
              const isCompleted =
                currentProgress.currentSignIndex > index ||
                (avatarState === 'ready' && currentProgress.currentSignIndex === -1 && index >= 0)
              const isSpell = isFingerspellToken(token)

              return (
                <button
                  type="button"
                  key={`${token}-${index}`}
                  className={`gloss-token-chip ${isActive ? 'active' : ''} ${
                    isCompleted && !isActive ? 'completed' : ''
                  }`}
                  onClick={() => handlePlaySingleSign(token)}
                  title={`Click to replay ${token}`}
                >
                  {isCompleted && !isActive && <Check size={13} strokeWidth={2.5} />}
                  <span>{token}</span>
                  <span className="token-tag">{isSpell ? 'SPELL' : 'SIGN'}</span>
                </button>
              )
            })
          ) : (
            <p className="empty-timeline-hint">No gloss sequence yet. Enter a sentence above to generate signs.</p>
          )}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section" id="how-it-works">
        <div className="section-title-wrap">
          <span className="section-eyebrow">How It Works</span>
          <h2 className="section-heading">From your voice to expressive signs</h2>
        </div>

        <div className="steps-grid">
          <article className="step-card">
            <span className="step-number">STEP 01</span>
            <div className="step-icon-box">
              <Mic size={24} />
            </div>
            <h3 className="step-title">Express in Words</h3>
            <p className="step-desc">
              Type naturally in English or speak aloud into your browser microphone with real-time speech recognition.
            </p>
          </article>

          <article className="step-card">
            <span className="step-number">STEP 02</span>
            <div className="step-icon-box">
              <Languages size={24} />
            </div>
            <h3 className="step-title">ISL Grammar Pipeline</h3>
            <p className="step-desc">
              The NLP engine restructures the sentence into ISL SOV syntax, extracts temporal markers, and resolves tokens to
              verified ISL vocabulary.
            </p>
          </article>

          <article className="step-card">
            <span className="step-number">STEP 03</span>
            <div className="step-icon-box">
              <Move3d size={24} />
            </div>
            <h3 className="step-title">Coordinated 3D Signing</h3>
            <p className="step-desc">
              The humanoid avatar animates coordinated arm rotations, wrist orientations, finger articulations, and A–Z
              fingerspelling in real time.
            </p>
          </article>
        </div>
      </section>

      {/* Vocabulary Explorer Section */}
      <section className="vocab-section" id="vocabulary">
        <div className="section-title-wrap">
          <span className="section-eyebrow">Vocabulary Library</span>
          <h2 className="section-heading">Explore 140+ Supported Signs</h2>
        </div>

        <div className="vocab-card">
          <div className="vocab-filter-pills" role="tablist" aria-label="Vocabulary Categories">
            {Object.keys(vocabularyCategories).map((category) => (
              <button
                type="button"
                key={category}
                className={`vocab-filter-btn ${selectedVocabCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedVocabCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="vocab-words-grid">
            {vocabularyCategories[selectedVocabCategory]?.map((word) => (
              <button
                type="button"
                key={word}
                className="word-play-badge"
                onClick={() => handlePlaySingleSign(word)}
                title={`Click to watch ${word} signed on the 3D avatar`}
              >
                {word}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Trust, Accessibility & Linguistic Integrity */}
      <section className="trust-banner-card" id="about">
        <div className="trust-icon-box">
          <ShieldCheck size={26} />
        </div>
        <div className="trust-content">
          <h4>Linguistic Integrity &amp; Transparency</h4>
          <p>
            Indian Sign Language (ISL) is a complete, natural language with its own rich syntax, morphology, non-manual
            markers (facial expressions, head movements), and spatial references. SignFlow provides visual, educational gloss
            demonstrations using 3D skeletal animations and A–Z fingerspelling fallback for names and unsupported vocabulary.
            For certified legal, medical, or official interpretation, always engage qualified Deaf interpreters.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="app-footer" role="contentinfo">
        <div className="footer-left">
          <SignFlowLogo size={26} />
          <span className="footer-brand" style={{ display: 'inline-flex', alignItems: 'center' }}>
            SIGN<span style={{ color: 'var(--fresh-green, #24A875)' }}>FLOW</span>
          </span>
          <span>— Speak. Sign. Flow.</span>
        </div>
        <div>
          <span>Next.js · Three.js · React Three Fiber · Google Gemini · Indian Sign Language</span>
        </div>
        <div>
          <span>&copy; {new Date().getFullYear()} SignFlow</span>
        </div>
      </footer>
    </div>
  )
}
