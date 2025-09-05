<script lang="ts">
  import { browser } from "$app/environment";
  import { s } from "$lib/client/localization.svelte";
  import {
    useFloating,
    offset,
    flip,
    shift,
  } from "@skeletonlabs/floating-ui-svelte";
  import Portal from "svelte-portal";
  import { fade } from "svelte/transition";

  interface Props {
    show: boolean;
    referenceElement: HTMLElement | null;
  }

  let { show, referenceElement }: Props = $props();

  let localShowTooltip = $state(false);
  let timeoutId: NodeJS.Timeout | null = null;
  let hasBeenShown = $state(false);

  // Floating UI setup for tooltip
  const floating = useFloating({
    placement: "bottom",
    strategy: "absolute",
    middleware: [
      offset(8), // 8px gap from button
      flip(), // Flip if no space
      shift({ padding: 8 }), // Keep within viewport
    ],
  });

  // Track tooltip visibility
  $effect(() => {
    if (show && !localShowTooltip && !hasBeenShown) {
      console.log("Showing temporary category tooltip");
      localShowTooltip = true;
      hasBeenShown = true;

      // Clear any existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Auto-dismiss after 3 seconds
      timeoutId = setTimeout(() => {
        console.log("Auto-dismissing tooltip after 3 seconds");
        localShowTooltip = false;
        timeoutId = null;
      }, 3000);
    } else if (!show && localShowTooltip) {
      console.log("Hiding temporary category tooltip");
      localShowTooltip = false;

      // Clear timeout if tooltip is being hidden externally
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  });

  // Update floating reference when tooltip should show
  $effect(() => {
    if (localShowTooltip && referenceElement && browser) {
      // Manually set the reference element
      floating.elements.reference = referenceElement;
      floating.update();
    }
  });
</script>

<!-- Temporary category tooltip -->
{#if localShowTooltip && referenceElement && browser}
  <Portal>
    <div
      bind:this={floating.elements.floating}
      class="pointer-events-none absolute top-0 left-0 z-[70] {floating.isPositioned
        ? 'opacity-100'
        : 'invisible opacity-0'}"
      style={floating.floatingStyles}
      transition:fade={{ duration: 200 }}
    >
      <!-- Arrow pointing up -->
      <div
        class="absolute -top-2 left-1/2 h-0 w-0 -translate-x-1/2
				border-r-[6px] border-b-[8px]
				border-l-[6px] border-r-transparent
				border-b-gray-800 border-l-transparent dark:border-b-gray-700"
      ></div>

      <!-- Tooltip content -->
      <div
        class="max-w-xs rounded-md bg-gray-800 px-3 py-2 text-xs text-white shadow-lg dark:bg-gray-700"
      >
        <p class="whitespace-nowrap">
          {s("app.temporaryCategoryNotice") ||
            "Temporarily showing this category from shared link"}
        </p>
      </div>
    </div>
  </Portal>
{/if}
