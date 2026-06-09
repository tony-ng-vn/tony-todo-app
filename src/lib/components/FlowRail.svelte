<script>
  export let completedToday = 0;
</script>

<div class="flow-rail" aria-label="Today progress">
  <output class="done-count" id="done-count" aria-label="Completed today">{completedToday} done today</output>
  <span class="rail-line" aria-hidden="true"></span>
  <span class="rail-caption">Done log</span>
</div>
