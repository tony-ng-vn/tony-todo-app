import { describe, expect, it } from 'vitest';
import { getCurrentUser, signInWithPassword, signOut, signUp } from './auth.js';

describe('auth', () => {
  it('signs up a user and returns a mapped user on success', async () => {
    const client = fakeAuthClient({
      signUp: async () => ({
        data: { user: { id: 'user-1', email: 'tony@example.com', emailVerified: false } },
        error: null,
      }),
    });

    const result = await signUp(client, { email: 'tony@example.com', password: 'hunter22' });

    expect(result).toEqual({ user: { id: 'user-1', email: 'tony@example.com' }, error: null });
  });

  it('returns a mapped error when sign up fails', async () => {
    const client = fakeAuthClient({
      signUp: async () => ({ data: null, error: { message: 'Email already registered' } }),
    });

    const result = await signUp(client, { email: 'tony@example.com', password: 'hunter22' });

    expect(result).toEqual({ user: null, error: { message: 'Email already registered' } });
  });

  it('signs in a user with password and returns a mapped user on success', async () => {
    const client = fakeAuthClient({
      signInWithPassword: async () => ({
        data: { user: { id: 'user-1', email: 'tony@example.com', emailVerified: true } },
        error: null,
      }),
    });

    const result = await signInWithPassword(client, { email: 'tony@example.com', password: 'hunter22' });

    expect(result).toEqual({ user: { id: 'user-1', email: 'tony@example.com' }, error: null });
  });

  it('returns a mapped error when sign in fails', async () => {
    const client = fakeAuthClient({
      signInWithPassword: async () => ({ data: null, error: { message: 'Invalid credentials' } }),
    });

    const result = await signInWithPassword(client, { email: 'tony@example.com', password: 'wrong' });

    expect(result).toEqual({ user: null, error: { message: 'Invalid credentials' } });
  });

  it('signs out and returns no error on success', async () => {
    const client = fakeAuthClient({
      signOut: async () => ({ error: null }),
    });

    expect(await signOut(client)).toEqual({ error: null });
  });

  it('returns the current user when a session exists', async () => {
    const client = fakeAuthClient({
      getCurrentUser: async () => ({
        data: { user: { id: 'user-1', email: 'tony@example.com', emailVerified: true } },
        error: null,
      }),
    });

    expect(await getCurrentUser(client)).toEqual({
      user: { id: 'user-1', email: 'tony@example.com' },
      error: null,
    });
  });

  it('returns a null user with no error when no session exists', async () => {
    const client = fakeAuthClient({
      getCurrentUser: async () => ({ data: { user: null }, error: null }),
    });

    expect(await getCurrentUser(client)).toEqual({ user: null, error: null });
  });

  it('falls back to a generic message when the error has none', async () => {
    const client = fakeAuthClient({
      signInWithPassword: async () => ({ data: null, error: {} }),
    });

    const result = await signInWithPassword(client, { email: 'tony@example.com', password: 'wrong' });

    expect(result.error.message).toBe('Something went wrong. Please try again.');
  });
});

function fakeAuthClient(overrides = {}) {
  return {
    auth: {
      signUp: async () => ({ data: null, error: null }),
      signInWithPassword: async () => ({ data: null, error: null }),
      signOut: async () => ({ error: null }),
      getCurrentUser: async () => ({ data: { user: null }, error: null }),
      ...overrides,
    },
  };
}
