"use client";

import { Icon } from "@iconify/react";
import { useState, useEffect } from "react";

interface ProviderIconProps {
  icon: string;
  providerName: string;
  width?: number;
}

export function ProviderIcon({ icon, providerName, width = 20 }: ProviderIconProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  const maxRetries = 3;

  useEffect(() => {
    if (retryCount > 0 && retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 500;
      const timer = setTimeout(() => {
        setHasError(false);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [retryCount]);

  const handleError = () => {
    if (retryCount < maxRetries) {
      setRetryCount((prev) => prev + 1);
      setHasError(true);
    } else {
      setHasError(true);
    }
  };

  if (hasError && retryCount >= maxRetries) {
    const initials = providerName
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return (
      <div
        className="bg-primary-500 flex items-center justify-center rounded-md font-semibold text-white"
        style={{ width, height: width }}
      >
        <span style={{ fontSize: width * 0.5 }}>{initials}</span>
      </div>
    );
  }

  return <Icon key={`${icon}-${retryCount}`} icon={icon} width={width} onError={handleError} />;
}
