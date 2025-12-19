"use client";

import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import { StarIcon as StarOutline } from "@heroicons/react/24/outline";
import { useState } from "react";

interface StarRatingProps {
  value: number | null;
  onChange: (rating: number) => void;
  isLoading?: boolean;
}

export default function StarRating({ value, onChange, isLoading = false }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value ?? 0;

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHoverValue(null)}>
      {[1, 2, 3, 4, 5].map((starValue) => {
        const isFilled = displayValue >= starValue;

        return (
          <button
            key={starValue}
            aria-label={`Rate ${starValue} out of 5`}
            className="cursor-pointer transition-transform hover:scale-110 disabled:cursor-default disabled:opacity-50"
            disabled={isLoading}
            type="button"
            onClick={() => onChange(starValue)}
            onMouseEnter={() => setHoverValue(starValue)}
          >
            {isFilled ? (
              <StarSolid className="text-warning h-8 w-8" />
            ) : (
              <StarOutline className="text-default-300 h-8 w-8" />
            )}
          </button>
        );
      })}
    </div>
  );
}
