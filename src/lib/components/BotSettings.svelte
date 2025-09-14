<script lang="ts">
    import { createEventDispatcher } from "svelte";

    export let botName: string = "assistant";

    const dispatch = createEventDispatcher();

    async function updateName() {
        try {
            await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: botName }),
            });
            dispatch("update");
        } catch (error) {
            console.error("Error updating bot name:", error);
        }
    }

    async function restartBot() {
        try {
            const response = await fetch("/api/bot/restart", {
                method: "POST",
            });
            if (response.ok) {
                alert("Bot restarted successfully!");
            } else {
                alert("Failed to restart bot");
            }
        } catch (error) {
            console.error("Error restarting bot:", error);
            alert("Error restarting bot");
        }
    }
</script>

<!-- Bot Settings -->
<div class="bot-settings">
    <input
        class="nameInput"
        bind:value={botName}
        on:change={updateName}
        on:focus={(e) => (e.target as HTMLInputElement)?.select()}
        title="Click to edit name 🖖"
    />
    <button
        class="restart-button"
        on:click={restartBot}
        title="Restart Telegram Bot"
    >
        🔄
    </button>
</div>

<style>
    .bot-settings {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .restart-button {
        background: #ff6b6b;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s;
    }

    .restart-button:hover {
        background: #ff5252;
    }
</style>
