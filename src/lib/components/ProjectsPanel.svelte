<script>
  import WorkspaceTabs from './WorkspaceTabs.svelte';

  export let projects = [];
  export let inboxCount = 0;
  export let waitingCount = 0;
  export let titleDraft = '';
  export let onSubmit;
  export let onDraftInput;
  export let onOpenTask;
  export let onPromote;
  export let onDelete;
  export let onViewChange;
</script>

<section class="projects-panel" aria-labelledby="projects-heading">
  <div class="panel-heading">
    <div>
      <h2 id="projects-heading">Projects</h2>
      <span class="panel-count">{projects.length} ideas on ice</span>
    </div>
    <WorkspaceTabs currentView="projects" {inboxCount} {waitingCount} {onViewChange} />
  </div>
  <p class="panel-note">
    Ideas you want to keep without pretending they are work yet. Stall is for a task you already started and paused.
  </p>

  <form class="new-task-form" on:submit|preventDefault={onSubmit}>
    <label for="project-title">New project idea</label>
    <div class="input-row">
      <input
        id="project-title"
        name="title"
        type="text"
        autocomplete="off"
        placeholder="+ Add a project idea and press Enter"
        bind:value={titleDraft}
        on:input={onDraftInput}
      />
      <button type="submit">Add</button>
    </div>
  </form>

  <ol class="project-list">
    {#each projects as project (project.id)}
      <li class="project-card">
        <button type="button" class="project-title" on:click={() => onOpenTask?.(project.id)}>
          {project.title}
        </button>
        <div class="project-actions">
          <button type="button" class="promote-button" on:click={() => onPromote?.(project.id)}>
            Make it a task
          </button>
          <button type="button" class="delete-button" on:click={() => onDelete?.(project.id)}>
            Delete
          </button>
        </div>
      </li>
    {:else}
      <li class="empty-state">No project ideas yet. Capture one when it shows up.</li>
    {/each}
  </ol>
</section>

<style>
  .projects-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-5);
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--surface);
    backdrop-filter: blur(24px) saturate(1.12);
    -webkit-backdrop-filter: blur(24px) saturate(1.12);
  }

  .panel-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .panel-heading h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--strong);
  }

  .panel-count {
    font-size: 12px;
    color: var(--subtle);
  }

  .panel-note {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--muted);
  }

  .project-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow: auto;
    scrollbar-width: none;
  }

  .project-list::-webkit-scrollbar {
    display: none;
  }

  .project-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--empty-surface);
  }

  .project-title {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--strong);
    font-size: 15px;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
  }

  .project-actions {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
  }

  .promote-button,
  .delete-button {
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--field-surface);
    color: var(--strong);
    font-size: 12px;
  }

  .empty-state {
    padding: 18px 4px;
    color: var(--subtle);
    font-size: 13px;
  }
</style>
