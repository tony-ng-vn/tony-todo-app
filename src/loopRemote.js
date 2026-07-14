const INBOX_SELECT_COLUMNS = 'id,title,loop_type,confidence,priority_label,why_priority';
const WAITING_SELECT_COLUMNS = 'id,title,loop_type,created_at';
const EVIDENCE_SELECT_COLUMNS = 'todo_id,source_app,author,excerpt';

export async function loadInboxLoops(client, userId) {
  const { data: todos, error: todosError } = await client.database
    .from('todos')
    .select(INBOX_SELECT_COLUMNS)
    .eq('user_id', userId)
    .eq('loop_status', 'inbox');
  throwIfError(todosError);

  const evidenceByTodoId = await loadEvidenceByTodoId(client, userId, todos);

  return todos.map((todo) => ({
    id: todo.id,
    title: todo.title,
    loopType: todo.loop_type,
    confidence: todo.confidence,
    priorityLabel: todo.priority_label,
    whyPriority: todo.why_priority,
    evidence: evidenceByTodoId.get(todo.id) ?? { sourceApp: null, author: null, excerpt: '' },
  }));
}

export async function loadWaitingLoops(client, userId) {
  const { data: todos, error: todosError } = await client.database
    .from('todos')
    .select(WAITING_SELECT_COLUMNS)
    .eq('user_id', userId)
    .eq('loop_type', 'waiting')
    .is('completed_at', null);
  throwIfError(todosError);

  const evidenceByTodoId = await loadEvidenceByTodoId(client, userId, todos);

  return todos.map((todo) => {
    const evidence = evidenceByTodoId.get(todo.id);
    return {
      id: todo.id,
      title: todo.title,
      counterpartyName: evidence?.author || 'Someone else',
      createdAt: todo.created_at,
      dueAt: todo.due_at ?? null,
      evidence: { sourceApp: evidence?.sourceApp ?? null, excerpt: evidence?.excerpt ?? '' },
    };
  });
}

export async function acceptLoop(client, userId, loopId) {
  await updateLoopStatus(client, userId, loopId, 'accepted');
}

export async function dismissLoop(client, userId, loopId) {
  await updateLoopStatus(client, userId, loopId, 'dismissed');
}

async function updateLoopStatus(client, userId, loopId, loopStatus) {
  const { error } = await client.database
    .from('todos')
    .update({ loop_status: loopStatus })
    .eq('id', loopId)
    .eq('user_id', userId);
  throwIfError(error);
}

async function loadEvidenceByTodoId(client, userId, todos) {
  const map = new Map();
  if (!todos.length) {
    return map;
  }

  const { data: evidenceRows, error } = await client.database
    .from('evidence')
    .select(EVIDENCE_SELECT_COLUMNS)
    .eq('user_id', userId);
  throwIfError(error);

  for (const row of evidenceRows ?? []) {
    if (!map.has(row.todo_id)) {
      map.set(row.todo_id, { sourceApp: row.source_app, author: row.author, excerpt: row.excerpt });
    }
  }

  return map;
}

function throwIfError(error) {
  if (error) {
    throw error;
  }
}
