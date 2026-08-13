export async function signUp(client, { email, password }) {
  const { data, error } = await client.auth.signUp({ email, password });
  return {
    user: data?.user ? mapAuthUser(data.user) : null,
    requireEmailVerification: Boolean(data?.requireEmailVerification),
    error: mapAuthError(error),
  };
}

export async function signInWithPassword(client, { email, password }) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  return { user: data?.user ? mapAuthUser(data.user) : null, error: mapAuthError(error) };
}

export async function signOut(client) {
  const { error } = await client.auth.signOut();
  return { error: mapAuthError(error) };
}

export async function getCurrentUser(client) {
  const { data, error } = await client.auth.getCurrentUser();
  return { user: data?.user ? mapAuthUser(data.user) : null, error: mapAuthError(error) };
}

function mapAuthUser(user) {
  return { id: user.id, email: user.email };
}

function mapAuthError(error) {
  if (!error) {
    return null;
  }

  const message = error.message ?? 'Something went wrong. Please try again.';
  if (isUnreachableBackendMessage(message)) {
    return { message: 'Could not reach the server. Try again in a moment.' };
  }

  return { message };
}

function isUnreachableBackendMessage(message) {
  return /internal server error|internal error|fetch failed|bad gateway|could not reach the backend/i.test(
    message,
  );
}
