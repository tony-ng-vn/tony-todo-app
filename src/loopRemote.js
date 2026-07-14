const INBOX_SELECT_COLUMNS = 'id,title,loop_type,confidence,priority_label,why_priority';
const WAITING_SELECT_COLUMNS = 'id,title,loop_type,created_at';
const DISMISSED_SELECT_COLUMNS = 'id,title,loop_type,priority_label,updated_at';
const EVIDENCE_SELECT_COLUMNS = 'todo_id,source_app,author,excerpt';
const MEETING_EVIDENCE_SELECT_COLUMNS = 'todo_id,source_object_id,source_title,occurred_at,author';
const MEETING_LOOP_SELECT_COLUMNS = 'id,title,loop_status,priority_label';

export async function loadInboxLoops(client, userId, now = new Date()) {
  const { data: todos, error: todosError } = await client.database
    .from('todos')
    .select(INBOX_SELECT_COLUMNS)
    .eq('user_id', userId)
    .eq('loop_status', 'inbox')
    .or(`next_review_at.is.null,next_review_at.lte.${now.toISOString()}`);
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

export async function loadDismissedLoops(client, userId) {
  const { data: todos, error: todosError } = await client.database
    .from('todos')
    .select(DISMISSED_SELECT_COLUMNS)
    .eq('user_id', userId)
    .eq('loop_status', 'dismissed')
    .order('updated_at', { ascending: false });
  throwIfError(todosError);

  const evidenceByTodoId = await loadEvidenceByTodoId(client, userId, todos);

  return todos.map((todo) => ({
    id: todo.id,
    title: todo.title,
    loopType: todo.loop_type,
    priorityLabel: todo.priority_label,
    updatedAt: todo.updated_at,
    evidence: evidenceByTodoId.get(todo.id) ?? { sourceApp: null, author: null, excerpt: '' },
  }));
}

export async function loadAuditLog(client, userId, limit = 20) {
  const { data, error } = await client.database
    .from('audit_log')
    .select('id,action_type,loop_id,model,summary,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  throwIfError(error);

  return (data ?? []).map((row) => ({
    id: row.id,
    actionType: row.action_type,
    loopId: row.loop_id,
    model: row.model,
    summary: row.summary,
    createdAt: row.created_at,
  }));
}

export async function loadSyncStatus(client, userId) {
  const { data, error } = await client.database
    .from('ingestion_cursor')
    .select('source,last_synced_at')
    .eq('user_id', userId);
  throwIfError(error);

  return (data ?? []).map((row) => ({ source: row.source, lastSyncedAt: row.last_synced_at }));
}

export async function loadMeetings(client, userId) {
  const { data: evidenceRows, error: evidenceError } = await client.database
    .from('evidence')
    .select(MEETING_EVIDENCE_SELECT_COLUMNS)
    .eq('user_id', userId)
    .order('occurred_at', { ascending: false });
  throwIfError(evidenceError);

  const { data: todos, error: todosError } = await client.database
    .from('todos')
    .select(MEETING_LOOP_SELECT_COLUMNS)
    .eq('user_id', userId);
  throwIfError(todosError);

  const todoById = new Map((todos ?? []).map((todo) => [todo.id, todo]));
  const meetingsById = new Map();

  for (const row of evidenceRows ?? []) {
    if (!meetingsById.has(row.source_object_id)) {
      meetingsById.set(row.source_object_id, {
        sourceObjectId: row.source_object_id,
        title: row.source_title,
        occurredAt: row.occurred_at,
        author: row.author,
        loops: [],
      });
    }

    const todo = todoById.get(row.todo_id);
    if (todo) {
      meetingsById.get(row.source_object_id).loops.push({
        id: todo.id,
        title: todo.title,
        loopStatus: todo.loop_status,
        priorityLabel: todo.priority_label,
      });
    }
  }

  return Array.from(meetingsById.values());
}

export async function acceptLoop(client, userId, loopId, now = new Date()) {
  await updateLoopStatus(client, userId, loopId, 'accepted', now);
}

export async function dismissLoop(client, userId, loopId, now = new Date()) {
  await updateLoopStatus(client, userId, loopId, 'dismissed', now);
}

export async function restoreLoop(client, userId, loopId, now = new Date()) {
  await updateLoopStatus(client, userId, loopId, 'inbox', now);
}

export async function snoozeLoop(client, userId, loopId, until) {
  const { error } = await client.database
    .from('todos')
    .update({ next_review_at: until.toISOString(), loop_status: 'inbox' })
    .eq('id', loopId)
    .eq('user_id', userId);
  throwIfError(error);
}

async function updateLoopStatus(client, userId, loopId, loopStatus, now) {
  const { error } = await client.database
    .from('todos')
    .update({ loop_status: loopStatus, updated_at: now.toISOString() })
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
