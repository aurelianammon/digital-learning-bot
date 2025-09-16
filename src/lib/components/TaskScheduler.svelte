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
    let showAddTaskPopup = false;

    // Task creation variables
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
            const response = await fetch("/api/jobs", {
                headers: {
                    Authorization: `Bearer ${selectedBotId}`,
                    "X-Bot-ID": selectedBotId,
                },
            });
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

    function openAddTaskPopup() {
        showAddTaskPopup = true;
    }

    function closeAddTaskPopup() {
        showAddTaskPopup = false;
        // Reset form
        text = "";
        date = "";
        type = "TEXT";
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
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${selectedBotId}`,
                    "X-Bot-ID": selectedBotId,
                },
                body: JSON.stringify({
                    type,
                    message,
                    date: new Date(date).toISOString(),
                }),
            });

            // Close popup and reset form
            closeAddTaskPopup();
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
                headers: {
                    Authorization: `Bearer ${selectedBotId}`,
                    "X-Bot-ID": selectedBotId,
                },
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
            const response = await fetch("/api/files", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Upload failed:", errorData);
                alert(`Upload failed: ${errorData.error || "Unknown error"}`);
                return;
            }

            const result = await response.json();
            console.log("Upload successful:", result);

            fileInput.value = "";
            dispatch("update");
        } catch (error) {
            console.error("Error uploading file:", error);
            alert(
                `Upload error: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }
</script>

