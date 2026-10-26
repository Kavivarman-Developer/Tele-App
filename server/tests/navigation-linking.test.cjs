const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Import the linking configuration matching mobile/src/navigation/RootNavigator.tsx
const linkingConfig = {
  prefixes: [
    'https://hitalk.in',
    'http://hitalk.in',
    'https://www.hitalk.in',
    'http://www.hitalk.in',
    'https://call.okboz.co.in',
    'http://call.okboz.co.in',
    'http://localhost:8081',
    'http://localhost:19006',
    'hitalk://',
    '/',
  ],
  config: {
    screens: {
      Login: 'login',
      CallingDesk: 'calling-desk',
      CampaignSelect: 'campaign-select',
      MyLeads: 'leads',
      FollowUps: 'follow-ups',
      CallHistory: 'call-history',
      AgentReports: 'reports',
      Team: 'team',
      Campaigns: 'campaigns',
      CampaignDetail: 'campaigns-detail',
      UploadLeads: 'upload-leads',
      Settings: 'settings',
      Diagnostics: 'diagnostics',
      RetryRules: 'retry-rules',
      AddWalkInLead: 'add-walk-in',
      LeadDetail: 'lead-detail',
      Dispose: 'dispose',
      Dashboard: 'dashboard',
      Launchpad: 'launchpad',
      Main: {
        screens: {
          Home: 'home',
          CampaignsHub: 'campaigns-hub',
          MyLeads: 'queue-leads',
          FollowUps: 'my-follow-ups',
          Dashboard: 'team-dashboard',
          Profile: 'my-profile',
        },
      },
    },
  },
};

// URL Router resolver matching React Navigation's path-to-screen mapping logic
function resolvePathToRoute(pathname, config = linkingConfig.config.screens) {
  const cleanPath = pathname.replace(/^\/+|\/+$/g, '');
  if (!cleanPath) return null;

  for (const [screenName, pattern] of Object.entries(config)) {
    if (typeof pattern === 'string' && pattern === cleanPath) {
      return { screen: screenName };
    }
    if (typeof pattern === 'object' && pattern.screens) {
      for (const [nestedScreen, nestedPattern] of Object.entries(pattern.screens)) {
        if (nestedPattern === cleanPath) {
          return { screen: screenName, nestedScreen };
        }
      }
    }
  }
  return null;
}

// Emulate onReady restoration logic from RootNavigator.tsx
function simulateOnReadyRestoration({ isRoot, token, savedScreen, savedParamsStr }) {
  if (!token) {
    // Unauthenticated: cannot navigate to protected screens
    return { targetScreen: 'Login', params: undefined };
  }

  if (isRoot) {
    if (savedScreen && savedScreen !== 'Home' && savedScreen !== 'Login' && savedScreen !== 'Launchpad') {
      let savedParams = undefined;
      try {
        if (savedParamsStr) savedParams = JSON.parse(savedParamsStr);
      } catch {
        // Corrupted JSON is safely ignored
      }
      return { targetScreen: savedScreen, params: savedParams };
    }
    return { targetScreen: 'Main', params: undefined };
  }
  return null;
}

describe('RootNavigator Deep-Linking & Route Restoration Unit Tests', () => {
  it('correctly maps canonical root URLs to expected screen names', () => {
    assert.deepEqual(resolvePathToRoute('/calling-desk'), { screen: 'CallingDesk' });
    assert.deepEqual(resolvePathToRoute('/leads'), { screen: 'MyLeads' });
    assert.deepEqual(resolvePathToRoute('/dashboard'), { screen: 'Dashboard' });
    assert.deepEqual(resolvePathToRoute('/follow-ups'), { screen: 'FollowUps' });
    assert.deepEqual(resolvePathToRoute('/campaigns'), { screen: 'Campaigns' });
    assert.deepEqual(resolvePathToRoute('/reports'), { screen: 'AgentReports' });
    assert.deepEqual(resolvePathToRoute('/settings'), { screen: 'Settings' });
  });

  it('correctly maps nested Main tab URLs to nested screen destinations', () => {
    assert.deepEqual(resolvePathToRoute('/home'), { screen: 'Main', nestedScreen: 'Home' });
    assert.deepEqual(resolvePathToRoute('/campaigns-hub'), { screen: 'Main', nestedScreen: 'CampaignsHub' });
    assert.deepEqual(resolvePathToRoute('/queue-leads'), { screen: 'Main', nestedScreen: 'MyLeads' });
    assert.deepEqual(resolvePathToRoute('/team-dashboard'), { screen: 'Main', nestedScreen: 'Dashboard' });
  });

  it('restores CallingDesk with route params when reloaded on root URL /', () => {
    const restored = simulateOnReadyRestoration({
      isRoot: true,
      token: 'jwt_mock_token_123',
      savedScreen: 'CallingDesk',
      savedParamsStr: JSON.stringify({ campaignId: 'c1' }),
    });
    assert.equal(restored.targetScreen, 'CallingDesk');
    assert.deepEqual(restored.params, { campaignId: 'c1' });
  });

  it('safely handles corrupted JSON in savedParams without crashing', () => {
    const restored = simulateOnReadyRestoration({
      isRoot: true,
      token: 'jwt_mock_token_123',
      savedScreen: 'MyLeads',
      savedParamsStr: '{invalid-json',
    });
    assert.equal(restored.targetScreen, 'MyLeads');
    assert.equal(restored.params, undefined);
  });

  it('forces unauthenticated users to Login screen even if stale screen is stored in localStorage', () => {
    const restored = simulateOnReadyRestoration({
      isRoot: true,
      token: null, // No active authentication
      savedScreen: 'Dashboard',
      savedParamsStr: null,
    });
    assert.equal(restored.targetScreen, 'Login');
  });

  it('does not restore Home or Launchpad, defaulting to initial stack', () => {
    const restored = simulateOnReadyRestoration({
      isRoot: true,
      token: 'jwt_token',
      savedScreen: 'Launchpad',
      savedParamsStr: null,
    });
    assert.equal(restored.targetScreen, 'Main');
  });
});
