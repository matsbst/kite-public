<script lang="ts">
  import { s } from "$lib/client/localization.svelte";
  import { settings } from "$lib/stores/settings.svelte.js";
  import { IconArrowUp } from "@tabler/icons-svelte";
  import { onMount } from "svelte";

  let visible = $state(false);
  let isScrolling = false;
  let scrollStartTime = 0;
  let scrollStartPosition = 0;
  let animationFrame: number | null = null;

  function handleScroll() {
    if (!isScrolling) {
      const scrollY = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      const scrollProgress = scrollY / (scrollHeight - clientHeight);

      // On mobile (window width < 768px), only show when near the end (80% scrolled)
      // On desktop, show after 500px
      const isMobile = window.innerWidth < 768;

      if (isMobile) {
        visible = scrollProgress > 0.8;
      } else {
        visible = scrollY > 500;
      }
    }
  }

  function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function scrollToTop() {
    isScrolling = true;
    scrollStartTime = performance.now();
    scrollStartPosition = window.scrollY;

    const duration = 300; // 300ms for faster scrolling

    function animateScroll(currentTime: number) {
      const elapsed = currentTime - scrollStartTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = easeInOutCubic(progress);

      window.scrollTo(0, scrollStartPosition * (1 - easeProgress));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animateScroll);
      } else {
        isScrolling = false;
        visible = false;
        animationFrame = null;
      }
    }

    animationFrame = requestAnimationFrame(animateScroll);
  }

  onMount(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  });
</script>

{#if settings.categoryHeaderPosition === "bottom"}
  <!-- When header is at bottom on mobile, position button above it -->
  <button
    class="fixed right-8 bottom-8 z-50 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 max-md:right-6 max-md:bottom-20 max-md:h-11 max-md:w-11 dark:border-gray-700 dark:bg-gray-800"
    class:opacity-0={!visible}
    class:invisible={!visible}
    class:opacity-100={visible}
    class:visible
    onclick={scrollToTop}
    aria-label={s("navigation.backToTop")}
    title={s("navigation.backToTop")}
  >
    <IconArrowUp class="h-6 w-6 text-gray-700 dark:text-gray-300" />
  </button>
{:else}
  <!-- When header is at top on mobile, normal positioning -->
  <button
    class="fixed right-8 bottom-8 z-50 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 max-md:right-6 max-md:bottom-6 max-md:h-11 max-md:w-11 dark:border-gray-700 dark:bg-gray-800"
    class:opacity-0={!visible}
    class:invisible={!visible}
    class:opacity-100={visible}
    class:visible
    onclick={scrollToTop}
    aria-label={s("navigation.backToTop")}
    title={s("navigation.backToTop")}
  >
    <IconArrowUp class="h-6 w-6 text-gray-700 dark:text-gray-300" />
  </button>
{/if}
