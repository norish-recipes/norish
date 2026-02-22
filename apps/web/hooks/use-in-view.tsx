import { useState, useEffect } from "react";

export default function useInView(ref: React.RefObject<HTMLElement | null>, rootMargin = "0px") {
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting), {
      rootMargin,
    });

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [ref, rootMargin]);

  return isInView;
}
