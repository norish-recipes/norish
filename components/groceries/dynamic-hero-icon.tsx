"use client";

import type { ComponentType, SVGProps } from "react";

import { useMemo } from "react";
import {
  ShoppingBagIcon,
  BuildingStorefrontIcon,
  HomeIcon,
  ShoppingCartIcon,
  TruckIcon,
  CubeIcon,
  BeakerIcon,
  FireIcon,
  HeartIcon,
  StarIcon,
  SparklesIcon,
  TagIcon,
  GlobeAltIcon,
  BuildingOffice2Icon,
  MapPinIcon,
  ArchiveBoxIcon,
  BoltIcon,
  CakeIcon,
  GiftIcon,
  WrenchIcon,
  ScissorsIcon,
  PaintBrushIcon,
} from "@heroicons/react/24/outline";

// Map of available icons
const ICON_MAP: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  ShoppingBagIcon,
  BuildingStorefrontIcon,
  HomeIcon,
  ShoppingCartIcon,
  TruckIcon,
  CubeIcon,
  BeakerIcon,
  FireIcon,
  HeartIcon,
  StarIcon,
  SparklesIcon,
  TagIcon,
  GlobeAltIcon,
  BuildingOffice2Icon,
  MapPinIcon,
  ArchiveBoxIcon,
  BoltIcon,
  CakeIcon,
  GiftIcon,
  WrenchIcon,
  ScissorsIcon,
  PaintBrushIcon,
};

// Default icon for fallback
const DEFAULT_ICON = ShoppingBagIcon;

// All available icon names for the picker
export const STORE_ICON_NAMES = Object.keys(ICON_MAP);

interface DynamicHeroIconProps {
  iconName: string;
  className?: string;
}

/**
 * Renders a Heroicon by name. Falls back to ShoppingBagIcon for invalid names.
 */
export function DynamicHeroIcon({ iconName, className = "h-5 w-5" }: DynamicHeroIconProps) {
  const IconComponent = useMemo(() => {
    return ICON_MAP[iconName] ?? DEFAULT_ICON;
  }, [iconName]);

  return <IconComponent className={className} />;
}

/**
 * Check if an icon name is valid
 */
export function isValidIconName(iconName: string): boolean {
  return iconName in ICON_MAP;
}
