"use client";

import { PlaceCard } from "./PlaceCard";
import type { Category, Place } from "@/lib/validation/schemas";

interface Props {
  places: Place[];
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PlaceList({ places, categories, selectedId, onSelect }: Props) {
  const catById = new Map(categories.map((c) => [c.id, c]));
  return (
    <ul className="space-y-3" data-testid="place-list">
      {places.map((p) => (
        <li key={p.id}>
          <PlaceCard place={p} category={catById.get(p.category)} active={p.id === selectedId} onSelect={() => onSelect(p.id)} />
        </li>
      ))}
    </ul>
  );
}
