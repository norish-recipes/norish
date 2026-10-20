import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import MediaCarousel, { buildMediaItems } from "@/components/shared/media-carousel";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { current?: number; total?: number }) => {
    if (key === "generated") return "Generated";
    if (key === "sourcePhoto") return "Source photo";
    if (key === "imagePosition") return `${values?.current} / ${values?.total}`;

    return key;
  },
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img alt={alt} src={src} />,
}));

vi.mock("@/components/shared/image-lightbox", () => ({
  default: () => null,
}));

function slides(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-slot="carousel-item"]'));
}

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});
describe("recipe image labels", () => {
  it("labels a Generated Image and a Source Image and counts the slides", () => {
    const items = buildMediaItems({
      images: [
        { image: "/recipes/r1/generated.jpg", order: 0, generated: true },
        { image: "/recipes/r1/source.jpg", order: 1, generated: false },
      ],
    });

    const { container } = render(<MediaCarousel items={items} />);
    const [generatedSlide, sourceSlide] = slides(container);

    expect(generatedSlide).toBeDefined();
    expect(sourceSlide).toBeDefined();
    expect(within(generatedSlide!).getByText("Generated")).toBeInTheDocument();
    expect(within(generatedSlide!).getByText("1 / 2")).toBeInTheDocument();
    expect(within(generatedSlide!).getByRole("img")).toHaveAttribute(
      "src",
      "/recipes/r1/generated.jpg"
    );
    expect(within(sourceSlide!).getByText("Source photo")).toBeInTheDocument();
    expect(within(sourceSlide!).getByText("2 / 2")).toBeInTheDocument();
  });

  it("renders one Source photo slide for a source-only recipe", () => {
    const items = buildMediaItems({
      images: [{ image: "/recipes/r1/source.jpg", order: 0, generated: false }],
    });

    render(<MediaCarousel items={items} />);

    expect(screen.getByText("Source photo")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", "/recipes/r1/source.jpg");
    expect(screen.queryByText("1 / 1")).not.toBeInTheDocument();
  });

  it("puts the Generated Image first when it holds order 0", () => {
    const items = buildMediaItems({
      images: [
        { image: "/recipes/r1/source.jpg", order: 1, generated: false },
        { image: "/recipes/r1/generated.jpg", order: 0, generated: true },
      ],
    });

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/recipes/r1/generated.jpg", generated: true }),
      ])
    );

    const { container } = render(<MediaCarousel items={items} />);
    const [firstSlide] = slides(container);

    expect(within(firstSlide!).getByText("Generated")).toBeInTheDocument();
    expect(within(firstSlide!).getByRole("img")).toHaveAttribute(
      "src",
      "/recipes/r1/generated.jpg"
    );
  });
});
