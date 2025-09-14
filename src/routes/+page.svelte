<script lang="ts">
    import { onMount } from "svelte";
    import { marked } from "marked";
    import BotSettings from "$lib/components/BotSettings.svelte";
    import TaskScheduler from "$lib/components/TaskScheduler.svelte";
    import ChatHistory from "$lib/components/ChatHistory.svelte";

    let jobs: any[] = [];
    let messages: any[] = [];
    let context = "";
    let botName = "assistant";
    let images: string[] = [];
    let videos: string[] = [];

    onMount(async () => {
        await loadData();
    });

    async function loadData() {
        try {
            // Load jobs
            const jobsResponse = await fetch("/api/jobs");
            jobs = await jobsResponse.json();

            // Load messages
            const messagesResponse = await fetch("/api/messages");
            messages = await messagesResponse.json();

            // Load context
            const contextResponse = await fetch("/api/context");
            context = await contextResponse.json();

            // Load settings
            const settingsResponse = await fetch("/api/settings");
            const settings = await settingsResponse.json();
            botName = settings.name;

            // Load files
            const filesResponse = await fetch("/api/files");
            const files = await filesResponse.json();
            images = files.images;
            videos = files.videos;
        } catch (error) {
            console.error("Error loading data:", error);
        }
    }

    function handleDataUpdate() {
        loadData();
    }
</script>

<svelte:head>
    <title>AI Workshop Bot - Backend Interface</title>
    <link rel="stylesheet" href="/css/reset.css" />
    <link rel="stylesheet" href="/css/main.css" />
</svelte:head>

<div class="app">
    <h1>
        Backend Interface
        <BotSettings bind:botName on:update={handleDataUpdate} />
    </h1>

    <div class="context">
        <h2>Context of the Bot</h2>
        <textarea
            bind:value={context}
            on:change={async () => {
                try {
                    await fetch("/api/context", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ content: context }),
                    });
                    handleDataUpdate();
                } catch (error) {
                    console.error("Error updating context:", error);
                }
            }}
            cols="30"
            rows="10"
        ></textarea>
    </div>

    <div class="scheduler">
        <TaskScheduler {jobs} {images} {videos} on:update={handleDataUpdate} />
    </div>

    <div class="history">
        <ChatHistory {messages} on:update={handleDataUpdate} />
    </div>
</div>
