<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import BotSettings from "$lib/components/BotSettings.svelte";
    import TaskScheduler from "$lib/components/TaskScheduler.svelte";
    import ChatHistory from "$lib/components/ChatHistory.svelte";
    import Navigation from "$lib/components/Navigation.svelte";
    import Context from "$lib/components/Context.svelte";

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

        // loading = true;
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
            const contextResponse = await fetch("/api/context", {
                headers: {
                    Authorization: `Bearer ${selectedBotId}`,
                    "X-Bot-ID": selectedBotId,
                },
            });
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
    <title>Digital Learning Assistant - {botName}</title>
    <link rel="stylesheet" href="/css/reset.css" />
    <link rel="stylesheet" href="/css/font.css" />
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
    <Navigation {selectedBotId} />
    <div class="dashboard-content">
        <div class="bot-dashboard">
            <div class="settings">
                <BotSettings
                    bind:botName
                    {selectedBotId}
                    {selectedBot}
                    on:update={handleDataUpdate}
                />
            </div>

            <Context
                bind:context
                {selectedBotId}
                on:update={handleDataUpdate}
            />

            <div class="scheduler">
                <TaskScheduler
                    {images}
                    {videos}
                    {selectedBotId}
                    on:update={handleDataUpdate}
                />
            </div>

            <div class="history">
                <ChatHistory {selectedBotId} />
            </div>
        </div>
    </div>
{/if}

<style>
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
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        grid-template-rows: auto auto;
        gap: 10px;
        margin: 0 auto;
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

    .dashboard-content {
        margin: 10px;
        padding-top: 20px;
    }

    .settings {
        border-radius: 20px;
        box-sizing: border-box;
        grid-column: 1 / 3;
        grid-row: 1;
        overflow: hidden;
    }

    .scheduler {
        border-radius: 20px;
        box-sizing: border-box;
        grid-column: 1 / 4;
        grid-row: 2;
        overflow: hidden;
        height: fit-content;
    }

    .history {
        border-radius: 20px;
        box-sizing: border-box;
        grid-column: 4 / 7;
        grid-row: 2;
        overflow: hidden;
        height: fit-content;
    }

    :global(.tile-title) {
        font-size: 14px;
        border: 1px solid black;
        border-radius: 20px;
        padding: 0 14px;
        height: 38px;
        line-height: 37px;
        width: fit-content;
        margin-bottom: 10px;
    }

    /* Mobile responsive styles */
    @media (max-width: 768px) {
        .bot-dashboard {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .settings {
            grid-column: unset;
            grid-row: unset;
            order: 1;
        }

        .scheduler {
            grid-column: unset;
            grid-row: unset;
            order: 3;
        }

        .history {
            grid-column: unset;
            grid-row: unset;
            order: 4;
        }

        .dashboard-content {
            margin: 10px;
            padding-top: 10px;
        }
    }
</style>
