<script lang="ts">
  import { s } from "$lib/client/localization.svelte";
  import type { Article } from "$lib/types";
  import { getCitedArticlesForText } from "$lib/utils/citationAggregator";
  import {
    replaceWithNumberedCitations,
    type CitationMapping,
  } from "$lib/utils/citationContext";
  import { parseTimelineEvent } from "$lib/utils/textParsing";
  import CitationText from "./CitationText.svelte";

  // Props
  interface Props {
    timeline: Array<any>; // Can be objects with date/description or strings with "::" separator
    articles?: Article[];
    citationMapping?: CitationMapping;
  }

  let { timeline, articles = [], citationMapping }: Props = $props();

  // Parse timeline events and prepare display data
  const displayEvents = $derived.by(() => {
    return timeline.map((event) => {
      const parsed = parseTimelineEvent(event);
      if (citationMapping && parsed.content) {
        return {
          ...parsed,
          content: replaceWithNumberedCitations(
            parsed.content,
            citationMapping,
          ),
        };
      }
      return parsed;
    });
  });
</script>

<section class="mt-6">
  <h3 class="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-200">
    {s("section.timeline") || "Timeline"}
  </h3>
  <div class="timeline">
    {#each displayEvents as event, index}
      {@const eventCitations = getCitedArticlesForText(
        event.content,
        citationMapping,
        articles,
      )}
      <div class="timeline-item">
        <div class="timeline-marker">
          <div class="timeline-dot">
            {index + 1}
          </div>
        </div>
        <div class="timeline-content">
          {#if event.date}
            <div class="timeline-date">
              {event.date}
            </div>
          {/if}
          <div class="timeline-description">
            <CitationText
              text={event.content}
              showFavicons={false}
              showNumbers={false}
              inline={true}
              articles={eventCitations.citedArticles}
              {citationMapping}
            />
          </div>
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  .timeline {
    position: relative;
    padding-left: 0;
  }

  .timeline-item {
    position: relative;
    display: flex;
    padding-bottom: 24px;
  }

  .timeline-item:last-child {
    padding-bottom: 0;
  }

  .timeline-marker {
    position: relative;
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    margin-right: 16px;
  }

  .timeline-dot {
    width: 24px;
    height: 24px;
    background-color: var(--color-header);
    border-radius: 50%;
    position: absolute;
    top: 4px;
    left: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: white;
  }

  .timeline-marker::after {
    content: "";
    position: absolute;
    width: 2px;
    height: calc(100% + 48px);
    background-color: var(--color-header);
    left: 15px;
    top: 28px;
  }

  .timeline-item:last-child .timeline-marker::after {
    display: none;
  }

  .timeline-content {
    flex: 1;
    padding-top: 2px;
    min-height: 70px; /* Ensure consistent height whether date exists or not */
  }

  .timeline-date {
    font-weight: 600;
    margin-bottom: 4px;
    color: var(--color-header);
  }

  .timeline-description {
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  /* Dark mode styles */
  :global(.dark) .timeline-date {
    color: #e5e7eb;
  }

  :global(.dark) .timeline-description {
    color: #d1d5db;
  }
</style>
