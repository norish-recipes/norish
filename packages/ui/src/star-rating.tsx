"use client";

import { useState } from "react";
import { StarIcon as StarSolidSmall } from "@heroicons/react/16/solid";
import { StarIcon as StarOutline } from "@heroicons/react/24/outline";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";

type StarRatingBaseProps = {
  value: number | null;
  isLoading?: boolean;
  /** "lg" renders large outline/solid stars, "sm" renders compact solid stars */
  size?: "sm" | "lg";
  /** Show the selected value as a "{value}+" suffix (used for minimum-rating filters) */
  showValueSuffix?: boolean;
};

type StarRatingProps = StarRatingBaseProps &
  (
    | {
        /** Re-selecting the current value clears the rating (calls onChange with null) */
        allowClear: true;
        onChange: (value: number | null) => void;
      }
    | { allowClear?: false; onChange: (value: number) => void }
  );

export default function StarRating(props: StarRatingProps) {
  const { value, isLoading = false, size = "lg", showValueSuffix = false } = props;
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value ?? 0;

  const handleSelect = (starValue: number) => {
    if (props.allowClear) {
      props.onChange(value === starValue ? null : starValue);
    } else {
      props.onChange(starValue);
    }
  };

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHoverValue(null)}>
      {[1, 2, 3, 4, 5].map((starValue) => {
        const isFilled = displayValue >= starValue;

        return (
          <button
            key={starValue}
            aria-label={`Rate ${starValue} out of 5`}
            className={
              size === "lg"
                ? "cursor-pointer transition-transform hover:scale-110 disabled:cursor-default disabled:opacity-50"
                : "cursor-pointer p-1 disabled:cursor-default disabled:opacity-50"
            }
            disabled={isLoading}
            type="button"
            onClick={() => handleSelect(starValue)}
            onMouseEnter={() => setHoverValue(starValue)}
          >
            {size === "lg" ? (
              isFilled ? (
                <StarSolid className="text-warning h-8 w-8" />
              ) : (
                <StarOutline className="text-default-300 h-8 w-8" />
              )
            ) : (
              <StarSolidSmall
                className={`size-5 transition-colors ${
                  isFilled ? "text-warning" : "text-default-300"
                }`}
              />
            )}
          </button>
        );
      })}
      {showValueSuffix && value !== null && (
        <span className="text-default-500 ml-1 text-xs">{value}+</span>
      )}
    </div>
  );
}
