"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal, ModalContent, Button } from "@heroui/react";
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";

export interface ImageLightboxProps {
  images: { src: string; alt?: string }[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function ImageLightbox({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);

  // Reset to initial index when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setDirection(0);
    }
  }, [isOpen, initialIndex]);

  const goToPrevious = useCallback(() => {
    if (images.length <= 1) return;
    setDirection(-1);
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const goToNext = useCallback(() => {
    if (images.length <= 1) return;
    setDirection(1);
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          goToPrevious();
          break;
        case "ArrowRight":
          goToNext();
          break;
        case "Escape":
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, goToPrevious, goToNext, onClose]);

  if (images.length === 0) return null;

  const currentImage = images[currentIndex];
  const showNavigation = images.length > 1;

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir !== 0 ? (dir > 0 ? 300 : -300) : 0,
      opacity: dir !== 0 ? 0 : 1,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir !== 0 ? (dir < 0 ? 300 : -300) : 0,
      opacity: 0,
    }),
  };

  return (
    <Modal
      hideCloseButton
      classNames={{
        backdrop: "bg-black/90 backdrop-blur-md",
        base: "bg-transparent shadow-none max-w-full max-h-full",
        wrapper: "items-center justify-center",
      }}
      isOpen={isOpen}
      size="full"
      onClose={onClose}
    >
      <ModalContent className="bg-transparent">
        {() => (
          <div className="relative flex h-screen w-screen items-center justify-center">
            {/* Close button */}
            <Button
              isIconOnly
              className="absolute top-4 right-4 z-50 bg-black/50 text-white hover:bg-black/70"
              radius="full"
              size="lg"
              variant="flat"
              onPress={onClose}
            >
              <XMarkIcon className="h-6 w-6" />
            </Button>

            {/* Image counter */}
            {showNavigation && (
              <div className="absolute top-4 left-4 z-50 rounded-full bg-black/50 px-4 py-2 text-sm text-white">
                {currentIndex + 1} / {images.length}
              </div>
            )}

            {/* Previous button */}
            {showNavigation && (
              <Button
                isIconOnly
                className="absolute left-4 z-50 bg-black/50 text-white hover:bg-black/70"
                radius="full"
                size="lg"
                variant="flat"
                onPress={goToPrevious}
              >
                <ChevronLeftIcon className="h-6 w-6" />
              </Button>
            )}

            {/* Image container */}
            <div className="relative h-[80vh] w-[90vw] overflow-hidden">
              <AnimatePresence custom={direction} initial={false} mode="wait">
                <motion.div
                  key={currentIndex}
                  animate="center"
                  className="absolute inset-0 flex items-center justify-center"
                  custom={direction}
                  exit="exit"
                  initial="enter"
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 },
                  }}
                  variants={slideVariants}
                >
                  <Image
                    fill
                    unoptimized
                    alt={currentImage?.alt || `Image ${currentIndex + 1}`}
                    className="object-contain"
                    src={currentImage?.src || ""}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Next button */}
            {showNavigation && (
              <Button
                isIconOnly
                className="absolute right-4 z-50 bg-black/50 text-white hover:bg-black/70"
                radius="full"
                size="lg"
                variant="flat"
                onPress={goToNext}
              >
                <ChevronRightIcon className="h-6 w-6" />
              </Button>
            )}

            {/* Thumbnail strip (optional for multiple images) */}
            {showNavigation && (
              <div className="absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 gap-2">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    className={`h-16 w-16 overflow-hidden rounded-lg border-2 transition-all ${idx === currentIndex
                      ? "border-white opacity-100"
                      : "border-transparent opacity-60 hover:opacity-80"
                      }`}
                    type="button"
                    onClick={() => {
                      setDirection(idx > currentIndex ? 1 : -1);
                      setCurrentIndex(idx);
                    }}
                  >
                    <Image
                      unoptimized
                      alt={img.alt || `Thumbnail ${idx + 1}`}
                      className="h-full w-full object-cover"
                      height={64}
                      src={img.src}
                      width={64}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}
