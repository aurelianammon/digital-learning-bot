<script lang="ts">
    import { createEventDispatcher } from "svelte";

    export let context: string = "";
    export let selectedBotId: string = "";

    const dispatch = createEventDispatcher();

    async function handleContextChange() {
        try {
            await fetch("/api/context", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: context,
                    botId: selectedBotId,
                }),
            });
            dispatch("update");
        } catch (error) {
            console.error("Error updating context:", error);
        }
    }
</script>

<div class="context">
    <h3 class="tile-title">Context / Personality</h3>
    <textarea
        bind:value={context}
        on:change={handleContextChange}
        cols="30"
        rows="10"
        placeholder="Enter the context and personality for this bot..."
    ></textarea>
</div>

<style>
    .context {
        border-radius: 20px;
        box-sizing: border-box;
        grid-column: 3 / 7;
        grid-row: 1;
        overflow: hidden;
        padding: 10px;
        background: rgb(200, 255, 186);
        height: fit-content;
    }

    textarea {
        width: 100%;
        border: 1px solid #000000;
        border-radius: 8px;
        padding: 12px;
        font-family: inherit;
        font-size: 14px;
        resize: vertical;
        min-height: 200px;
        box-sizing: border-box;
    }

    textarea:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
    }
</style>
