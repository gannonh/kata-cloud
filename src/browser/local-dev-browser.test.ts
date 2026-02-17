import { describe, expect, it } from "vitest";
import {
  createInitialBrowserNavigationState,
  navigateBrowserHistory,
  normalizeLocalPreviewUrl,
  stepBrowserHistory
} from "./local-dev-browser";

describe("local dev browser helpers", () => {
  it("normalizes localhost urls and adds default protocol", () => {
    expect(normalizeLocalPreviewUrl("localhost:3000")).toBe("http://localhost:3000/");
    expect(normalizeLocalPreviewUrl("http://127.0.0.1:8080/test")).toBe(
      "http://127.0.0.1:8080/test"
    );
  });

  it("rejects non-localhost urls", () => {
    expect(() => normalizeLocalPreviewUrl("https://example.com")).toThrow("Use localhost");
  });

  it("adds and steps browser history", () => {
    const initial = createInitialBrowserNavigationState("http://localhost:3000");
    const withSecond = navigateBrowserHistory(initial, "http://localhost:4173");
    const withThird = navigateBrowserHistory(withSecond, "http://127.0.0.1:8080");

    expect(withThird.index).toBe(2);
    expect(stepBrowserHistory(withThird, "back").index).toBe(1);
    expect(stepBrowserHistory(stepBrowserHistory(withThird, "back"), "forward").index).toBe(2);
  });
});
