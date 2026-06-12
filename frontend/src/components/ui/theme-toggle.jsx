"use client";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import * as React from "react";

const ThemeToggle = React.memo(() => {
  const { theme, setTheme } = useTheme();

  const handleToggleTheme = React.useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleToggleTheme}
      data-slot="theme-toggle"
      aria-label="Toggle theme between light and dark mode"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="relative h-9 w-9 rounded-md border-2 transition-all duration-200 hover:scale-105 hover:shadow-md"
    >
      <Sun className="absolute w-5 h-5 transition-all duration-300 scale-100 rotate-0 dark:-rotate-90 dark:scale-0 text-amber-500" />
      <Moon className="absolute w-5 h-5 transition-all duration-300 scale-0 rotate-90 dark:rotate-0 dark:scale-100 text-amber-500" />
      <span className="sr-only">
        {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      </span>
    </Button>
  );
});

ThemeToggle.displayName = "ThemeToggle";

export { ThemeToggle };
