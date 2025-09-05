<script lang="ts">
  // Removed animations for consistency with Settings component
  import { s } from "$lib/client/localization.svelte";
  import { timeTravelNavigationService } from "$lib/services/timeTravelNavigationService";
  import { dataLanguage } from "$lib/stores/dataLanguage.svelte.js";
  import { language } from "$lib/stores/language.svelte.js";
  import { timeTravel } from "$lib/stores/timeTravel.svelte.js";

  interface BatchInfo {
    id: string;
    createdAt: string;
    language: string;
    totalStories: number;
    time: string;
  }

  interface DayBatches {
    [date: string]: BatchInfo[];
  }

  // Component state
  let currentMonth = $state(new Date());
  let loading = $state(false);
  let monthBatches = $state<DayBatches>({});
  let selectedDayBatches = $state<BatchInfo[]>([]);
  let showBatchSelector = $state(false);
  let showYearPicker = $state(false);
  let isSelectingBatch = $state(false);

  // Define reasonable date boundaries
  const MIN_DATE = new Date(2024, 0, 1); // January 1, 2024
  const MAX_DATE = new Date(); // Today
  // Set MAX_DATE to end of today to avoid timezone issues
  MAX_DATE.setHours(23, 59, 59, 999);

  // Calculate calendar days
  const calendarDays = $derived.by(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1, 12, 0, 0); // Set to noon to avoid timezone issues
    const lastDay = new Date(year, month + 1, 0, 12, 0, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

    for (
      let date = new Date(startDate);
      date <= endDate;
      date.setDate(date.getDate() + 1)
    ) {
      // Create a new date at noon to avoid timezone issues
      const dayDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        12,
        0,
        0,
      );
      days.push(dayDate);
    }

    return days;
  });

  // Month/year display
  const monthYearDisplay = $derived(
    new Intl.DateTimeFormat(language.current, {
      month: "long",
      year: "numeric",
    }).format(currentMonth),
  );

  // Weekday headers
  const weekdayHeaders = $derived.by(() => {
    const formatter = new Intl.DateTimeFormat(language.current, {
      weekday: "short",
    });
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(2024, 0, i + 7); // Start from Sunday
      days.push(formatter.format(date));
    }
    return days;
  });

  // Load batches for current month
  async function loadMonthBatches() {
    loading = true;
    try {
      const startOfMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        1,
      );
      const endOfMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        0,
        23,
        59,
        59,
      );

      const response = await fetch(
        `/api/batches?from=${startOfMonth.toISOString()}&to=${endOfMonth.toISOString()}&lang=${dataLanguage.current}`,
      );

      if (!response.ok) throw new Error("Failed to load batches");

      const data = await response.json();

      // Group batches by date
      const grouped: DayBatches = {};
      for (const batch of data.batches) {
        const date = new Date(batch.createdAt);
        const dateKey = date.toISOString().split("T")[0];
        const timeStr = date.toLocaleTimeString(language.current, {
          hour: "2-digit",
          minute: "2-digit",
        });

        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }

        grouped[dateKey].push({
          id: batch.id,
          createdAt: batch.createdAt,
          language: batch.language,
          totalStories: batch.totalClusters,
          time: timeStr,
        });
      }

      // Sort batches within each day by time (newest first)
      for (const dateKey in grouped) {
        grouped[dateKey].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      }

      monthBatches = grouped;
    } catch (error) {
      console.error("Error loading batches:", error);
      // Keep the modal open on error
    } finally {
      loading = false;
    }
  }

  // Check if a date has batches
  function hasBatches(date: Date): boolean {
    const dateKey = date.toISOString().split("T")[0];
    return monthBatches[dateKey] && monthBatches[dateKey].length > 0;
  }

  // Get batch count for a date
  function getBatchCount(date: Date): number {
    const dateKey = date.toISOString().split("T")[0];
    return monthBatches[dateKey]?.length || 0;
  }

  // Check if date is today
  function isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  // Check if date is in current month
  function isCurrentMonth(date: Date): boolean {
    return (
      date.getMonth() === currentMonth.getMonth() &&
      date.getFullYear() === currentMonth.getFullYear()
    );
  }

  // Check if date is within allowed range
  function isDateInRange(date: Date): boolean {
    // Compare only the date parts, ignoring time
    const dateOnly = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const minDateOnly = new Date(
      MIN_DATE.getFullYear(),
      MIN_DATE.getMonth(),
      MIN_DATE.getDate(),
    );
    const maxDateOnly = new Date(
      MAX_DATE.getFullYear(),
      MAX_DATE.getMonth(),
      MAX_DATE.getDate(),
    );
    return dateOnly >= minDateOnly && dateOnly <= maxDateOnly;
  }

  // Check if we can navigate
  function canNavigatePrevious(): boolean {
    const prevMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1,
      1,
    );
    return prevMonth >= MIN_DATE;
  }

  function canNavigateNext(): boolean {
    const nextMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      1,
    );
    return nextMonth <= MAX_DATE;
  }

  // Navigate months
  function previousMonth() {
    if (!canNavigatePrevious()) return;
    currentMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1,
      1,
    );
    loadMonthBatches();
  }

  function nextMonth() {
    if (!canNavigateNext()) return;
    currentMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      1,
    );
    loadMonthBatches();
  }

  async function goToToday() {
    isSelectingBatch = true;
    try {
      await timeTravelNavigationService.exitTimeTravel();
    } finally {
      isSelectingBatch = false;
      timeTravel.close();
    }
  }

  // Year picker
  function selectYear(year: number) {
    currentMonth = new Date(year, currentMonth.getMonth(), 1);
    // Ensure we're within bounds
    if (currentMonth < MIN_DATE) {
      currentMonth = new Date(MIN_DATE);
    } else if (currentMonth > MAX_DATE) {
      currentMonth = new Date(MAX_DATE.getFullYear(), MAX_DATE.getMonth(), 1);
    }
    showYearPicker = false;
    loadMonthBatches();
  }

  // Get available years
  const availableYears = $derived.by(() => {
    const years = [];
    for (
      let year = MIN_DATE.getFullYear();
      year <= MAX_DATE.getFullYear();
      year++
    ) {
      years.push(year);
    }
    return years;
  });

  // Handle day selection
  function selectDay(date: Date) {
    try {
      const dateKey = date.toISOString().split("T")[0];
      const batches = monthBatches[dateKey];

      if (batches && batches.length > 0) {
        // Always show batch selector to display hourly updates
        selectedDayBatches = batches;
        showBatchSelector = true;
      }
    } catch (error) {
      console.error("Error in selectDay:", error);
    }
  }

  // Select a specific batch
  async function selectBatch(batch: BatchInfo) {
    isSelectingBatch = true;

    try {
      // Check if this is the absolute latest batch by fetching the current latest
      const latestResponse = await fetch(
        `/api/batches/latest?lang=${dataLanguage.current}`,
      );
      const latestData = await latestResponse.json();
      // The API returns the batch directly, not wrapped in a 'batch' property
      const isLatestBatch = latestData.id && latestData.id === batch.id;

      console.log("Selecting batch:", {
        batchId: batch.id,
        latestBatchId: latestData.id,
        isLatestBatch,
      });

      if (isLatestBatch) {
        // For the latest batch, exit time travel mode
        console.log("Going to live mode - resetting time travel");
        await timeTravelNavigationService.exitTimeTravel();
      } else {
        // For all other batches, enter time travel mode
        console.log("Setting time travel mode for batch:", batch.id);
        await timeTravelNavigationService.enterTimeTravel({
          batchId: batch.id,
          batchDate: batch.createdAt,
          reload: true,
        });
      }
    } catch (error) {
      console.error("Error selecting batch:", error);
    } finally {
      isSelectingBatch = false;
      timeTravel.close();
    }
  }

  // Close modal on escape or backdrop click
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      timeTravel.close();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      timeTravel.close();
    }
  }

  // Load batches when modal opens
  $effect(() => {
    if (timeTravel.isOpen) {
      loadMonthBatches();
    }
  });
