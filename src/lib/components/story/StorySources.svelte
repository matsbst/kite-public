<script lang="ts">
  import { s } from "$lib/client/localization.svelte";
  import FaviconImage from "$lib/components/common/FaviconImage.svelte";
  import { dataService } from "$lib/services/dataService";
  import { dataLanguage } from "$lib/stores/dataLanguage.svelte";
  import type { MediaInfo } from "$lib/types";
  import { getTimeAgo, getMostRecentArticleDate } from "$lib/utils/getTimeAgo";

  // Props
  interface Props {
    domains: any[];
    articles: any[];
    showSourceOverlay?: boolean;
    currentSource?: any;
    sourceArticles?: any[];
    currentMediaInfo?: MediaInfo | null;
    isLoadingMediaInfo?: boolean;
  }

  let {
    domains,
    articles,
    showSourceOverlay = $bindable(false),
    currentSource = $bindable(null),
    sourceArticles = $bindable([]),
    currentMediaInfo = $bindable(null),
    isLoadingMediaInfo = $bindable(false),
  }: Props = $props();

  // Sort domains to ensure Reddit always appears last
  let sortedDomains = $derived.by(() => {
    if (!domains || domains.length === 0) return [];
    
    // Separate Reddit domains from others
    const redditDomains = domains.filter(d => 
      d?.name?.toLowerCase().includes('reddit.com')
    );
    const nonRedditDomains = domains.filter(d => 
      !d?.name?.toLowerCase().includes('reddit.com')
    );
    
    // Concatenate with Reddit at the end
    return [...nonRedditDomains, ...redditDomains];
  });

  // State
  let showAllSources = $state(false);
  let visibleSources = $state(
    typeof window !== "undefined" && window.innerWidth <= 768 ? 4 : 8,
  );

  // Handle window resize
  if (typeof window !== "undefined") {
    window.addEventListener("resize", () => {
      visibleSources = window.innerWidth <= 768 ? 4 : 8;
    });
  }

  // Calculate publisher and article counts
  let publisherCount = $derived(sortedDomains.length);
  let totalArticleCount = $derived(articles?.length || 0);

  // Handle source click
  async function handleSourceClick(domain: any) {
    currentSource = domain;
    sourceArticles = articles.filter((a) => a.domain === domain?.name) || [];
    currentMediaInfo = null;
    isLoadingMediaInfo = true;

    // Fetch media info for this specific domain
    if (domain?.name) {
      try {
        const mediaInfo = await dataService.loadMediaDataForHost(
          domain.name,
          dataLanguage.current,
        );
        currentMediaInfo = mediaInfo;
      } catch (error) {
        console.error(
          "Failed to load media info for domain:",
          domain.name,
          error,
        );
        currentMediaInfo = null;
      }
    }

    isLoadingMediaInfo = false;
    showSourceOverlay = true;
  }
</script>

<section class="mt-6">
  <div class="mb-4 flex items-center justify-between">
    <div>
      <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-200">
        {s("section.sources") || "Sources"}
      </h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {s("sources.summary", { publishers: publisherCount.toString(), articles: totalArticleCount.toString() })}
      </p>
    </div>
    {#if sortedDomains.length > visibleSources}
      <button
        onclick={() => (showAllSources = !showAllSources)}
        class="text-gray-600 hover:text-gray-800 focus-visible-ring dark:text-gray-400 dark:hover:text-gray-200"
        aria-label={showAllSources ? "Show fewer sources" : "Show all sources"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="ml-1 inline-block h-5 w-5 transform transition-transform duration-200"
          class:rotate-180={showAllSources}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    {/if}
  </div>

  <div
    class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
  >
    {#each sortedDomains as domain, index}
      {#if index < visibleSources || showAllSources}
        <button
          class="flex w-full flex-col items-start space-y-1 rounded-lg py-2 pl-2 text-left transition-colors hover:bg-gray-100 focus-visible-ring dark:hover:bg-gray-700"
          onclick={() => handleSourceClick(domain)}
          aria-label={`Show articles from ${domain?.name || "Unknown"}`}
          title={`Show articles from ${domain?.name || "Unknown"}`}
        >
          <div class="flex w-full min-w-0 items-center space-x-2">
            <FaviconImage
              domain={domain?.name || ""}
              alt={domain?.name ? `${domain.name} Favicon` : "Default Favicon"}
              class="h-5 w-5 rounded-full"
              loading="lazy"
            />
            <span class="truncate text-sm font-semibold">
              {domain?.name || "Unknown"}
            </span>
          </div>
          <span class="ml-7 text-xs text-gray-500 dark:text-gray-400">
            {#if articles}
              {@const articleCount = articles.filter(
                (a) => a.domain === domain?.name,
              ).length}
              {@const mostRecentDate = getMostRecentArticleDate(
                articles,
                domain?.name,
              )}
              {#if mostRecentDate && articleCount > 0}
                {getTimeAgo(mostRecentDate)} · {articleCount === 1
                  ? s("sources.article", { count: articleCount.toString() })
                  : s("sources.articles", { count: articleCount.toString() })}
              {:else}
                {articleCount === 1
                  ? s("sources.article", { count: articleCount.toString() })
                  : s("sources.articles", { count: articleCount.toString() })}
              {/if}
            {:else}
              {s("sources.articles", { count: "0" })}
            {/if}
          </span>
        </button>
      {/if}
    {/each}
  </div>
</section>
