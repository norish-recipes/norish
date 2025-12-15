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
            type="button"
            disabled={isLoading}
            className="cursor-pointer transition-transform hover:scale-110 disabled:cursor-default disabled:opacity-50"
            onClick={() => onChange(starValue)}
            onMouseEnter={() => setHoverValue(starValue)}
            aria-label={`Rate ${starValue} out of 5`}
          >
            {isFilled ? (
              <StarSolid className="h-8 w-8 text-warning" />
            ) : (
              <StarOutline className="h-8 w-8 text-default-300" />
            )}
          </button>
        );
      })}
    </div>
  );
}
