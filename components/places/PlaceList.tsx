"use client";

import { PlaceCard } from "./PlaceCard";
import { haversineMeters, type LngLat } from "@/lib/geo";
import type { Category, Place } from "@/lib/validation/schemas";

interface Props {
  places: Place[];
  categories: Category[];
  selectedId: string | null;
  /** 거리 기준점(없으면 거리 숨김) */
  origin: LngLat | null;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  onSelect: (id: string) => void;
}

export function PlaceList({ places, categories, selectedId, origin, isFavorite, onToggleFavorite, onSelect }: Props) {
  const catById = new Map(categories.map((c) => [c.id, c]));
  return (
    <ul className="space-y-2" data-testid="place-list">
      {places.map((p) => (
        <li key={p.id}>
          <PlaceCard
            place={p}
            category={catById.get(p.category)}
            active={p.id === selectedId}
            distanceM={origin ? haversineMeters(origin, [p.longitude, p.latitude]) : null}
            favorite={isFavorite(p.id)}
            onToggleFavorite={() => onToggleFavorite(p.id)}
            onSelect={() => onSelect(p.id)}
          />
        </li>
      ))}
    </ul>
  );
}
