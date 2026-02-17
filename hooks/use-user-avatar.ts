import { getAvatarFallbackStyle } from "@/lib/avatar-color";

type UseUserAvatarParams = {
  image?: string | null;
  fallbackSeed?: string | null;
  disabled?: boolean;
};

export function useUserAvatar({ image, fallbackSeed, disabled = false }: UseUserAvatarParams) {
  return {
    avatarSrc: !disabled && image ? image : undefined,
    fallbackStyle: getAvatarFallbackStyle(fallbackSeed || "U"),
  };
}
