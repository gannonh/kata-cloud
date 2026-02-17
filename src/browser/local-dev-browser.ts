export const DEFAULT_LOCAL_PREVIEW_URL = "http://localhost:5173";

export interface BrowserNavigationState {
  entries: string[];
  index: number;
}

export function createInitialBrowserNavigationState(
  initialUrl = DEFAULT_LOCAL_PREVIEW_URL
): BrowserNavigationState {
  return {
    entries: [initialUrl],
    index: 0
  };
}

export function normalizeLocalPreviewUrl(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error("Enter a localhost URL.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const parsed = new URL(withProtocol);
  const host = parsed.hostname.toLowerCase();

  if (host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]") {
    throw new Error("Use localhost, 127.0.0.1, or ::1.");
  }

  return parsed.toString();
}

export function navigateBrowserHistory(
  state: BrowserNavigationState,
  nextUrl: string
): BrowserNavigationState {
  const currentUrl = state.entries[state.index];
  if (currentUrl === nextUrl) {
    return state;
  }

  const clippedEntries = state.entries.slice(0, state.index + 1);
  return {
    entries: [...clippedEntries, nextUrl],
    index: clippedEntries.length
  };
}

export function stepBrowserHistory(
  state: BrowserNavigationState,
  direction: "back" | "forward"
): BrowserNavigationState {
  if (direction === "back") {
    if (state.index <= 0) {
      return state;
    }

    return {
      ...state,
      index: state.index - 1
    };
  }

  if (state.index >= state.entries.length - 1) {
    return state;
  }

  return {
    ...state,
    index: state.index + 1
  };
}
