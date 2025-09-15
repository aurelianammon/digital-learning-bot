<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from "svelte";
    import { marked } from "marked";

    export let images: string[] = [];
    export let videos: string[] = [];
    export let selectedBotId: string = "";

    const dispatch = createEventDispatcher();

    let jobs: any[] = [];
    let loading = false;
    let pollInterval: NodeJS.Timeout | null = null;
    let lastJobCount = 0;
    let showNewJobIndicator = false;
    let isInitialLoad = true;

    let type: "TEXT" | "IMAGE" | "VIDEO" | "PROMPT" = "TEXT";
    let text = "";
    let date = "";
    let fileInput: HTMLInputElement;

    $: filteredJobs = jobs.map((job) => {
        const jobDate = new Date(job.date);
        const now = new Date();
        const isOverdue = jobDate <= now;
        const hasError = job.state === true && isOverdue;

        return {
            ...job,
            error: hasError,
        };
    });

    async function loadJobs(showLoading = false) {
        if (!selectedBotId) return;

        // Only show loading state on initial load or when explicitly requested
        if (showLoading || isInitialLoad) {
            loading = true;
        }

        try {
            const response = await fetch(`/api/jobs?botId=${selectedBotId}`);
            const newJobs = await response.json();

            // Only update if jobs actually changed
            if (JSON.stringify(newJobs) !== JSON.stringify(jobs)) {
                jobs = newJobs;

                // Dispatch event if new jobs were added
                if (newJobs.length > lastJobCount) {
                    dispatch("newJobs", {
                        count: newJobs.length - lastJobCount,
                    });
                    showNewJobIndicator = true;
                    // Hide indicator after 3 seconds
                    setTimeout(() => {
                        showNewJobIndicator = false;
                    }, 3000);
                }
                lastJobCount = newJobs.length;
            }
        } catch (error) {
            console.error("Error loading jobs:", error);
        } finally {
            if (showLoading || isInitialLoad) {
                loading = false;
                isInitialLoad = false;
            }
        }
    }

    function startPolling() {
        // Clear any existing interval
        if (pollInterval) {
            clearInterval(pollInterval);
        }

        // Poll every 3 seconds for new jobs
        pollInterval = setInterval(() => {
            loadJobs();
        }, 3000);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    // Load jobs when component mounts or botId changes
    onMount(() => {
        loadJobs(true); // Show loading on initial mount
        startPolling();
    });

    onDestroy(() => {
        stopPolling();
    });

    $: if (selectedBotId) {
        loadJobs(true); // Show loading when switching bots
        startPolling();
    } else {
        stopPolling();
    }

    async function addJob() {
        if (!date || !text) return;

        try {
            const message =
                type === "TEXT" || type === "PROMPT"
                    ? marked.parseInline(text)
                    : text;

            await fetch("/api/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type,
                    message,
                    date: new Date(date).toISOString(),
                    botId: selectedBotId || null,
                }),
            });

            text = "";
            date = "";
            // Reload jobs after adding
            await loadJobs(false);
        } catch (error) {
            console.error("Error adding job:", error);
        }
    }

    async function removeJob(jobId: string) {
        try {
            await fetch(`/api/jobs/${jobId}`, {
                method: "DELETE",
            });
            // Reload jobs after removing
            await loadJobs(false);
        } catch (error) {
            console.error("Error removing job:", error);
        }
    }

    async function uploadFile() {
        if (!fileInput.files?.[0]) return;

        const formData = new FormData();
        formData.append("file", fileInput.files[0]);
        formData.append("type", type);

        try {
            await fetch("/api/files", {
                method: "POST",
                body: formData,
            });

            fileInput.value = "";
            dispatch("update");
        } catch (error) {
            console.error("Error uploading file:", error);
        }
    }
</script>

<div class="top">
    <h2>
        Task Scheduler
        {#if showNewJobIndicator}
            <span class="new-job-indicator">✨ New tasks!</span>
        {/if}
    </h2>
    <button class:active={type === "VIDEO"} on:click={() => (type = "VIDEO")}
        >📹</button
    >
    <button class:active={type === "IMAGE"} on:click={() => (type = "IMAGE")}
        >📷</button
    >
    <button class:active={type === "TEXT"} on:click={() => (type = "TEXT")}
        >🗞️</button
    >
    <button class:active={type === "PROMPT"} on:click={() => (type = "PROMPT")}
        >🤖</button
    >
</div>

<div class="add">
    {#if type === "TEXT" || type === "PROMPT"}
        <textarea
            bind:value={text}
            placeholder="Markdown formatted text"
            rows="4"
        ></textarea>
    {:else}
        <div class="select">
            {#if type === "IMAGE"}
                <select bind:value={text}>
                    <option disabled value="">Please select image</option>
                    {#each images as image}
                        <option value={image}>{image}</option>
                    {/each}
                </select>
            {:else if type === "VIDEO"}
                <select bind:value={text}>
                    <option disabled value="">Please select video</option>
                    {#each videos as video}
                        <option value={video}>{video}</option>
                    {/each}
                </select>
            {/if}

            <form on:submit|preventDefault={uploadFile}>
                <label for="file-upload" class="custom-file-upload"
                    >Upload File</label
                >
                <input
                    id="file-upload"
                    bind:this={fileInput}
                    type="file"
                    accept={type === "IMAGE" ? "image/*" : "video/*"}
                    on:change={uploadFile}
                />
            </form>
        </div>
    {/if}

    <input bind:value={date} type="datetime-local" step="1" />
    <button on:click={addJob}>Add Task</button>
</div>

{#each filteredJobs as job (job.id)}
    <div class="job" class:inactive={!job.state} class:error={job.error}>
        <div class="header">
            <div class="date">
                {new Date(job.date).toLocaleString("de-CH", {
                    timeZone: "Europe/Zurich",
                })}
            </div>
            <div class="type">
                {job.type}
            </div>
            <div class="type">
                {#if job.error}
                    <span
                        class="error-indicator"
                        title="Task is overdue but still active"
                        >NOT EXECUTED</span
                    >
                {/if}
            </div>
            <button class="controll_button" on:click={() => removeJob(job.id)}
                >×</button
            >
        </div>
        <div class="message">
            {@html job.message}
        </div>
    </div>
{/each}

<style>
    .new-job-indicator {
        font-size: 0.8em;
        color: #4caf50;
        font-weight: normal;
        margin-left: 10px;
        animation: pulse 1s ease-in-out;
    }

    @keyframes pulse {
        0% {
            opacity: 1;
        }
        50% {
            opacity: 0.5;
        }
        100% {
            opacity: 1;
        }
    }

    .error-indicator {
        animation: errorPulse 2s ease-in-out infinite;
    }

    .job.error {
        border-left: 4px solid #fa0000;
        background-color: #fe8787;
    }

    @keyframes errorPulse {
        0% {
            opacity: 1;
        }
        50% {
            opacity: 0.3;
        }
        100% {
            opacity: 1;
        }
    }
</style>