</script>

{#if timeTravel.isOpen}
  <div
    class="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 dark:bg-black/80"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-label={s("timeTravel.title") || "Time Travel"}
    tabindex="-1"
  >
    <div
      class="relative m-4 w-full max-w-md rounded-lg bg-white p-6 shadow-2xl dark:bg-gray-800"
    >
      <!-- Loading overlay for the modal content -->
      {#if isSelectingBatch}
        <div
          class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/80 dark:bg-gray-800/80"
        >
          <div class="flex flex-col items-center gap-3">
            <div
              class="h-8 w-8 animate-spin rounded-full border-3 border-gray-300 border-t-blue-500 dark:border-gray-600 dark:border-t-blue-400"
            ></div>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {s("timeTravel.loadingData") || "Loading historical data..."}
            </p>
          </div>
        </div>
      {/if}

      <!-- Header -->
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200">
          {s("timeTravel.title") || "Time Travel"}
        </h2>
        <button
          onclick={() => timeTravel.close()}
          class="rounded-lg p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label={s("common.close") || "Close"}
          disabled={isSelectingBatch}
        >
          <svg
            class="h-5 w-5 text-gray-500 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {#if !showBatchSelector}
        <!-- Month Navigation -->
        <div class="mb-4 flex items-center justify-between">
          <button
            onclick={previousMonth}
            disabled={!canNavigatePrevious()}
            class="rounded-lg p-2 transition-colors {canNavigatePrevious()
              ? 'hover:bg-gray-100 dark:hover:bg-gray-700'
              : 'cursor-not-allowed opacity-30'}"
            aria-label={s("timeTravel.previousMonth") || "Previous month"}
          >
            <svg
              class="h-5 w-5 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <div class="flex items-center gap-2">
            {#if showYearPicker}
              <select
                class="cursor-pointer border-none bg-transparent text-lg font-medium text-gray-700 focus:outline-none dark:text-gray-300"
                value={currentMonth.getFullYear()}
                onchange={(e) => selectYear(parseInt(e.currentTarget.value))}
                onblur={() => (showYearPicker = false)}
              >
                {#each availableYears as year}
                  <option value={year}>{year}</option>
                {/each}
              </select>
            {:else}
              <button
                onclick={() => (showYearPicker = true)}
                class="text-lg font-medium text-gray-700 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
              >
                {monthYearDisplay}
              </button>
            {/if}
            {#if loading}
              <div
                class="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 dark:border-gray-600 dark:border-t-blue-400"
              ></div>
            {/if}
          </div>

          <button
            onclick={nextMonth}
            disabled={!canNavigateNext()}
            class="rounded-lg p-2 transition-colors {canNavigateNext()
              ? 'hover:bg-gray-100 dark:hover:bg-gray-700'
              : 'cursor-not-allowed opacity-30'}"
            aria-label={s("timeTravel.nextMonth") || "Next month"}
          >
            <svg
              class="h-5 w-5 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        <!-- Today Button -->
        <div class="mb-4 flex justify-center">
          <button
            onclick={goToToday}
            class="rounded-lg bg-blue-50 px-3 py-1 text-sm text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
          >
            {s("timeTravel.today") || "Today"}
          </button>
        </div>

        <!-- Calendar Grid -->
        {#if loading}
          <div class="flex h-64 items-center justify-center">
            <div
              class="h-8 w-8 animate-spin rounded-full border-3 border-gray-300 border-t-blue-500 dark:border-gray-600 dark:border-t-blue-400"
            ></div>
          </div>
        {:else}
          <div class="grid grid-cols-7 gap-1">
            <!-- Weekday Headers -->
            {#each weekdayHeaders as day}
              <div
                class="py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400"
              >
                {day}
              </div>
            {/each}

            <!-- Calendar Days -->
            {#each calendarDays as date}
              {@const hasBatch = hasBatches(date)}
              {@const batchCount = getBatchCount(date)}
              {@const today = isToday(date)}
              {@const currentMonth = isCurrentMonth(date)}
              {@const inRange = isDateInRange(date)}

              <button
                onclick={() => selectDay(date)}
                disabled={!hasBatch || !inRange}
                class="relative h-10 rounded-lg p-2 transition-all
              {hasBatch && inRange
                  ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30'
                  : 'cursor-default'}
              {today ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''}
              {!currentMonth || !inRange ? 'opacity-30' : ''}"
                aria-label="{date.getDate()} - {batchCount} batches"
              >
                <span
                  class="text-sm {hasBatch && inRange
                    ? 'font-medium text-gray-700 dark:text-gray-300'
                    : 'text-gray-400 dark:text-gray-600'}"
                >
                  {date.getDate()}
                </span>

                {#if hasBatch && inRange}
                  <div
                    class="absolute bottom-0.5 left-1/2 flex -translate-x-1/2 transform gap-0.5"
                  >
                    {#each Array(Math.min(batchCount, 3)) as _}
                      <div
                        class="h-1 w-1 rounded-full bg-blue-500 dark:bg-blue-400"
                      ></div>
                    {/each}
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        {/if}

        <!-- Legend -->
        <div class="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
          {s("timeTravel.selectDate") ||
            "Select a date to view news from that day"}
        </div>
      {:else}
        {@const selectedDate = selectedDayBatches[0]
          ? new Date(selectedDayBatches[0].createdAt)
          : new Date()}
        {@const dateStr = new Intl.DateTimeFormat(language.current, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }).format(selectedDate)}

        <!-- Batch Selector -->
        <div>
          <button
            onclick={() => (showBatchSelector = false)}
            class="mb-4 flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {s("common.back") || "Back"}
          </button>

          <h3 class="mb-1 text-lg font-medium text-gray-700 dark:text-gray-300">
            {dateStr}
          </h3>
          <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
            {s("timeTravel.selectBatch") || "Select a news update"}
          </p>

          <div class="max-h-96 space-y-2 overflow-y-auto">
            {#each selectedDayBatches as batch, index}
              {@const batchDate = new Date(batch.createdAt)}
              {@const timeStr = batchDate.toLocaleTimeString(language.current, {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
              <button
                onclick={() => selectBatch(batch)}
                class="group w-full rounded-lg bg-gray-50 p-4 text-left transition-colors hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:bg-gray-700"
              >
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <div class="mb-1 flex items-center gap-2">
                      <svg
                        class="h-4 w-4 text-blue-500 dark:text-blue-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div class="font-medium text-gray-800 dark:text-gray-200">
                        {timeStr}
                      </div>
                      {#if index === 0}
                        <span
                          class="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-900/50 dark:text-blue-400"
                        >
                          {s("timeTravel.latest") || "Latest"}
                        </span>
                      {/if}
                    </div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">
                      {batch.totalStories}
                      {s("timeTravel.stories") || "stories"}
                    </div>
                  </div>
                  <svg
                    class="h-5 w-5 text-gray-400 transition-colors group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
