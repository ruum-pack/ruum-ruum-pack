module.exports = {
  ci: {
    collect: {
      startServerCommand: "pnpm start",
      startServerReadyPattern: "[Rr]eady|[Ll]ocal|http://localhost:3001",
      startServerReadyTimeout: 120000,
      url: [
        "http://localhost:3001/onboarding",
        "http://localhost:3001/login",
        "http://localhost:3001/legal/privacidad"
      ],
      numberOfRuns: 1,
      settings: {
        chromeFlags: "--no-sandbox --disable-dev-shm-usage --disable-gpu --headless=new",
        onlyCategories: ["accessibility", "best-practices", "seo"]
      }
    },
    assert: {
      assertions: {
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.90 }],
        "categories:seo": ["error", { minScore: 0.90 }],
        "categories:performance": "off"
      }
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouse-ci",
      reportFilenamePattern: "%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%"
    }
  }
};
