<script lang="ts">
  import { s } from "$lib/client/localization.svelte";
  import Select from "$lib/components/Select.svelte";
  import { fontSize, type FontSize } from "$lib/stores/fontSize.svelte.js";
  import {
    settings,
    type StoryExpandMode,
  } from "$lib/stores/settings.svelte.js";
  import { theme } from "$lib/stores/theme.svelte.js";
  import DataLanguageSelector from "./snippets/DataLanguageSelector.svelte";
  import LanguageSelector from "./snippets/LanguageSelector.svelte";
  import StoryCountSlider from "./snippets/StoryCountSlider.svelte";
  import ThemeSelector from "./snippets/ThemeSelector.svelte";

  // Props
  interface Props {
    onShowAbout?: () => void;
  }

  let { onShowAbout }: Props = $props();

  // Font size options for display
  const fontSizeOptions = $derived([
    { value: "xs", label: s("settings.fontSize.xs") || "Extra Small" },
    { value: "small", label: s("settings.fontSize.small") || "Small" },
    { value: "normal", label: s("settings.fontSize.normal") || "Normal" },
    { value: "large", label: s("settings.fontSize.large") || "Large" },
    { value: "xl", label: s("settings.fontSize.xl") || "Extra Large" },
  ]);

  // Story expand mode options for display
  const storyExpandModeOptions = $derived([
    {
      value: "always",
      label: s("settings.storyExpandMode.always") || "Always expand all",
    },
    {
      value: "doubleClick",
      label:
        s("settings.storyExpandMode.doubleClick") ||
        "Double-click to expand all",
    },
    {
      value: "never",
      label: s("settings.storyExpandMode.never") || "Never expand all",
    },
  ]);

  // Local state that syncs with stores
  let currentFontSize = $state(fontSize.current as string);
  let currentCategoryHeaderPosition = $state(
    settings.categoryHeaderPosition as string,
  );
  let currentStoryExpandMode = $state(settings.storyExpandMode as string);
  let currentUseLatestUrls = $state(settings.useLatestUrls);

  // Sync local state with stores
  $effect(() => {
    currentFontSize = fontSize.current as string;
  });

  $effect(() => {
    currentCategoryHeaderPosition = settings.categoryHeaderPosition as string;
  });

  $effect(() => {
    currentStoryExpandMode = settings.storyExpandMode as string;
  });

  $effect(() => {
    currentUseLatestUrls = settings.useLatestUrls;
  });

  // Font size change handler
  function handleFontSizeChange(newSize: string) {
    fontSize.set(newSize as FontSize);
    currentFontSize = newSize;
  }

  // Category header position change handler
  function handleCategoryHeaderPositionChange(position: string) {
    settings.setCategoryHeaderPosition(position as any);
    currentCategoryHeaderPosition = position;
  }

  function handleStoryExpandModeChange(mode: StoryExpandMode) {
    settings.setStoryExpandMode(mode);
    currentStoryExpandMode = mode;
  }

  function handleUseLatestUrlsChange(value: string) {
    const enabled = value === "enabled";
    settings.setUseLatestUrls(enabled);
    currentUseLatestUrls = enabled;
  }

  // Show about screen
  function showAbout() {
    if (onShowAbout) onShowAbout();
  }
</script>

<div class="space-y-6">
  <!-- Theme Setting -->
  <ThemeSelector />

  <!-- UI Language Setting -->
  <LanguageSelector showTooltip={true} showLoadingSpinner={true} />

  <!-- Data Language Setting -->
  <DataLanguageSelector
    showTooltip={true}
    showLoadingSpinner={true}
    showTranslateLink={true}
  />

  <!-- Mobile-only category header position setting -->
  <div class="flex flex-col space-y-2 md:hidden">
    <Select
      bind:value={currentCategoryHeaderPosition}
      options={[
        {
          value: "bottom",
          label: s("settings.categoryHeaderPosition.bottom") || "Bottom",
        },
        {
          value: "top",
          label: s("settings.categoryHeaderPosition.top") || "Top",
        },
      ]}
      label={s("settings.categoryHeaderPosition.label") ||
        "Category Header Position"}
      onChange={handleCategoryHeaderPositionChange}
    />
    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
      {s("settings.categoryHeaderPosition.description") ||
        "Choose where category tabs appear on mobile devices"}
    </p>
  </div>

  <!-- Font Size Setting -->
  <div class="flex flex-col space-y-2">
    <Select
      bind:value={currentFontSize}
      options={fontSizeOptions}
      label={s("settings.fontSize.label") || "Text Size"}
      onChange={handleFontSizeChange}
    />
  </div>

  <!-- Story Expand Mode Setting -->
  <div class="flex flex-col space-y-2">
    <Select
      bind:value={currentStoryExpandMode}
      options={storyExpandModeOptions}
      label={s("settings.storyExpandMode.label") || "Story Expand Mode"}
      onChange={handleStoryExpandModeChange}
    />
    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
      {s("settings.storyExpandMode.description") ||
        "Choose how stories expand in a category"}
    </p>
  </div>

  <!-- Use Latest URLs Setting -->
  <div class="flex flex-col space-y-2">
    <Select
      value={currentUseLatestUrls ? "enabled" : "disabled"}
      options={[
        {
          value: "enabled",
          label: s("settings.useLatestUrls.enabled") || "Enabled",
        },
        {
          value: "disabled",
          label: s("settings.useLatestUrls.disabled") || "Disabled",
        },
      ]}
      label={s("settings.useLatestUrls.label") || "Use Latest URLs"}
      onChange={handleUseLatestUrlsChange}
    />
    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
      {s("settings.useLatestUrls.description") ||
        "Use /latest URLs for current news so bookmarks always show the latest content"}
    </p>
  </div>

  <!-- Story Count Setting -->
  <StoryCountSlider />

  <!-- About Button -->
  <div class="flex flex-col space-y-2">
    <button
      onclick={showAbout}
      class="flex w-full items-center justify-center space-x-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 transition-colors duration-200 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
    >
      <img
        src={theme.current === "dark"
          ? "/svg/kagi_news_icon_dark.svg"
          : "/svg/kagi_news_icon.svg"}
        alt={s("app.logo.iconAlt") || "Kite"}
        class="h-4 w-4"
      />
      <span>{s("settings.aboutKite.button") || "About Kite"}</span>
    </button>
  </div>
</div>
