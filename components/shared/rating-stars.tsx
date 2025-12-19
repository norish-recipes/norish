"use client";

import { StarIcon } from "@heroicons/react/16/solid";
import { useState } from "react";

type RatingStarsProps = {
  value: number | null;
  onChange: (value: number | null) => void;
};

export default function RatingStars({ value, onChange }: RatingStarsProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const displayRating = hoverRating ?? value;

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHoverRating(null)}>
      {[1, 2, 3, 4, 5].map((rating) => {
        const isFilled = displayRating !== null && rating <= displayRating;

        return (
          <button
            key={rating}
            className="p-1"
            onClick={() => onChange(value === rating ? null : rating)}
            onMouseEnter={() => setHoverRating(rating)}
          >
            <StarIcon
              className={`size-5 transition-colors ${
                isFilled ? "text-warning" : "text-default-300"
              }`}
            />
          </button>
        );
      })}
      {value !== null && <span className="text-default-500 ml-1 text-xs">{value}+</span>}
    </div>
  );
}
