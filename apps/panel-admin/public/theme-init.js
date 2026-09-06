(() => {
  try {
    const stored = localStorage.getItem("ruum-theme");
    const validStored = stored === "light" || stored === "dark" ? stored : null;
    const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
    const theme = validStored ?? (prefersLight ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", theme);
  } catch {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
