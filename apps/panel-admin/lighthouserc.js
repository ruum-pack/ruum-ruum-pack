module.exports = {
  ci: {
    collect: {
      // Solo rutas públicas: el resto del panel exige sesión de admin.
      startServerCommand: "pnpm start",
      startServerReadyPattern: "[Rr]eady|[Ll]ocal|http://localhost:3002",
      startServerReadyTimeout: 120000,
      url: ["http://localhost:3002/login"],
      numberOfRuns: 1,
      settings: {
        chromeFlags: "--no-sandbox --disable-dev-shm-usage --disable-gpu --headless=new",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"]
      }
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }]
      }
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouse-ci",
      reportFilenamePattern: "%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%"
    }
  }
};
