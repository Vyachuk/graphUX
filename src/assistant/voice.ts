// Голос (ADR-0018): «Гей, граф» → команда → відповідь голосом → кілька секунд слухаємо продовження.
// Web Speech API: SpeechRecognition (uk-UA) + speechSynthesis. Без бекенду; у Firefox розпізнавання немає.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { commandFrom, findWake, type Heard } from './wake';

export { detectWake } from './wake';

/** Команду вважаємо завершеною після такої паузи, мс (лише коли вже щось сказано). */
export const SILENCE_MS = 1300;
/** Диктування коментаря: людина думає посеред речення — пауза довша (ADR-0020), мс. */
export const DICTATION_SILENCE_MS = 2600;
/** Після запитання «Що написати?» стільки чекаємо на текст коментаря, мс. */
export const DICTATION_WAIT_MS = 15000;
/** Після «Гей, граф» стільки чекаємо на саму команду — люди роблять паузу, мс. */
export const COMMAND_WAIT_MS = 7000;
/** Після відповіді стільки слухаємо продовження без ключового слова, мс. */
export const FOLLOWUP_MS = 7000;
/** Скільки варіантів розпізнавання просимо в браузера. */
const ALTERNATIVES = 5;
/** `?voicedebug` у URL — друкувати в консоль усе, що чує розпізнавання. */
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('voicedebug');

// ------------------------------------------------------------------ Web Speech

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type RecCtor = new () => Rec;

const recognitionCtor = (): RecCtor | null => {
  const w = globalThis as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Короткий сигнал «почув». */
function chime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
    osc.onended = () => ctx.close();
  } catch {
    // без звуку
  }
}

/** Озвучує відповідь українською; завершується, коли голос договорив. */
function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    const synth = globalThis.speechSynthesis;
    if (!synth || !text) return resolve();
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[«»]/g, ''));
    u.lang = 'uk-UA';
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('uk'));
    if (voice) u.voice = voice;
    u.rate = 1.05;
    const done = () => resolve();
    u.onend = done;
    u.onerror = done;
    // Страховка: деякі браузери не шлють onend.
    setTimeout(done, 1500 + text.length * 90);
    synth.speak(u);
  });
}

/**
 * off — вимкнено; wake — чекаю «гей граф»; listening — слухаю команду; thinking — асистент думає;
 * speaking — відповідаю голосом; followup — слухаю продовження без ключового слова.
 */
export type VoiceMode = 'off' | 'wake' | 'listening' | 'thinking' | 'speaking' | 'followup';

export type VoiceControl = {
  supported: boolean;
  mode: VoiceMode;
  /** Що чую зараз (для показу наживо). */
  heard: string;
  error: string | null;
  toggle: () => void;
  /** Перервати відповідь голосом. */
  stopSpeaking: () => void;
};

/** Звідки команда: після «Гей, граф» (нова команда) чи продовження без ключового слова. */
export type CommandMeta = { woke: boolean };

