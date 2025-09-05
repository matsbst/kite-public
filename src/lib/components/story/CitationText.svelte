<script lang="ts">
  import { s } from "$lib/client/localization.svelte";
  import type { Article } from "$lib/types";
  import type { CitationMapping } from "$lib/utils/citationContext";
  import { getFaviconUrl } from "$lib/utils/citationUtils";
  import type { ParsedTextSegment, Citation } from "$lib/utils/citationUtils";
  import CitationTooltip from "./CitationTooltip.svelte";

  // Props
  interface Props {
    text: string;
    showFavicons?: boolean;
    showNumbers?: boolean;
    inline?: boolean; // Whether to render inline (for list items) or as block (for paragraphs)
    articles?: Article[]; // Articles for citation tooltip
    citationMapping?: CitationMapping; // Global citation mapping
    citationTooltip?: CitationTooltip; // External tooltip reference for shared tooltips
  }

  let {
    text,
    showFavicons = false, // Changed default to false (most common usage)
    showNumbers = false,
    inline = true, // Changed default to true (most common usage)
    articles = [],
    citationMapping,
    citationTooltip: externalTooltip,
  }: Props = $props();

  // Parse text and format citations
  const parsedData = $derived.by(() => {
    // Ensure text is a string
    const textString = typeof text === "string" ? text : String(text || "");

    // Parse citations - text should already have numbered citations if citationMapping is provided
    // Also handle [*] for common knowledge
    const citationPattern = /\[(\d+|\*)\]/g;
    const segments: ParsedTextSegment[] = [];
    const citations: Citation[] = [];
    const citedArticleIndices: number[] = []; // Track which articles are actually cited
    let lastIndex = 0;
    let match;

    while ((match = citationPattern.exec(textString)) !== null) {
      // Add text before citation
      if (match.index > lastIndex) {
        segments.push({
          type: "text",
          content: textString.slice(lastIndex, match.index),
        });
      }

      const citationText = match[1];
      const fullText = match[0];

      // Handle common knowledge citations
      if (citationText === "*") {
        const citation: Citation = {
          id: `citation-common`,
          domain: "common",
          articleId: "common",
          fullText,
          number: -1, // Special marker for common knowledge
        };

        segments.push({
          type: "citation",
          content: fullText,
          citation,
        });

        citations.push(citation);
      } else {
        // Handle numbered citations
        const citationNumber = parseInt(citationText);

        // Get article from citation mapping or fallback to direct index
        let article: Article | undefined;

        if (citationMapping) {
          // Use the citation mapping to get the article
          article = citationMapping.numberToArticle.get(citationNumber);
        } else {
          // Fallback to direct array index
          article = articles[citationNumber - 1];
        }

        if (article) {
          const citation: Citation = {
            id: `citation-${citationNumber}`,
            domain: article.domain,
            articleId: citationNumber.toString(),
            fullText,
            number: citationNumber,
          };

          segments.push({
            type: "citation",
            content: fullText,
            citation,
          });

          citations.push(citation);

          // Find the article index in the articles array
          const articleIndex = articles.indexOf(article);
          if (articleIndex >= 0) {
            citedArticleIndices.push(articleIndex);
          }
        } else {
          // No matching article, treat as text
          segments.push({
            type: "text",
            content: fullText,
          });
        }
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < textString.length) {
      segments.push({
        type: "text",
        content: textString.slice(lastIndex),
      });
    }

    return {
      formattedSegments: segments,
      citations,
      citedArticleIndices,
    };
  });

  // Get unique domains for favicon display
  const uniqueDomains = $derived.by(() => {
    const domains = new Set<string>();
    parsedData.citations.forEach((citation) => {
      if (citation.domain && citation.domain !== "common") {
        domains.add(citation.domain);
      }
    });
    return Array.from(domains);
  });

  // State for showing citation sources
  let showSources = $state(false);

  // Check if any citations are common knowledge
  const hasCommonKnowledge = $derived.by(() => {
    return parsedData.citations.some(
      (citation) => citation.domain === "common",
    );
  });

  // Citation tooltip reference
  let citationTooltip = $state<CitationTooltip | undefined>();

  // Use external tooltip if provided, otherwise use internal one
  const tooltipReference = $derived(externalTooltip || citationTooltip);

  // Get only the articles that are cited in this text with their citation numbers
  const citedArticlesWithNumbers = $derived.by(() => {
    return parsedData.citations.map((citation) => ({
      article:
        citation.domain === "common"
          ? null
          : citationMapping
            ? citationMapping.numberToArticle.get(citation.number!)
            : articles[citation.number! - 1],
      number: citation.number!,
      isCommon: citation.domain === "common",
    })) as Array<{
      article: Article | null;
      number: number;
      isCommon?: boolean;
    }>;
  });

  // Just the articles for backwards compatibility
  const citedArticles = $derived.by(() => {
    return citedArticlesWithNumbers
      .filter(
        (item): item is { article: Article; number: number } => !!item.article,
      )
      .map((item) => item.article);
  });
</script>

<div class="citation-wrapper">
  <!-- Main content -->
  <div class="citation-content {inline ? 'inline' : 'block'}">
    {#if inline}
      <!-- Inline rendering for list items -->
      {#each parsedData.formattedSegments as segment}
        {#if segment.type === "text"}
          {segment.content}
        {:else if segment.type === "citation"}
          {#if showNumbers}
            <span
              class="citation-number cursor-help align-super text-xs text-gray-600 dark:text-gray-400"
              title="Source: {segment.citation?.domain}"
            >
              {segment.content}
            </span>
          {:else}
            <!-- Show as clean numbered citation -->
            <!-- svelte-ignore a11y_mouse_events_have_key_events -->
            <span
              class="citation-number cursor-help rounded px-0.5 align-super text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              title={segment.citation?.domain === "common"
                ? "Common knowledge"
                : `Source ${segment.citation?.number}: ${segment.citation?.domain}`}
              role="button"
              tabindex="0"
              aria-label={segment.citation?.domain === "common"
                ? "Common knowledge citation"
                : `Citation ${segment.citation?.number}: ${segment.citation?.domain}`}
              onmouseover={(e) =>
                tooltipReference?.handleCitationInteraction(
                  e,
                  uniqueDomains,
                  segment.citation?.number,
                )}
              onmouseleave={(e) => tooltipReference?.handleCitationLeave(e)}
              onfocus={() => {}}
              onblur={() => {}}
              onclick={(e) =>
                tooltipReference?.handleCitationInteraction(
                  e,
                  uniqueDomains,
                  segment.citation?.number,
                )}
              onkeydown={(e) =>
                (e.key === "Enter" || e.key === " ") &&
                tooltipReference?.handleCitationInteraction(
                  e,
                  uniqueDomains,
                  segment.citation?.number,
                )}
              ontouchstart={(e) => {
                e.stopPropagation();
                // Record touch time to ignore subsequent mouseover
                if (tooltipReference && "recordTouch" in tooltipReference) {
                  (tooltipReference as any).recordTouch();
                }
              }}
            >
              {segment.content}
            </span>
          {/if}
        {/if}
      {/each}
    {:else}
      <!-- Block rendering for paragraphs -->
      <p class="mb-2">
        {#each parsedData.formattedSegments as segment}
          {#if segment.type === "text"}
            {segment.content}
          {:else if segment.type === "citation"}
            {#if showNumbers}
              <span
                class="citation-number cursor-help align-super text-xs text-gray-600 dark:text-gray-400"
                title="Source: {segment.citation?.domain}"
              >
                {segment.content}
              </span>
            {:else}
              <!-- Show as clean numbered citation -->
              <!-- svelte-ignore a11y_mouse_events_have_key_events -->
              <span
                class="citation-number cursor-help rounded px-0.5 align-super text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                title={segment.citation?.domain === "common"
                  ? "Common knowledge"
                  : `Source ${segment.citation?.number}: ${segment.citation?.domain}`}
                role="button"
                tabindex="0"
                aria-label={segment.citation?.domain === "common"
                  ? "Common knowledge citation"
                  : `Citation ${segment.citation?.number}: ${segment.citation?.domain}`}
                onmouseover={(e) =>
                  tooltipReference?.handleCitationInteraction(
                    e,
                    uniqueDomains,
                    segment.citation?.number,
                  )}
                onmouseleave={(e) => tooltipReference?.handleCitationLeave(e)}
                onclick={(e) =>
                  tooltipReference?.handleCitationInteraction(
                    e,
                    uniqueDomains,
                    segment.citation?.number,
                  )}
                onkeydown={(e) =>
                  (e.key === "Enter" || e.key === " ") &&
                  tooltipReference?.handleCitationInteraction(
                    e,
                    uniqueDomains,
                    segment.citation?.number,
                  )}
                ontouchstart={(e) => {
                  e.stopPropagation();
                  // Record touch time to ignore subsequent mouseover
                  if (tooltipReference && "recordTouch" in tooltipReference) {
                    (tooltipReference as any).recordTouch();
                  }
                }}
              >
                {segment.content}
              </span>
            {/if}
          {/if}
        {/each}
      </p>
    {/if}
  </div>

  <!-- Citation sources with favicons (appears on next line for both inline and block) -->
  {#if showFavicons && uniqueDomains.length > 0}
    <!-- svelte-ignore a11y_mouse_events_have_key_events -->
    <div
      class="citation-sources flex cursor-pointer items-center"
      onmouseover={(e) =>
        tooltipReference?.handleCitationInteraction(e, uniqueDomains)}
      onmouseleave={(e) => tooltipReference?.handleCitationLeave(e)}
      onfocus={() => {}}
      onblur={() => {}}
      onclick={(e) =>
        tooltipReference?.handleCitationInteraction(e, uniqueDomains)}
      onkeydown={(e) =>
        (e.key === "Enter" || e.key === " ") &&
        tooltipReference?.handleCitationInteraction(e, uniqueDomains)}
      ontouchstart={(e) => {
        e.stopPropagation();
        // Record touch time to ignore subsequent mouseover
        if (tooltipReference && "recordTouch" in tooltipReference) {
          (tooltipReference as any).recordTouch();
        }
      }}
      role="button"
      tabindex="0"
      aria-label="View sources: {uniqueDomains.join(', ')}"
    >
      <span class="mr-2 text-xs text-gray-500 dark:text-gray-400">
        {s(uniqueDomains.length === 1 ? "citation.source" : "citation.sources")}
      </span>
      <div class="flex items-center -space-x-3">
        {#each uniqueDomains.slice(0, 5) as domain, index}
          <div
            class="favicon-wrapper relative flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white transition-all hover:z-10 hover:scale-110 dark:border-gray-600 dark:bg-gray-800"
            style="z-index: {5 - index}"
            title={domain}
          >
            <img
              src={getFaviconUrl(domain)}
              alt="{domain} favicon"
              class="h-5 w-5 rounded-full"
              loading="lazy"
            />
          </div>
        {/each}
        {#if uniqueDomains.length > 5}
          <div class="ml-3 text-xs text-gray-500 dark:text-gray-400">
            +{uniqueDomains.length - 5} more
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Numbered citations list (if using numbered format) -->
  {#if showNumbers && parsedData.citations.length > 0 && !inline}
    <button
      class="mt-2 text-xs text-gray-600 hover:underline dark:text-gray-400"
      onclick={() => (showSources = !showSources)}
    >
      {showSources ? "Hide" : "Show"} sources
    </button>

    {#if showSources}
      <div class="citation-list mt-2 text-sm text-gray-600 dark:text-gray-400">
        {#each parsedData.citations as citation, index}
          <div class="citation-item">
            [{index + 1}] {citation.domain}
            {#if citation.domain !== "common"}
              <img
                src={getFaviconUrl(citation.domain)}
                alt="{citation.domain} favicon"
                class="ml-1 inline-block h-3 w-3"
                loading="lazy"
              />
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<!-- Citation Tooltip (only if no external tooltip provided) -->
{#if !externalTooltip}
  <CitationTooltip
    bind:this={citationTooltip}
    articles={citedArticles}
    citationNumbers={citedArticlesWithNumbers.map((item) => item.number)}
    {hasCommonKnowledge}
    citedItems={citedArticlesWithNumbers}
  />
{/if}

<style>
  .citation-wrapper {
    display: block;
  }

  .citation-wrapper:has(.citation-content.inline) {
    display: inline;
  }

  .citation-content {
    display: block;
  }

  .citation-content.inline {
    display: inline;
  }

  .citation-sources {
    margin-top: 0.25rem;
  }

  .citation-number {
    font-weight: 500;
    margin: 0;
    margin-right: -2px;
    letter-spacing: -0.5px;
  }

  .favicon-wrapper {
    transition:
      transform 0.2s,
      z-index 0.2s;
  }

  .citation-list {
    border-left: 2px solid;
    padding-left: 0.75rem;
    margin-top: 0.5rem;
  }

  .citation-item {
    display: flex;
    align-items: center;
    margin-bottom: 0.25rem;
  }
</style>
