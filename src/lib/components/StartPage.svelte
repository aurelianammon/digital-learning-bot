<script lang="ts">
    import { goto } from "$app/navigation";

    let botIdInput = "";
    let newBotName = "";
    let isCreating = false;
    let errorMessage = "";
    let successMessage = "";

    async function accessBot() {
        if (!botIdInput.trim()) {
            errorMessage = "Please enter a bot ID";
            return;
        }

        try {
            const response = await fetch(`/api/bots/${botIdInput.trim()}`);
            if (response.ok) {
                const bot = await response.json();
                errorMessage = "";
                // Navigate to the bot route
                goto(`/${botIdInput.trim()}`);
            } else {
                errorMessage = "Bot not found. Please check the bot ID.";
            }
        } catch (error) {
            console.error("Error accessing bot:", error);
            errorMessage = "Error accessing bot. Please try again.";
        }
    }

    async function createBot() {
        if (!newBotName.trim()) {
            errorMessage = "Please enter a bot name";
            return;
        }

        isCreating = true;
        errorMessage = "";

        try {
            const response = await fetch("/api/bots", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newBotName.trim() }),
            });

            if (response.ok) {
                const newBot = await response.json();
                successMessage = `Bot "${newBot.name}" created successfully! Bot ID: ${newBot.id}\n\nClick "Access Bot" above to enter this ID and access your bot.`;
                newBotName = "";
                // Auto-navigate to the new bot after creation
                setTimeout(() => {
                    goto(`/${newBot.id}`);
                }, 2000);
            } else {
                const error = await response.json();
                errorMessage = `Failed to create bot: ${error.error}`;
            }
        } catch (error) {
            console.error("Error creating bot:", error);
            errorMessage = "Error creating bot. Please try again.";
        } finally {
            isCreating = false;
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Enter") {
            if (botIdInput.trim()) {
                accessBot();
            } else if (newBotName.trim()) {
                createBot();
            }
        }
    }
</script>

<div class="start-page">
    <div class="start-container">
        <h1>🤖 AI Workshop Bot</h1>
        <p class="subtitle">Enter your bot ID to access your bot dashboard</p>

        <div class="access-section">
            <h2>Access Existing Bot</h2>
            <p class="instruction">
                Enter the Bot ID you received when creating your bot
            </p>
            <div class="input-group">
                <input
                    type="text"
                    bind:value={botIdInput}
                    placeholder="Enter Bot ID"
                    on:keydown={handleKeydown}
                    class="bot-id-input"
                />
                <button
                    on:click={accessBot}
                    disabled={!botIdInput.trim()}
                    class="access-button"
                >
                    Access Bot
                </button>
            </div>
        </div>

        <div class="divider">
            <span>or</span>
        </div>

        <div class="create-section">
            <h2>Create New Bot</h2>
            <div class="input-group">
                <input
                    type="text"
                    bind:value={newBotName}
                    placeholder="Enter Bot Name"
                    on:keydown={handleKeydown}
                    class="bot-name-input"
                />
                <button
                    on:click={createBot}
                    disabled={!newBotName.trim() || isCreating}
                    class="create-button"
                >
                    {isCreating ? "Creating..." : "Create Bot"}
                </button>
            </div>
        </div>

        {#if errorMessage}
            <div class="error-message">
                {errorMessage}
            </div>
        {/if}

        {#if successMessage}
            <div class="success-message">
                {successMessage}
            </div>
        {/if}
    </div>
</div>

<style>
    .start-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 20px;
    }

    .start-container {
        background: white;
        border-radius: 12px;
        padding: 40px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        max-width: 500px;
        width: 100%;
        text-align: center;
    }

    h1 {
        margin: 0 0 8px 0;
        color: #333;
        font-size: 2.5em;
        font-weight: 300;
    }

    .subtitle {
        color: #666;
        margin: 0 0 40px 0;
        font-size: 1.1em;
    }

    .access-section,
    .create-section {
        margin-bottom: 30px;
    }

    .access-section h2,
    .create-section h2 {
        margin: 0 0 8px 0;
        color: #444;
        font-size: 1.3em;
        font-weight: 500;
    }

    .instruction {
        margin: 0 0 16px 0;
        color: #666;
        font-size: 14px;
        font-style: italic;
    }

    .input-group {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
    }

    .bot-id-input,
    .bot-name-input {
        flex: 1;
        padding: 12px 16px;
        border: 2px solid #ddd;
        border-radius: 8px;
        font-size: 16px;
        transition: border-color 0.2s;
    }

    .bot-id-input:focus,
    .bot-name-input:focus {
        outline: none;
        border-color: #667eea;
    }

    .access-button,
    .create-button {
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
    }

    .access-button {
        background: #667eea;
        color: white;
    }

    .access-button:hover:not(:disabled) {
        background: #5a6fd8;
    }

    .access-button:disabled {
        background: #ccc;
        cursor: not-allowed;
    }

    .create-button {
        background: #28a745;
        color: white;
    }

    .create-button:hover:not(:disabled) {
        background: #218838;
    }

    .create-button:disabled {
        background: #ccc;
        cursor: not-allowed;
    }

    .divider {
        position: relative;
        margin: 30px 0;
        text-align: center;
    }

    .divider::before {
        content: "";
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 1px;
        background: #ddd;
    }

    .divider span {
        background: white;
        padding: 0 20px;
        color: #666;
        font-size: 14px;
    }

    .error-message {
        background: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
        border-radius: 6px;
        padding: 12px;
        margin-top: 16px;
        font-size: 14px;
    }

    .success-message {
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
        border-radius: 6px;
        padding: 12px;
        margin-top: 16px;
        font-size: 14px;
    }
</style>
