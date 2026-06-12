import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "rwa-ui-theme",
}) {
  const [theme, setThemeState] = useState(() => {
    try {
      if (typeof window === "undefined") return defaultTheme;

      const stored = localStorage.getItem(storageKey);
      if (stored) return stored;

      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }

      return defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, newTheme);
      document.documentElement.classList.toggle("dark", newTheme === "dark");
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      if (!localStorage.getItem(storageKey)) {
        setThemeState(e.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [storageKey]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export default ThemeProvider;
