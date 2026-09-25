// Тред коментарів у картці (ADR-0010).
import { useState, type KeyboardEvent } from 'react';
import { timeAgo, useComments } from './comments';
import { getPerson } from './data';
import { useEntityLink } from './entities/EntityLink';
import type { EntityRef } from './navigation';

const initials = (name: string) => name.split(' ').map((w) => w[0]).slice(0, 2).join('');

/** Кнопка «💬 N» для хедера картки. */
export function CommentsToggle({ entity, open, onToggle }: { entity: EntityRef; open: boolean; onToggle: () => void }) {
  const { count } = useComments(entity);
  return (
    <button
      type="button"
      className={`comments-toggle nodrag${open ? ' is-open' : ''}`}
      title={open ? 'Сховати коментарі' : 'Коментарі'}
      onClick={onToggle}
    >
      💬{count > 0 && <span className="comments-toggle__count">{count}</span>}
    </button>
  );
}

function Author({ personId }: { personId: string }) {
  const { active, onClick } = useEntityLink({ type: 'person', id: personId }, 'commented');
  const p = getPerson(personId);
  return (
    <button type="button" className={`comment__author nodrag${active ? ' is-active' : ''}`} onClick={onClick} title="Відкрити профіль">
      <span className="comment__avatar">{initials(p.name)}</span>
      <span className="comment__name">{p.name}</span>
    </button>
  );
}

export function CommentThread({ entity }: { entity: EntityRef }) {
  const { list, userId, add, remove, toggleLike } = useComments(entity);
  const [draft, setDraft] = useState('');

  const submit = () => {
    if (!draft.trim()) return;
    add(draft);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <section className="thread nodrag nowheel">
      <h4 className="thread__title">Коментарі{list.length > 0 && ` · ${list.length}`}</h4>
      {list.length === 0 && <p className="thread__empty">Поки немає. Почніть обговорення 👇</p>}
      <ul className="thread__list">
        {list.map((c) => {
          const liked = c.likes.includes(userId);
          return (
            <li key={c.id} className="comment">
              <div className="comment__head">
                <Author personId={c.authorId} />
                <span className="comment__time" title={new Date(c.createdAt).toLocaleString('uk-UA')}>
                  {timeAgo(c.createdAt)}
                </span>
              </div>
              <p className="comment__text">{c.text}</p>
              <div className="comment__actions">
                <button type="button" className={`comment__like${liked ? ' is-liked' : ''}`} onClick={() => toggleLike(c.id)}>
                  {liked ? '❤️' : '🤍'} {c.likes.length > 0 && c.likes.length}
                </button>
                {c.authorId === userId && (
                  <button type="button" className="comment__delete" onClick={() => remove(c.id)}>
                    Видалити
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="thread__composer">
        <textarea
          className="thread__input nopan"
          rows={2}
          placeholder={`Коментар від ${getPerson(userId).name}…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="button" className="thread__send" disabled={!draft.trim()} onClick={submit} title="Надіслати (Enter)">
          ↑
        </button>
      </div>
    </section>
  );
}
