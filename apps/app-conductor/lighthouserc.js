module.exports = {
  ci: {
    collect: {
      staticDistDir: './.next/static',
      url: ['http://localhost:3001'],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'accessibility': ['error', { minScore: 0.95 }],
        'best-practices': ['error', { minScore: 0.90 }],
        'seo': ['error', { minScore: 0.90 }],
        'performance': ['warn', { minScore: 0.50 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
  server: {
    port: 3001,
  },
};
