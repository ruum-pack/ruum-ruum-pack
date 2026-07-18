module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm start',
      startServerReadyPattern: 'ready|local',
      startServerReadyTimeout: 120000,
      puppeteerScript: './scripts/lighthouse-auth.cjs',
      url: ['http://localhost:3001/panel'],
      numberOfRuns: 1,
      settings: {
        onlyCategories: ['accessibility', 'best-practices'],
      },
      puppeteerLaunchOptions: {
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.90 }],
        'categories:performance': 'off',
        'categories:seo': 'off',
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouse-ci-auth',
      reportFilenamePattern: 'authenticated-%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%',
    },
  },
};
