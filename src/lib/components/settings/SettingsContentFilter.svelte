<script lang="ts">
  import { s } from "$lib/client/localization.svelte";
  import Select from "$lib/components/Select.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import { contentFilter } from "$lib/stores/contentFilter.svelte";
  import { dataLanguage } from "$lib/stores/dataLanguage.svelte";
  import {
    IconX,
    IconPlus,
    IconCheck,
    IconInfoCircle,
    IconDownload,
    IconUpload,
  } from "@tabler/icons-svelte";

  // State
  let newKeyword = $state("");
  let inputElement = $state<HTMLInputElement>();
  let previousLanguage = $state(dataLanguage.current);
  let showResetConfirm = $state(false);
  let resetButtonElement = $state<HTMLButtonElement>();
  let showImportConfirm = $state(false);
  let importButtonElement = $state<HTMLButtonElement>();
  let fileInputElement = $state<HTMLInputElement>();
  let importWarning = $state<string | undefined>();
  let pendingImportData = $state<string | undefined>();

  // Update keywords when data language changes
  $effect(() => {
    if (previousLanguage !== dataLanguage.current) {
      previousLanguage = dataLanguage.current;
      contentFilter.updateLanguage(dataLanguage.current);
    }
  });

  // Get localized preset labels and tooltips
  const localizedPresets = $derived(
    contentFilter.presets.map((preset) => {
      // Try to get translated label, fall back to original
      const translatedLabel = s(`settings.contentFilter.preset.${preset.id}`);
      const label =
        translatedLabel !== `settings.contentFilter.preset.${preset.id}`
          ? translatedLabel
          : preset.label;

      // Only show tooltip if we have a translation for it
      const tooltipKey = `settings.contentFilter.preset.${preset.id}.tooltip`;
      const translatedTooltip = s(tooltipKey);
      const tooltip =
        translatedTooltip !== tooltipKey ? translatedTooltip : null;

      return {
        ...preset,
        label,
        tooltip,
      };
    }),
  );

  // Add keyword
  function addKeyword() {
    if (!newKeyword.trim()) return;

    // Split by commas and add all keywords
    const keywords = newKeyword
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k);
    keywords.forEach((k) => contentFilter.addCustomKeyword(k));
    newKeyword = "";

    // Focus back on input
    inputElement?.focus();
  }

  // Handle enter key
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      addKeyword();
    }
  }

  // Reset to defaults
  function resetToDefaults() {
    contentFilter.reset();
    showResetConfirm = false;
  }

  // Handle clicks outside reset confirm
  function handleOutsideClick(event: MouseEvent) {
    if (
      showResetConfirm &&
      resetButtonElement &&
      !resetButtonElement.contains(event.target as Node)
    ) {
      const confirmEl = document.getElementById("reset-confirm-popup");
      if (confirmEl && !confirmEl.contains(event.target as Node)) {
        showResetConfirm = false;
      }
    }
  }

  // Listen for outside clicks
  $effect(() => {
    if (showResetConfirm) {
      document.addEventListener("click", handleOutsideClick);
      return () => document.removeEventListener("click", handleOutsideClick);
    }
  });

  // Helper to get keywords for a preset in the current language
  function getPresetKeywords(preset: any): string[] {
    if (Array.isArray(preset.keywords)) {
      return preset.keywords;
    }
    return (
      preset.keywords[dataLanguage.current] ||
      preset.keywords["default"] ||
      preset.keywords["en"] ||
      []
    );
  }

  // Check if we have custom keywords (not from presets)
  const customKeywords = $derived.by(() => {
    // Get all keywords from active presets
    const presetKeywords = new Set<string>();
    contentFilter.activePresets.forEach((presetId) => {
      const preset = contentFilter.presets.find((p) => p.id === presetId);
      if (preset) {
        const keywords = getPresetKeywords(preset);
        keywords.forEach((k) => presetKeywords.add(k));
      }
    });

    // Return keywords that are not from presets
    return contentFilter.keywords.filter((k) => !presetKeywords.has(k));
  });

  // Export configuration
  function exportConfig() {
    const config = contentFilter.exportConfig();
    const blob = new Blob([config], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kite-content-filters-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Handle file selection
  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      // Pre-validate the import
      const result = contentFilter.importConfig(content);
      if (result.errorKey) {
        alert(s(result.errorKey) || result.errorKey);
        return;
      }

      // Store the data and show confirmation
      pendingImportData = content;
      importWarning = result.warningKey
        ? s(result.warningKey) || result.warningKey
        : undefined;
      showImportConfirm = true;
    };
    reader.readAsText(file);
  }

  // Confirm import
  function confirmImport() {
    if (pendingImportData) {
      contentFilter.importConfig(pendingImportData);
      showImportConfirm = false;
      pendingImportData = undefined;
      importWarning = undefined;
      // Reset file input
      if (fileInputElement) fileInputElement.value = "";
    }
  }

  // Handle clicks outside import confirm
  function handleImportOutsideClick(event: MouseEvent) {
    if (
      showImportConfirm &&
      importButtonElement &&
      !importButtonElement.contains(event.target as Node)
    ) {
      const confirmEl = document.getElementById("import-confirm-popup");
      if (confirmEl && !confirmEl.contains(event.target as Node)) {
        showImportConfirm = false;
        pendingImportData = undefined;
        importWarning = undefined;
        if (fileInputElement) fileInputElement.value = "";
      }
    }
  }

  // Listen for import outside clicks
  $effect(() => {
    if (showImportConfirm) {
      document.addEventListener("click", handleImportOutsideClick);
      return () =>
        document.removeEventListener("click", handleImportOutsideClick);
    }
  });
