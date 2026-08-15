"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type FeedbackVisibilityContextValue = {
  /** When true, the floating Feedback launcher may render (itinerary/planner only). */
  allowed: boolean;
  setAllowed: (allowed: boolean) => void;
};

const FeedbackVisibilityContext = createContext<FeedbackVisibilityContextValue | null>(
  null,
);

export function FeedbackVisibilityProvider({ children }: { children: ReactNode }) {
  const [allowed, setAllowedState] = useState(false);
  const setAllowed = useCallback((next: boolean) => {
    setAllowedState(next);
  }, []);

  const value = useMemo(
    () => ({ allowed, setAllowed }),
    [allowed, setAllowed],
  );

  return (
    <FeedbackVisibilityContext.Provider value={value}>
      {children}
    </FeedbackVisibilityContext.Provider>
  );
}

export function useFeedbackVisibility(): FeedbackVisibilityContextValue {
  const ctx = useContext(FeedbackVisibilityContext);
  if (!ctx) {
    throw new Error("useFeedbackVisibility must be used within FeedbackVisibilityProvider");
  }
  return ctx;
}