<div class="task-scheduler">
    <div class="top">
        <h3 class="tile-title">Task Scheduler</h3>
        <div class="top-controls">
            {#if showNewJobIndicator}
                <span class="new-job-indicator">✨ Updated!</span>
            {/if}
            <button class="add-task-button" on:click={openAddTaskPopup}>
                +
            </button>
        </div>
    </div>

    <div class="jobs">
        {#if loading}
            <div class="loading">Loading jobs...</div>
        {:else if filteredJobs.length === 0}
            <div class="no-jobs">No jobs to display</div>
        {:else}
            {#each filteredJobs as job (job.id)}
                <div
                    class="job"
                    class:inactive={!job.state}
                    class:error={job.error}
                >
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
                        <button
                            class="controll_button"
                            on:click={() => removeJob(job.id)}>×</button
                        >
                    </div>
                    <div class="message">
                        {@html job.message}
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</div>

<!-- Add Task Popup -->
{#if showAddTaskPopup}
    <div
        class="popup-overlay"
        on:click={closeAddTaskPopup}
        on:keydown={(e) => e.key === "Escape" && closeAddTaskPopup()}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
    >
        <div class="popup-content" on:click|stopPropagation>
            <div class="popup-header">
                <h3>Add New Task</h3>
                <button class="close-button" on:click={closeAddTaskPopup}
                    >×</button
                >
            </div>

            <div class="popup-body">
                <div class="task-buttons">
                    <button
                        class:active={type === "VIDEO"}
                        on:click={() => (type = "VIDEO")}>📹</button
                    >
                    <button
                        class:active={type === "IMAGE"}
                        on:click={() => (type = "IMAGE")}>📷</button
                    >
                    <button
                        class:active={type === "TEXT"}
                        on:click={() => (type = "TEXT")}>🗞️</button
                    >
                    <button
                        class:active={type === "PROMPT"}
                        on:click={() => (type = "PROMPT")}>🤖</button
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
                                    <option disabled value=""
                                        >Please select image</option
                                    >
                                    {#each images as image}
                                        <option value={image}>{image}</option>
                                    {/each}
                                </select>
                            {:else if type === "VIDEO"}
                                <select bind:value={text}>
                                    <option disabled value=""
                                        >Please select video</option
                                    >
                                    {#each videos as video}
                                        <option value={video}>{video}</option>
                                    {/each}
                                </select>
                            {/if}

                            <div>
                                <label
                                    for="file-upload"
                                    class="custom-file-upload"
                                    >Upload File</label
                                >
                                <input
                                    id="file-upload"
                                    bind:this={fileInput}
                                    type="file"
                                    accept={type === "IMAGE"
                                        ? "image/*"
                                        : "video/*"}
                                    on:change={uploadFile}
                                />
                            </div>
                        </div>
                    {/if}

                    <input bind:value={date} type="datetime-local" step="1" />
                </div>
            </div>

            <div class="popup-footer">
                <button class="cancel-button" on:click={closeAddTaskPopup}
                    >Cancel</button
                >
                <button class="add-button" on:click={addJob}>Add Task</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .task-scheduler {
        background: #ffffff;
        padding: 10px;
        height: fit-content;
    }

    .jobs {
        max-height: 800px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .loading {
        text-align: center;
        padding: 20px;
        color: #000000;
        font-style: normal;
    }

    .no-jobs {
        text-align: center;
        padding: 20px;
        color: #000000;
        font-style: normal;
    }

    .top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    }

    .top-controls {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .tile-title {
        margin-bottom: 0px;
    }

    .add-task-button {
        background: black;
        color: white;
        border: none;
        padding: 0px 0px;
        border-radius: 30px;
        border: 1px solid black;
        height: 40px;
        width: 40px;
        cursor: pointer;
        font-size: 30px;
        padding-bottom: 4px;
        font-family: "GT America Mono", monospace;
        line-height: 30px;
    }

    .add-task-button:hover {
        background: rgb(128, 128, 255);
    }

    .task-buttons {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
    }

    .task-buttons button {
        border: 1px solid black;
        border-radius: 20px;
        padding: 0 14px;
        background: black;
        color: white;
        cursor: pointer;
        font-family: "GT America Mono", monospace;
    }

    .task-buttons button.active {
        background-color: #4caf50;
        color: white;
    }

    .new-job-indicator {
        font-size: 0.8em;
        color: #4caf50;
        font-weight: normal;
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
        /* border-left: 4px solid #fa0000; */
        background-color: transparent;
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

    /* Job styles moved from main.css */
    .job {
        background: rgb(128, 128, 255);
        color: black;
        height: auto;
        padding: 10px;
        border-radius: 8px;
        border: 1px solid black;
        font-size: 14px;
        line-height: 1.5;
    }

    .job.inactive {
        background-color: transparent;
    }

    .job .header {
        font-size: 10px;
        margin-bottom: 5px;
        height: 17px;
        line-height: 16px;
    }

    .header .date {
        float: left;
        background-color: black;
        color: white;
        margin-right: 5px;
        border-radius: 0px;
        padding-bottom: 1px;
        padding: 0 5px;
    }

    .header .type {
        float: left;
        background-color: black;
        color: white;
        margin-right: 5px;
        border-radius: 0px;
        padding-bottom: 1px;
        text-transform: uppercase;
        padding: 0 5px;
    }

    .job .controll_button {
        float: right;
        height: 17px;
        font-size: 10px;
        line-height: 7px;
        cursor: pointer;
        padding: 0 6px;
        background: black;
        color: white;
        border: none;
        border-radius: 0px;
        padding-bottom: 1px;
        /* font-family: "GT America Mono", monospace; */
    }

    .job .message {
        white-space: break-spaces;
    }

    /* Form styles moved from main.css */
    .add {
        margin-bottom: 10px;
    }

    .add textarea {
        width: calc(100% - 12px);
        margin-bottom: 5px;
        padding: 5px;
        font: inherit;
        resize: vertical;
        border: 1px solid #ccc;
        border-radius: 3px;
    }

    .add input {
        font: inherit;
        width: calc(100% - 12px);
        margin-bottom: 10px;
        padding: 5px;
        border: 1px solid #ccc;
        border-radius: 3px;
    }

    .add select {
        width: calc(100% - 83px);
        margin-bottom: 10px;
        font: inherit;
        float: left;
        padding: 5px;
        border: 1px solid #ccc;
        border-radius: 3px;
    }

    .custom-file-upload {
        cursor: pointer;
        float: right;
        font-size: 13px;
        display: block;
        height: 15.5px;
        line-height: 15px;
        background: black;
        border: none;
        padding: 5px;
        border-radius: 3px;
        outline: none;
        color: #fff;
        font-family: "GT America Mono", monospace;
    }

    input[type="file"] {
        display: none;
    }

    /* Popup styles */
    .popup-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .popup-content {
        background: white;
        border-radius: 8px;
        width: 90%;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    .popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid #eee;
    }

    .popup-header h3 {
        margin: 0;
        color: #333;
    }

    .close-button {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
    }

    .close-button:hover {
        background: #f0f0f0;
    }

    .popup-body {
        padding: 20px;
    }

    .popup-footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 20px;
        border-top: 1px solid #eee;
    }

    .cancel-button {
        background: #666;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        font-family: "GT America Mono", monospace;
    }

    .cancel-button:hover {
        background: #555;
    }

    .add-button {
        background: #4caf50;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        font-family: "GT America Mono", monospace;
    }

    .add-button:hover {
        background: #45a049;
    }
</style>
