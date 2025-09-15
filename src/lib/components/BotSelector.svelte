<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";

    export let selectedBotId: string = "";

    let bots: any[] = [];
    let isCreating = false;
    let newBotName = "";

    const dispatch = createEventDispatcher();

    async function loadBots() {
        try {
            const response = await fetch("/api/bots");
            bots = await response.json();

            // If no bot is selected and we have bots, select the first one
            if (!selectedBotId && bots.length > 0) {
                selectedBotId = bots[0].id;
                dispatch("botSelected", { botId: selectedBotId });
            }
        } catch (error) {
            console.error("Error loading bots:", error);
        }
    }

    async function createBot() {
        if (!newBotName.trim()) return;

        try {
            const response = await fetch("/api/bots", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newBotName.trim() }),
            });

            if (response.ok) {
                const newBot = await response.json();
                selectedBotId = newBot.id;
                newBotName = "";
                isCreating = false;
                await loadBots();
                dispatch("botSelected", { botId: selectedBotId });
            }
        } catch (error) {
            console.error("Error creating bot:", error);
        }
    }

    function selectBot(botId: string) {
        selectedBotId = botId;
        dispatch("botSelected", { botId });
    }

    function handleBotIdInput(event: Event) {
        const target = event.target as HTMLInputElement;
        const botId = target.value.trim();
        if (botId) {
            selectBot(botId);
        }
    }

    // Load bots on component mount (client-side only)
    onMount(() => {
        loadBots();
    });
</script>

<div class="bot-selector">
    <div class="selector-header">
        <h2>Select Bot</h2>
        <button class="create-btn" on:click={() => (isCreating = !isCreating)}>
            {isCreating ? "✕" : "+"}
        </button>
    </div>

    {#if isCreating}
        <div class="create-form">
            <input
                type="text"
                placeholder="Bot name"
                bind:value={newBotName}
                on:keydown={(e) => e.key === "Enter" && createBot()}
            />
            <button on:click={createBot} disabled={!newBotName.trim()}
                >Create</button
            >
        </div>
    {/if}

    <div class="bot-list">
        {#each bots as bot}
            <div
                class="bot-item"
                class:active={selectedBotId === bot.id}
                on:click={() => selectBot(bot.id)}
            >
                <div class="bot-info">
                    <span class="bot-name">{bot.name}</span>
                    <span class="bot-stats">
                        {bot.linkedChatId ? "Linked" : "No chat"} • {bot._count
                            .messages} messages
                    </span>
                </div>
                <div class="bot-status" class:online={bot.isActive}></div>
            </div>
        {/each}
    </div>

    <div class="manual-input">
        <label for="botIdInput">Or enter Bot ID directly:</label>
        <input
            id="botIdInput"
            type="text"
            placeholder="Enter bot ID..."
            on:blur={handleBotIdInput}
            on:keydown={(e) => e.key === "Enter" && handleBotIdInput(e)}
        />
    </div>

    {#if selectedBotId}
        <div class="selected-bot">
            <strong>Selected Bot ID:</strong>
            <code>{selectedBotId}</code>
        </div>
    {/if}
</div>

<style>
    .bot-selector {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 24px;
    }

    .selector-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .selector-header h2 {
        margin: 0;
        font-size: 1.2em;
        color: #333;
    }

    .create-btn {
        background: #007bff;
        color: white;
        border: none;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        cursor: pointer;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .create-btn:hover {
        background: #0056b3;
    }

    .create-form {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
        padding: 12px;
        background: white;
        border-radius: 6px;
        border: 1px solid #ddd;
    }

    .create-form input {
        flex: 1;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
    }

    .create-form button {
        background: #28a745;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        cursor: pointer;
    }

    .create-form button:disabled {
        background: #ccc;
        cursor: not-allowed;
    }

    .bot-list {
        margin-bottom: 16px;
    }

    .bot-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .bot-item:hover {
        border-color: #007bff;
        box-shadow: 0 2px 4px rgba(0, 123, 255, 0.1);
    }

    .bot-item.active {
        border-color: #007bff;
        background: #e3f2fd;
    }

    .bot-info {
        flex: 1;
    }

    .bot-name {
        display: block;
        font-weight: 500;
        color: #333;
        margin-bottom: 4px;
    }

    .bot-stats {
        display: block;
        font-size: 0.85em;
        color: #666;
    }

    .bot-status {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #dc3545;
    }

    .bot-status.online {
        background: #28a745;
    }

    .manual-input {
        margin-bottom: 16px;
    }

    .manual-input label {
        display: block;
        margin-bottom: 4px;
        font-size: 0.9em;
        color: #666;
    }

    .manual-input input {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-family: monospace;
    }

    .selected-bot {
        padding: 8px;
        background: #e3f2fd;
        border-radius: 4px;
        font-size: 0.9em;
    }

    .selected-bot code {
        background: #fff;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 0.85em;
    }
</style>
