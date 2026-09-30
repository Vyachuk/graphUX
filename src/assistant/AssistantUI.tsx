// Інтерфейс асистента (ADR-0018): док унизу канвасу і панель чату праворуч; поле вводу й мікрофон спільні.
import { useEffect, useRef, useState } from 'react';
import { registry } from '../entities/registry';
import { useNavState } from '../navigation';
import { useAssistant, type Message } from './session';
import { suggestions } from './suggest';
import type { VoiceMode } from './voice';

const MIC_TITLE: Record<VoiceMode, string> = {
  off: 'Увімкнути голос: скажи «Гей, граф»',
  wake: 'Чекаю «Гей, граф» — натисни, щоб вимкнути',
  listening: 'Слухаю…',
  thinking: 'Думаю…',
  speaking: 'Відповідаю…',
  followup: 'Слухаю продовження…',
};

function MicButton() {
  const { voice } = useAssistant();
  const title = voice.supported ? MIC_TITLE[voice.mode] : 'Браузер не розпізнає мовлення — спробуй Chrome або Edge';
  return (
    <button
      type="button"
      className={`mic mic--${voice.mode}`}
      onClick={voice.toggle}
      disabled={!voice.supported}
      title={title}
      aria-label={title}
      aria-pressed={voice.mode !== 'off'}
    >
      🎤
    </button>
  );
}

/** Рядок стану голосу: що чую, думаю, відповідаю. */
function VoiceStatus() {
  const { voice } = useAssistant();
  if (voice.error) return <div className="voice-status is-error">{voice.error}</div>;
  if (voice.mode === 'off') return null;
  const text = {
    wake: voice.heard ? `Скажи «Гей, граф» · чую: «${voice.heard}»` : 'Скажи «Гей, граф» і команду',
    listening: voice.heard ? `«${voice.heard}»` : 'Слухаю…',
    thinking: 'Думаю…',
    speaking: 'Відповідаю…',
    followup: 'Слухаю продовження — можна без «Гей, граф»',
  }[voice.mode];
  return (
    <div className={`voice-status is-${voice.mode}`}>
      <span className="voice-status__dot" />
      {text}
      {voice.mode === 'speaking' && (
        <button type="button" className="voice-status__stop" onClick={voice.stopSpeaking}>
          тихо
        </button>
      )}
    </div>
  );
}

/** Асистент чекає текст коментаря: підказка й кнопка скасування (ADR-0020). */
function Dictation() {
  const { awaiting, cancelAwaiting } = useAssistant();
  if (awaiting?.kind !== 'comment') return null;
  const { type, id } = awaiting.target;
  return (
    <div className="dictation">
      <span className="dictation__icon">✎</span>
      Коментар до «{registry[type].title(id)}» — скажи або напиши текст
      <button type="button" className="dictation__cancel" onClick={cancelAwaiting}>
        скасувати
      </button>
    </div>
  );
}

function Composer({ autoFocus }: { autoFocus?: boolean }) {
  const { send, busy, awaiting } = useAssistant();
  const [draft, setDraft] = useState('');
  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim() || busy) return;
        void send(draft);
        setDraft('');
      }}
    >
      <MicButton />
      <input
        className="composer__input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={awaiting?.kind === 'comment' ? 'Текст коментаря…' : 'Запитай асистента…'}
        autoFocus={autoFocus}
        aria-label="Повідомлення асистенту"
      />
      <button type="submit" className="composer__send" disabled={!draft.trim() || busy} aria-label="Надіслати">
        ↑
      </button>
    </form>
  );
}

function Suggestions() {
  const { send, busy, awaiting } = useAssistant();
  const state = useNavState();
  // Під час диктування клік на підказку став би текстом коментаря.
  if (awaiting) return null;
  const items = suggestions(state.nodes[state.focus].ref);
  return (
    <div className="suggestions">
      {items.map((q) => (
        <button key={q} type="button" className="suggestion" disabled={busy} onClick={() => void send(q)}>
          {q}
        </button>
      ))}
    </div>
  );
}

function Reply({ m }: { m: Message }) {
  const { undo } = useAssistant();
  return (
    <div className={`reply${m.undone ? ' is-undone' : ''}`}>
      <p className="reply__text">{m.text || (m.pending ? <span className="typing">•••</span> : '')}</p>
      {m.actions.length > 0 && (
        <div className="reply__actions">
          {m.actions.map((a, i) => (
            <span key={i} className="reply__action">
              ✦ {a}
            </span>
          ))}
          {m.undone ? (
            <span className="reply__undone">Скасовано</span>
          ) : (
            !m.pending && (
              <button type="button" className="reply__undo" onClick={() => undo(m.id)}>
                ↶ Скасувати
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

/** Док унизу канвасу: підказки, поле вводу, мікрофон; остання відповідь — над ним. */
export function AssistantDock() {
  const { messages, chatOpen, setChatOpen } = useAssistant();
  const last = messages.at(-1);
  const [hidden, setHidden] = useState<string | null>(null);
  if (chatOpen) return null;
  const preview = last?.role === 'assistant' && last.id !== hidden ? last : null;
  return (
    <div className="assistant-dock">
      {preview && (
        <div className="assistant-dock__preview">
          <button type="button" className="assistant-dock__close" onClick={() => setHidden(preview.id)} aria-label="Сховати">
            ×
          </button>
          <Reply m={preview} />
        </div>
      )}
      <VoiceStatus />
      <Dictation />
      <Suggestions />
      <div className="assistant-dock__bar">
        <Composer />
        <button type="button" className="assistant-dock__chat" onClick={() => setChatOpen(true)} title="Відкрити чат">
          💬 Чат
        </button>
      </div>
    </div>
  );
}

/** Панель чату праворуч: та сама сесія, що й голос. */
export function AssistantChat() {
  const { messages, chatOpen, setChatOpen } = useAssistant();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages]);
  if (!chatOpen) return null;
  return (
    <aside className="assistant-chat" aria-label="Чат з асистентом">
      <header className="assistant-chat__head">
        <span className="assistant-chat__title">✦ Асистент</span>
        <button type="button" className="assistant-chat__close" onClick={() => setChatOpen(false)} aria-label="Закрити чат">
          ×
        </button>
      </header>
      <div className="assistant-chat__list">
        {messages.length === 0 && (
          <div className="assistant-chat__hello">
            Привіт! Я відкриваю й закриваю картки за тебе. Напиши або увімкни 🎤 і скажи «Гей, граф, покажи Львів».
          </div>
        )}
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="ask">
              {m.source === 'voice' && <span className="ask__voice">🎤</span>}
              {m.text}
            </div>
          ) : (
            <Reply key={m.id} m={m} />
          ),
        )}
        <div ref={end} />
      </div>
      <div className="assistant-chat__foot">
        <VoiceStatus />
        <Dictation />
        <Suggestions />
        <Composer autoFocus />
      </div>
    </aside>
  );
}
