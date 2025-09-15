<script lang="ts">
    import { onMount } from "svelte";
    import { marked } from "marked";
    import BotSettings from "$lib/components/BotSettings.svelte";
    import StartPage from "$lib/components/StartPage.svelte";
    import TaskScheduler from "$lib/components/TaskScheduler.svelte";
    import ChatHistory from "$lib/components/ChatHistory.svelte";

    let jobs: any[] = [];
    let messages: any[] = [];
    let context = "";
    let botName = "assistant";
    let images: string[] = [];
    let videos: string[] = [];
    let selectedBotId = "";
    let selectedBot: any = null;
    let showStartPage = true;

    onMount(async () => {
        // Only load context and files on mount, not bot-specific data
        await loadStaticData();
    });

    async function loadStaticData() {
        try {
            // Load files
            const filesResponse = await fetch("/api/files");
            const files = await filesResponse.json();
            images = files.images;
            videos = files.videos;
        } catch (error) {
            console.error("Error loading static data:", error);
        }
    }

    async function loadBotData() {
        try {
            // Load jobs for the selected bot
            const jobsResponse = await fetch(
                `/api/jobs?botId=${selectedBotId}`
            );
            jobs = await jobsResponse.json();

            // Load messages for the selected bot
            const messagesResponse = await fetch(
                `/api/messages?botId=${selectedBotId}`
            );
            messages = await messagesResponse.json();

            // Load context for the selected bot
            const contextResponse = await fetch(
                `/api/context?botId=${selectedBotId}`
            );
            context = await contextResponse.json();
        } catch (error) {
            console.error("Error loading bot data:", error);
        }
    }

    function handleDataUpdate() {
        loadBotData();
    }

    function handleBotAccessed(event: CustomEvent) {
        selectedBotId = event.detail.botId;
        selectedBot = event.detail.bot;
        botName = selectedBot.name;
        showStartPage = false;
        loadBotData();
    }

    function goBackToStart() {
        showStartPage = true;
        selectedBotId = "";
        selectedBot = null;
        botName = "assistant";
        jobs = [];
        messages = [];
    }
</script>

<svelte:head>
    <title>AI Workshop Bot - Backend Interface</title>
    <link rel="stylesheet" href="/css/reset.css" />
    <link rel="stylesheet" href="/css/main.css" />
</svelte:head>

{#if showStartPage}
    <StartPage on:botAccessed={handleBotAccessed} />
{:else}
    <div class="app">
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
                <TaskScheduler
                    {jobs}
                    {images}
                    {videos}
                    {selectedBotId}
                    on:update={handleDataUpdate}
                />
            </div>

            <div class="history">
                <ChatHistory {messages} on:update={handleDataUpdate} />
            </div>
        </div>
    </div>
{/if}

<style>
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

    .no-bot-selected {
        text-align: center;
        padding: 48px;
        color: #666;
        font-size: 1.1em;
    }

    .context h3,
    .scheduler h3,
    .history h3 {
        color: #555;
        margin-bottom: 12px;
    }
</style>
