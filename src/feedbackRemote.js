// Feedback capture + admin retrieval. Submitting is a plain RLS-scoped
// insert any signed-in user can do. Reading/triaging all feedback is
// owner-only and goes through the feedback-admin edge function (which uses
// the admin client to bypass RLS), so regular users can never see the
// dashboard.

export const FEEDBACK_CATEGORIES = ['idea', 'bug', 'other'];

export function buildFeedbackRecord(userId, { category, message, pageContext } = {}) {
  if (!userId) {
    throw new Error('You must be signed in to send feedback.');
  }
  if (!FEEDBACK_CATEGORIES.includes(category)) {
    throw new Error(`Unknown feedback category: ${category}`);
  }
  const trimmed = (message ?? '').trim();
  if (!trimmed) {
    throw new Error('Feedback message cannot be empty.');
  }
  return {
    user_id: userId,
    category,
    message: trimmed,
    page_context: pageContext ?? null,
  };
}

export async function submitFeedback(client, userId, input) {
  const record = buildFeedbackRecord(userId, input);
  const { error } = await client.database.from('feedback').insert([record]);
  if (error) {
    throw new Error(error.message ?? 'Could not send feedback.');
  }
}

// Owner-only: the edge function verifies the caller is the configured owner
// before returning anything. The signed-in user's auth header rides along
// automatically via the shared client.
export async function loadAllFeedback(client) {
  const { data } = await client.getHttpClient().post('/functions/feedback-admin', {
    action: 'list',
  });
  return data?.feedback ?? [];
}

export async function updateFeedbackStatus(client, id, status) {
  const { data } = await client.getHttpClient().post('/functions/feedback-admin', {
    action: 'update-status',
    id,
    status,
  });
  return data?.feedback ?? null;
}