</script>

<div class="space-y-6">
  <!-- Tab Description -->
  <div class="text-sm text-gray-600 dark:text-gray-400">
    {s("settings.contentFilter.tab.description") ||
      "Customize your news feed by filtering out topics you prefer not to see. Use presets for common filters or create your own custom keywords."}
  </div>

  <!-- Preset Filters -->
  <div>
    <div class="mb-1 flex items-center justify-between">
      <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">
        {s("settings.contentFilter.presets.label") || "Filter Presets"}
      </h3>
      <a
        href="https://github.com/kagisearch/kite-public"
        target="_blank"
        class="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
      >
        {s("settings.contentFilter.contribute") || "Add more filters"}
      </a>
    </div>
    <p class="mt-0.5 mb-3 text-sm text-gray-500 dark:text-gray-400">
      {s("settings.contentFilter.presets.description") ||
        "Select one or more preset filters to quickly hide common topics"}
    </p>
    <div class="grid grid-cols-2 gap-2">
      {#each localizedPresets as preset}
        <div class="relative">
          <button
            onclick={() =>
              contentFilter.togglePreset(preset.id, dataLanguage.current)}
            class="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors
							{contentFilter.isPresetActive(preset.id)
              ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}"
          >
            <span class="flex items-center gap-2">
              {preset.label}
              {#if preset.tooltip}
                <Tooltip text={preset.tooltip} position="top">
                  <IconInfoCircle
                    size={14}
                    class="text-gray-400 dark:text-gray-500"
                  />
                </Tooltip>
              {/if}
            </span>
            {#if contentFilter.isPresetActive(preset.id)}
              <IconCheck size={16} />
            {/if}
          </button>
        </div>
      {/each}
    </div>
  </div>

  <!-- Custom Keywords Input -->
  <div>
    <label
      for="keyword-input"
      class="text-base font-medium text-gray-900 dark:text-gray-100"
    >
      {s("settings.contentFilter.keywords.label") || "Custom Keywords"}
    </label>
    <p class="mt-0.5 mb-2 text-sm text-gray-500 dark:text-gray-400">
      {s("settings.contentFilter.keywords.description") ||
        "Add your own keywords to filter, separated by commas"}
    </p>
    <div class="flex gap-2">
      <input
        bind:this={inputElement}
        id="keyword-input"
        type="text"
        bind:value={newKeyword}
        onkeydown={handleKeydown}
        placeholder={s("settings.contentFilter.keywords.placeholder") ||
          "e.g., celebrity name, topic"}
        class="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:bg-gray-700"
      />
      <button
        onclick={addKeyword}
        disabled={!newKeyword.trim()}
        class="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-gray-600"
      >
        <IconPlus size={20} />
      </button>
    </div>
  </div>

  <!-- Active Filters -->
  {#if contentFilter.keywords.length > 0}
    <div>
      <h4 class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {s("settings.contentFilter.activeFilters") || "Active Filters"}
      </h4>

      <!-- Preset Keywords (grouped by preset) -->
      {#each contentFilter.activePresets as presetId}
        {@const preset = localizedPresets.find((p) => p.id === presetId)}
        {#if preset}
          <div class="mb-3">
            <div class="mb-1 text-xs text-gray-500 dark:text-gray-400">
              {preset.label}:
            </div>
            <div class="flex flex-wrap gap-2">
              {#each getPresetKeywords(preset) as keyword}
                <span
                  class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                >
                  {keyword}
                </span>
              {/each}
            </div>
          </div>
        {/if}
      {/each}

      <!-- Custom Keywords -->
      {#if customKeywords.length > 0}
        <div class="mb-3">
          <div class="mb-1 text-xs text-gray-500 dark:text-gray-400">
            {s("settings.contentFilter.customKeywords") || "Custom"}:
          </div>
          <div class="flex flex-wrap gap-2">
            {#each customKeywords as keyword}
              <span
                class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              >
                {keyword}
                <button
                  onclick={() => contentFilter.removeKeyword(keyword)}
                  class="ml-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  aria-label="Remove {keyword}"
                >
                  <IconX size={16} />
                </button>
              </span>
            {/each}
          </div>
        </div>
      {/if}

      <button
        onclick={() => contentFilter.clearKeywords()}
        class="mt-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
      >
        {s("settings.contentFilter.clearAll") || "Clear all filters"}
      </button>
    </div>
  {/if}

  <!-- Filter Mode -->
  <fieldset>
    <legend class="text-base font-medium text-gray-900 dark:text-gray-100">
      {s("settings.contentFilter.mode.label") || "Filter Mode"}
    </legend>
    <p class="mt-0.5 mb-2 text-sm text-gray-500 dark:text-gray-400">
      {s("settings.contentFilter.mode.description") ||
        "Choose how filtered content is handled"}
    </p>
    <div class="space-y-2">
      <label class="flex items-start">
        <input
          type="radio"
          name="filter-mode"
          value="hide"
          checked={contentFilter.filterMode === "hide"}
          onchange={() => contentFilter.setFilterMode("hide")}
          class="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
        />
        <div class="ml-3">
          <span
            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {s("settings.contentFilter.mode.hide") || "Hide completely"}
          </span>
          <span class="block text-sm text-gray-500 dark:text-gray-400">
            {s("settings.contentFilter.mode.hideDescription") ||
              "Filtered stories are removed from view"}
          </span>
        </div>
      </label>
      <label class="flex items-start">
        <input
          type="radio"
          name="filter-mode"
          value="blur"
          checked={contentFilter.filterMode === "blur"}
          onchange={() => contentFilter.setFilterMode("blur")}
          class="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
        />
        <div class="ml-3">
          <span
            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {s("settings.contentFilter.mode.blur") || "Blur with warning"}
          </span>
          <span class="block text-sm text-gray-500 dark:text-gray-400">
            {s("settings.contentFilter.mode.blurDescription") ||
              "Stories are blurred and can be revealed on click"}
          </span>
        </div>
      </label>
    </div>
  </fieldset>

  <!-- Filter Scope -->
  <div class="space-y-2">
    <Select
      value={contentFilter.filterScope}
      options={[
        {
          value: "title",
          label: s("settings.contentFilter.scope.title") || "Title only",
        },
        {
          value: "summary",
          label:
            s("settings.contentFilter.scope.summary") || "Title and summary",
        },
        {
          value: "all",
          label: s("settings.contentFilter.scope.all") || "All content",
        },
      ]}
      label={s("settings.contentFilter.scope.label") || "Filter Scope"}
      onChange={(value: string) =>
        contentFilter.setFilterScope(value as "title" | "summary" | "all")}
    />
    <p class="text-sm text-gray-500 dark:text-gray-400">
      {s("settings.contentFilter.scope.description") ||
        "Choose which parts of stories to check for keywords"}
    </p>
  </div>

  <!-- Show Filtered Count -->
  <div class="flex items-center justify-between">
    <div>
      <label
        for="show-count"
        class="text-base font-medium text-gray-900 dark:text-gray-100"
      >
        {s("settings.contentFilter.showCount.label") || "Show Filtered Count"}
      </label>
      <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
        {s("settings.contentFilter.showCount.description") ||
          "Display number of filtered stories in each category"}
      </p>
    </div>
    <label class="relative inline-flex cursor-pointer items-center">
      <input
        id="show-count"
        type="checkbox"
        class="peer sr-only"
        checked={contentFilter.showFilteredCount}
        onchange={(e) =>
          contentFilter.setShowFilteredCount(e.currentTarget.checked)}
      />
      <div
        class="peer h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-gray-700 dark:peer-checked:bg-blue-500"
      ></div>
    </label>
  </div>

  <!-- Export/Import Section -->
  <div class="border-t border-gray-200 pt-4 dark:border-gray-700">
    <h4 class="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
      {s("settings.contentFilter.exportImport.title") || "Backup & Restore"}
    </h4>
    <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">
      {s("settings.contentFilter.exportImport.description") ||
        "Export your filter settings to a file or import from a previous backup"}
    </p>
    <div class="relative flex gap-3">
      <button
        onclick={exportConfig}
        class="flex items-center gap-2 rounded-md bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
      >
        <IconDownload size={16} />
        {s("settings.contentFilter.export") || "Export Settings"}
      </button>
      <button
        bind:this={importButtonElement}
        onclick={() => fileInputElement?.click()}
        class="flex items-center gap-2 rounded-md bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
      >
        <IconUpload size={16} />
        {s("settings.contentFilter.import") || "Import Settings"}
      </button>
      <input
        bind:this={fileInputElement}
        type="file"
        accept=".json"
        onchange={handleFileSelect}
        class="hidden"
      />

      <!-- Import Confirmation Popup -->
      {#if showImportConfirm}
        <div
          id="import-confirm-popup"
          class="animate-in fade-in slide-in-from-bottom-1 absolute bottom-full left-0 z-50 mb-2"
        >
          <div
            class="w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800"
          >
            <h5 class="mb-2 font-medium text-gray-900 dark:text-gray-100">
              {s("settings.contentFilter.importConfirm.title") ||
                "Import Settings?"}
            </h5>
            <p class="mb-2 text-sm text-gray-700 dark:text-gray-300">
              {s("settings.contentFilter.importConfirm.warning") ||
                "This will replace all current filter settings."}
            </p>
            {#if importWarning}
              <div
                class="mb-3 rounded border border-yellow-200 bg-yellow-50 p-2 dark:border-yellow-800 dark:bg-yellow-900/20"
              >
                <p class="text-xs text-yellow-800 dark:text-yellow-300">
                  ⚠️ {importWarning}
                </p>
              </div>
            {/if}
            <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
              {s("settings.contentFilter.importConfirm.backup") ||
                "Tip: Export your current settings first to create a backup."}
            </p>
            <div class="flex justify-end gap-2">
              <button
                onclick={() => {
                  showImportConfirm = false;
                  if (fileInputElement) fileInputElement.value = "";
                }}
                class="rounded-md bg-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                {s("common.cancel") || "Cancel"}
              </button>
              <button
                onclick={confirmImport}
                class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                {s("settings.contentFilter.importConfirm.action") || "Import"}
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Reset Button -->
  <div class="relative border-t border-gray-200 pt-4 dark:border-gray-700">
    <button
      bind:this={resetButtonElement}
      onclick={() => (showResetConfirm = !showResetConfirm)}
      class="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
    >
      {s("settings.contentFilter.reset") || "Reset to Defaults"}
    </button>

    <!-- Floating Confirmation -->
    {#if showResetConfirm}
      <div
        id="reset-confirm-popup"
        class="animate-in fade-in slide-in-from-bottom-1 absolute bottom-full left-0 z-50 mb-2"
      >
        <div
          class="w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          <p class="mb-3 text-sm text-gray-700 dark:text-gray-300">
            {s("settings.contentFilter.resetModal.description") ||
              "This will clear all filters and reset settings to defaults."}
          </p>
          <div class="flex justify-end gap-2">
            <button
              onclick={() => (showResetConfirm = false)}
              class="rounded-md bg-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              {s("common.cancel") || "Cancel"}
            </button>
            <button
              onclick={resetToDefaults}
              class="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
            >
              {s("common.reset") || "Reset"}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