export function useVoice(
  onCommand: (text: string, meta: CommandMeta) => Promise<string>,
  opts: { dictating?: () => boolean; onIdle?: () => void } = {},
): VoiceControl {
  const wokeRef = useRef(false);
  // Нова команда після «Гей, граф» — не диктування, навіть якщо асистент ще чекав текст.
  const dictating = () => (opts.dictating?.() ?? false) && !wokeRef.current;
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const Ctor = useMemo(recognitionCtor, []);
  const [mode, setModeState] = useState<VoiceMode>('off');
  const [heard, setHeard] = useState('');
  const [error, setError] = useState<string | null>(null);

  const modeRef = useRef<VoiceMode>('off');
  const recRef = useRef<Rec | null>(null);
  const bufferRef = useRef('');
  const startIdx = useRef(0);
  const silence = useRef<ReturnType<typeof setTimeout>>();
  const waiting = useRef<ReturnType<typeof setTimeout>>();
  const restart = useRef<ReturnType<typeof setTimeout>>();
  const commandRef = useRef(onCommand);
  commandRef.current = onCommand;

  const setMode = (m: VoiceMode) => {
    modeRef.current = m;
    setModeState(m);
  };
  const listeningModes: VoiceMode[] = ['wake', 'listening', 'followup'];
  const shouldListen = () => listeningModes.includes(modeRef.current);

  /** Повертаємось до очікування «Гей, граф». */
  const backToWake = () => {
    clearTimeout(silence.current);
    clearTimeout(waiting.current);
    bufferRef.current = '';
    setHeard('');
    setMode('wake');
  };

  /** Чекаємо команду: якщо за `ms` нічого не сказано — назад до очікування ключового слова. */
  const awaitCommand = (ms: number) => {
    clearTimeout(waiting.current);
    waiting.current = setTimeout(() => {
      if (!bufferRef.current && (modeRef.current === 'listening' || modeRef.current === 'followup')) {
        backToWake();
        // Розмова затихла: те, чого чекав асистент (текст коментаря), вже не прийде.
        optsRef.current.onIdle?.();
      }
    }, ms);
  };

  const startRec = useCallback(() => {
    clearTimeout(restart.current);
    if (!Ctor || recRef.current || !shouldListen()) return;
    const rec = new Ctor();
    rec.lang = 'uk-UA';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = ALTERNATIVES;
    recRef.current = rec;

    rec.onresult = (e) => {
      const m = modeRef.current;
      if (!listeningModes.includes(m)) return;
      const results: Heard = Array.from(e.results).map((r) => Array.from(r).map((a) => a.transcript));
      if (DEBUG) console.info('[voice]', m, JSON.stringify(results.at(-1)));

      if (m === 'wake') {
        const at = findWake(results);
        if (at === null) {
          // Показуємо, що чуємо, — видно, чи розпізнавання взагалі працює і якою мовою.
          setHeard(results.at(-1)?.[0] ?? '');
          return;
        }
        chime();
        wokeRef.current = true;
        startIdx.current = at;
        setMode('listening');
        awaitCommand(COMMAND_WAIT_MS);
      } else if (m === 'followup') {
        wokeRef.current = false;
        startIdx.current = results.length - 1;
        setMode('listening');
      }

      bufferRef.current = commandFrom(results, startIdx.current);
      setHeard(bufferRef.current);
      clearTimeout(silence.current);
      // Лише «Гей, граф» без команди — не відправляємо, чекаємо (людина робить паузу).
      if (bufferRef.current) silence.current = setTimeout(() => void submit(), dictating() ? DICTATION_SILENCE_MS : SILENCE_MS);
    };
    rec.onerror = (e) => {
      if (DEBUG) console.info('[voice] error', e.error);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Немає доступу до мікрофона — дозволь його в налаштуваннях сайту.');
        stop();
      } else if (e.error === 'audio-capture') {
        setError('Мікрофон не знайдено.');
        stop();
      } else if (e.error === 'network') {
        setError('Немає звʼязку із сервісом розпізнавання — пробую ще.');
      }
      // no-speech / aborted — звичайні: Chrome закриває сесію, onend її перезапустить.
    };
    // Chrome сам закриває сесію після тиші чи за хвилину — перезапускаємо з невеликою паузою,
    // інакше миттєвий start() інколи кидає помилку і слухання тихо зупиняється.
    rec.onend = () => {
      recRef.current = null;
      if (shouldListen()) restart.current = setTimeout(startRec, 250);
    };
    try {
      rec.start();
      setError((err) => (err?.startsWith('Немає звʼязку') ? null : err));
    } catch {
      recRef.current = null;
      if (shouldListen()) restart.current = setTimeout(startRec, 1000);
    }
  }, [Ctor]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopRec = () => {
    clearTimeout(restart.current);
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onend = null;
      rec.abort();
    }
  };

  // Функція, а не порівняння на місці: TS звужує тип modeRef.current і не бачить змін між await.
  const isOff = () => modeRef.current === 'off';

  const submit = async () => {
    const text = bufferRef.current;
    bufferRef.current = '';
    clearTimeout(waiting.current);
    if (!text) return backToWake();
    // Поки думаємо й говоримо, мікрофон вимкнено — щоб не почути самих себе.
    setMode('thinking');
    stopRec();
    const reply = await commandRef.current(text, { woke: wokeRef.current });
    if (isOff()) return;
    setMode('speaking');
    await speak(reply);
    if (isOff()) return;
    setHeard('');
    setMode('followup');
    startRec();
    awaitCommand(dictating() ? DICTATION_WAIT_MS : FOLLOWUP_MS);
  };

  const stop = () => {
    clearTimeout(silence.current);
    clearTimeout(waiting.current);
    setMode('off');
    setHeard('');
    stopRec();
    globalThis.speechSynthesis?.cancel();
  };

  const toggle = () => {
    if (!Ctor) return;
    if (modeRef.current === 'off') {
      setError(null);
      setMode('wake');
      startRec();
    } else stop();
  };

  const stopSpeaking = () => globalThis.speechSynthesis?.cancel();

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return { supported: !!Ctor, mode, heard, error, toggle, stopSpeaking };
}
