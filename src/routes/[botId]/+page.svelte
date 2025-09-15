<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import BotSettings from "$lib/components/BotSettings.svelte";
    import TaskScheduler from "$lib/components/TaskScheduler.svelte";
    import ChatHistory from "$lib/components/ChatHistory.svelte";

    let context = "";
    let botName = "assistant";
    let images: string[] = [];
    let videos: string[] = [];
    let selectedBotId = "";
    let selectedBot: any = null;
    let loading = true;
    let error = "";

    $: selectedBotId = $page.params.botId || "";

    onMount(async () => {
        if (selectedBotId) {
            await loadBotData();
        }
    });

    async function loadBotData() {
        if (!selectedBotId) return;

        loading = true;
        error = "";

        try {
            // Load bot info
            const botResponse = await fetch(`/api/bots/${selectedBotId}`);
            if (!botResponse.ok) {
                error = "Bot not found";
                loading = false;
                return;
            }
            selectedBot = await botResponse.json();
            botName = selectedBot.name;

            // Load static data (files)
            const filesResponse = await fetch("/api/files");
            const files = await filesResponse.json();
            images = files.images;
            videos = files.videos;

            // Jobs and messages are now loaded by their respective components

            // Load context for the selected bot
            const contextResponse = await fetch(
                `/api/context?botId=${selectedBotId}`
            );
            context = await contextResponse.json();
        } catch (error) {
            console.error("Error loading bot data:", error);
            error = "Failed to load bot data";
        } finally {
            loading = false;
        }
    }

    function handleDataUpdate() {
        // Only reload core bot data, components handle their own data
        loadBotData();
    }

    function goBackToStart() {
        goto("/");
    }
</script>

<svelte:head>
    <title>Bot Dashboard: {botName} - AI Workshop Bot</title>
    <link rel="stylesheet" href="/css/reset.css" />
    <link rel="stylesheet" href="/css/main.css" />
</svelte:head>

{#if loading}
    <div class="loading">
        <div class="loading-spinner"></div>
        <p>Loading bot dashboard...</p>
    </div>
{:else if error}
    <div class="error">
        <h2>Error</h2>
        <p>{error}</p>
        <button class="back-button" on:click={goBackToStart}>
            ← Back to Start
        </button>
    </div>
{:else}
    <div class="wrapper">
        <div class="dashboard-header">
            <button class="back-button" on:click={goBackToStart}>
                ← Back to Start
            </button>
            <div class="bot-info">
                <h1>Bot Dashboard: {botName}</h1>
                <div class="bot-id-display">
                    <span class="bot-id-label">Bot ID:</span>
                    <code class="bot-id-value">{selectedBotId}</code>
                    <button
                        class="copy-button"
                        on:click={() =>
                            navigator.clipboard.writeText(selectedBotId)}
                        title="Copy Bot ID"
                    >
                        📋
                    </button>
                </div>
            </div>
        </div>

        <div class="bot-dashboard">
            <div class="dashboard-controls">
                <BotSettings
                    bind:botName
                    {selectedBotId}
                    {selectedBot}
                    on:update={handleDataUpdate}
                />
            </div>

            <div class="context">
                <h3>Context of the Bot</h3>
                <textarea
                    bind:value={context}
                    on:change={async () => {
                        try {
                            await fetch("/api/context", {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    content: context,
                                    botId: selectedBotId,
                                }),
                            });
                            handleDataUpdate();
                        } catch (error) {
                            console.error("Error updating context:", error);
                        }
                    }}
                    cols="30"
                    rows="10"
                    placeholder="Enter the context and personality for this bot..."
                ></textarea>
            </div>

            <div class="scheduler">
                <TaskScheduler {images} {videos} {selectedBotId} />
            </div>

            <div class="history">
                <ChatHistory {selectedBotId} />
            </div>
        </div>
    </div>
{/if}

<style>
    .wrapper {
        padding: 10px;
    }

    .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        gap: 16px;
    }

    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    .error {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        gap: 16px;
        text-align: center;
    }

    .error h2 {
        color: #dc3545;
        margin: 0;
    }

    .bot-dashboard {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 24px;
        background: white;
    }

    .dashboard-header {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid #e0e0e0;
    }

    .bot-info {
        flex: 1;
    }

    .back-button {
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s;
    }

    .back-button:hover {
        background: #5a6268;
    }

    .dashboard-header h1 {
        margin: 0 0 8px 0;
        color: #333;
        font-size: 1.8em;
    }

    .bot-id-display {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        padding: 8px 12px;
        font-family: "Courier New", monospace;
    }

    .bot-id-label {
        color: #6c757d;
        font-size: 14px;
        font-weight: 500;
    }

    .bot-id-value {
        background: #e9ecef;
        color: #495057;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 600;
        border: 1px solid #ced4da;
    }

    .copy-button {
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 12px;
        transition: background-color 0.2s;
    }

    .copy-button:hover {
        background: #0056b3;
    }

    .dashboard-controls {
        margin-bottom: 24px;
    }

    .context h3,
    .scheduler h3,
    .history h3 {
        color: #555;
        margin-bottom: 12px;
    }
</style>
