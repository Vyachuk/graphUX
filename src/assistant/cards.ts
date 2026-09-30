// Сховище карток-відповідей асистента (ADR-0018): registry читає звідси title, AssistantView — вміст.
import { useSyncExternalStore } from 'react';
import type { AnswerCard } from './types';

const cards = new Map<string, AnswerCard>();
const listeners = new Set<() => void>();

export function putCard(card: AnswerCard) {
  cards.set(card.id, card);
  listeners.forEach((l) => l());
}

export function getCard(id: string): AnswerCard {
  return cards.get(id) ?? { id, title: 'Асистент', text: '', links: [] };
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useCard = (id: string) => useSyncExternalStore(subscribe, () => getCard(id));
