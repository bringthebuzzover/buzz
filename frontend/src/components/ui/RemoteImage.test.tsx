/**
 * Remote images: safe src renders an <img>; a missing or rejected src, and a
 * load error, render initials instead of broken alt text.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { RemoteImage, imageInitials } from "./RemoteImage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("imageInitials", () => {
  it("uses the first letter of the first two words", () => {
    expect(imageInitials("BUZZ Review Test Brand")).toBe("BR");
    expect(imageInitials("Epsilon Nu Tau")).toBe("EN");
  });

  it("uses two letters of a single word", () => {
    expect(imageInitials("UCLA")).toBe("UC");
    expect(imageInitials("  ")).toBe("");
  });
});

describe("RemoteImage", () => {
  it("renders an https image and strips the referrer on Instagram CDNs", () => {
    const html = renderToString(
      <RemoteImage
        src="https://scontent.cdninstagram.com/v/thumb.jpg"
        label="Epsilon Nu Tau"
        className="h-12 w-12"
      />,
    );
    expect(html).toContain('src="https://scontent.cdninstagram.com/v/thumb.jpg"');
    expect(html.toLowerCase()).toContain('referrerpolicy="no-referrer"');
    expect(html).not.toContain("data-testid");
  });

  it("does not send no-referrer for an ordinary hero URL", () => {
    const html = renderToString(
      <RemoteImage
        src="https://cdn.example.test/hero.png"
        label="Acme"
        alt="Campus drop"
      />,
    );
    expect(html).toContain('src="https://cdn.example.test/hero.png"');
    expect(html).toContain('alt="Campus drop"');
    expect(html).not.toContain("referrerpolicy");
  });

  it("shows initials instead of an img when the URL is not displayable", () => {
    const html = renderToString(
      <RemoteImage src="javascript:alert(1)" label="Meta Review Test Drop" />,
    );
    const protocolRelative = renderToString(
      <RemoteImage src="//evil.example/x.png" label="Acme Brand" />,
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("MR");
    expect(html).toContain('data-testid="image-fallback"');
    expect(protocolRelative).not.toContain("<img");
    expect(protocolRelative).toContain("AB");
  });

  it("swaps to initials when the image fails to load", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let root: Root | undefined;
    act(() => {
      root = createRoot(host);
      root.render(
        <RemoteImage
          src="https://www.bringthebuzzover.com/favicon.ico"
          label="BUZZ Review Test Brand"
          alt="Meta Review Test Drop"
        />,
      );
    });
    const img = host.querySelector("img");
    expect(img).not.toBeNull();
    act(() => {
      img?.dispatchEvent(new Event("error"));
    });
    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).toContain("BR");
    expect(host.querySelector("[data-testid=image-fallback]")).not.toBeNull();
    act(() => {
      root?.unmount();
    });
    host.remove();
  });
});
