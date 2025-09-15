<script lang="ts">
    import { createEventDispatcher } from "svelte";

    export let botName: string = "assistant";
    export let selectedBotId: string = "";
    export let selectedBot: any = null;

    const dispatch = createEventDispatcher();

    let openaiKey = "";
    let linkedChat: any = null;
    let pinToVerify = "";
    let showApiKeySettings = false;
    let showLinkedChat = false;
    let verificationMessage = "";
    let showDeleteConfirm = false;

    $: if (selectedBot) {
        openaiKey = selectedBot.openaiKey || "";
        linkedChat = selectedBot.linkedChatId
            ? {
                  chatId: selectedBot.linkedChatId,
                  linkedAt: selectedBot.linkedAt,
              }
            : null;
    }

    async function updateBotName() {
        if (!selectedBotId) {
            console.warn("No bot selected for name update");
            return;
        }

        try {
            await fetch(`/api/bots/${selectedBotId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: botName }),
            });
            dispatch("update");
        } catch (error) {
            console.error("Error updating bot name:", error);
        }
    }

    async function updateApiKey() {
        if (!selectedBotId) return;

        try {
            await fetch(`/api/bots/${selectedBotId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ openaiKey }),
            });
            dispatch("update");
            showApiKeySettings = false;
        } catch (error) {
            console.error("Error updating OpenAI API key:", error);
        }
    }

    async function verifyPin() {
        if (!selectedBotId || !pinToVerify.trim()) return;

        try {
            const response = await fetch(
                `/api/bots/${selectedBotId}/verify-pin`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pin: pinToVerify.trim() }),
                }
            );

            const result = await response.json();

            if (response.ok) {
                verificationMessage = `✅ ${result.message}`;
                pinToVerify = "";
                dispatch("update");
            } else {
                verificationMessage = `❌ ${result.error}`;
            }

            // Clear message after 3 seconds
            setTimeout(() => {
                verificationMessage = "";
            }, 3000);
        } catch (error) {
            console.error("Error verifying PIN:", error);
            verificationMessage = "❌ Error verifying PIN";
            setTimeout(() => {
                verificationMessage = "";
            }, 3000);
        }
    }

    async function unlinkChat() {
        if (!selectedBotId) return;

        try {
            await fetch(`/api/bots/${selectedBotId}/chats`, {
                method: "DELETE",
            });
            dispatch("update");
        } catch (error) {
            console.error("Error unlinking chat:", error);
        }
    }

    async function deleteBot() {
        if (!selectedBotId) return;

        try {
            const response = await fetch(`/api/bots/${selectedBotId}`, {
                method: "DELETE",
            });

            if (response.ok) {
                const result = await response.json();
                alert(result.message || "Bot deleted successfully!");
                showDeleteConfirm = false;
                // Trigger a refresh/redirect since the bot no longer exists
                window.location.reload();
            } else {
                const error = await response.json();
                alert(`Failed to delete bot: ${error.error}`);
            }
        } catch (error) {
            console.error("Error deleting bot:", error);
            alert("Error deleting bot");
        }
    }
</script>

<!-- Bot Settings -->
<div class="bot-settings">
    <h3 class="tile-title">Settings</h3>

    <div class="setting-sections">
        <!-- Bot Name Section -->
        <div class="setting-section">
            <label class="section-label">Name</label>
            <input
                class="name-input"
                bind:value={botName}
                on:change={updateBotName}
                on:focus={(e) => (e.target as HTMLInputElement)?.select()}
                placeholder="Enter bot name..."
            />
        </div>

        <!-- API Key Section -->
        <div class="setting-section">
            <div class="section-header">
                {#if openaiKey}
                    <label class="section-label">API Configuration ✔️</label>
                {:else}
                    <label class="section-label">API Configuration</label>
                {/if}
                <button
                    class="toggle-button"
                    on:click={() => (showApiKeySettings = !showApiKeySettings)}
                    class:active={showApiKeySettings}
                >
                    {showApiKeySettings ? "▼" : "▶"}
                </button>
            </div>
            {#if showApiKeySettings}
                <div class="setting-content">
                    <input
                        type="password"
                        bind:value={openaiKey}
                        placeholder="sk-..."
                        class="api-key-input"
                    />
                    <button on:click={updateApiKey} class="save-button">
                        Save Key
                    </button>
                </div>
            {/if}
        </div>

        <!-- Chat Linking Section -->
        <div class="setting-section">
            <div class="section-header">
                {#if linkedChat}
                    <label class="section-label">Telegram Chat ✔️</label>
                {:else}
                    <label class="section-label">Telegram Chat</label>
                {/if}
                <button
                    class="toggle-button"
                    on:click={() => (showLinkedChat = !showLinkedChat)}
                    class:active={showLinkedChat}
                >
                    {showLinkedChat ? "▼" : "▶"}
                </button>
            </div>
            {#if showLinkedChat}
                <div class="setting-content">
                    {#if !linkedChat}
                        <div class="link-instructions">
                            <p>1. Add bot to Telegram chat</p>
                            <p>2. Send <code>/link</code> command</p>
                            <p>3. Enter PIN below:</p>
                        </div>
                        <div class="pin-section">
                            <input
                                type="text"
                                bind:value={pinToVerify}
                                placeholder="6-digit PIN"
                                maxlength="6"
                                class="pin-input"
                                on:keydown={(e) =>
                                    e.key === "Enter" && verifyPin()}
                            />
                            <button
                                on:click={verifyPin}
                                disabled={!pinToVerify.trim()}
                                class="verify-button"
                            >
                                Link
                            </button>
                        </div>
                        {#if verificationMessage}
                            <div class="verification-message">
                                {verificationMessage}
                            </div>
                        {/if}
                    {:else}
                        <div class="linked-chat-info">
                            <button class="unlink-button" on:click={unlinkChat}>
                                Unlink from {linkedChat.chatId}
                            </button>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>

        <!-- Actions Section -->
        <div class="setting-section actions-section">
            <label class="section-label">Actions</label>
            <div class="action-buttons">
                <button
                    class="delete-button"
                    title="Permanently delete bot"
                    on:click={() => (showDeleteConfirm = true)}
                >
                    Delete
                </button>
            </div>
        </div>
    </div>

    {#if showDeleteConfirm}
        <div class="delete-confirmation">
            <div class="confirmation-dialog">
                <h4>⚠️ Delete Bot</h4>
                <p>
                    Are you sure you want to delete <strong
                        >"{selectedBot?.name}"</strong
                    >?
                </p>
                <p class="warning-text">
                    This will permanently delete:
                    <br />• All messages for this bot
                    <br />• All scheduled jobs for this bot
                    <br />• The bot configuration itself
                </p>
                <p><strong>This action cannot be undone!</strong></p>

                <div class="confirmation-buttons">
                    <button
                        class="cancel-button"
                        on:click={() => (showDeleteConfirm = false)}
                    >
                        Cancel
                    </button>
                    <button class="confirm-delete-button" on:click={deleteBot}>
                        Delete Permanently
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    .bot-settings {
        background: rgb(255, 238, 107);
        width: 100%;
        height: 100%;
        padding: 10px;
        box-sizing: border-box;
    }

    .setting-sections {
        display: flex;
        flex-direction: column;
        gap: 10px;
        height: calc(100% - 50px);
    }

    /* Setting Sections */
    .setting-section {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .section-label {
        font-size: 12px;
        font-weight: 600;
        color: #000000;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0;
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .toggle-button {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 12px;
        color: black;
        padding: 0px;
        padding-right: 5px;
        transition: color 0.2s;
    }

    .toggle-button:hover {
        color: #333;
    }

    .setting-content {
        display: flex;
        flex-direction: column;
        gap: 5px;
        /* padding-left: 8px;
        border-left: 2px solid #e9ecef; */
    }

    /* Input Styles */
    .name-input {
        width: 100%;
        padding: 8px;
        border: 1px solid #000000;
        border-radius: 6px;
        font: inherit;
        font-size: 14px;
        line-height: 17px;
        box-sizing: border-box;
    }

    .name-input:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
    }

    .api-key-input {
        width: 100%;
        padding: 8px;
        border: 1px solid black;
        border-radius: 6px;
        font-family: monospace;
        font-size: 14px;
        box-sizing: border-box;
        line-height: 17px;
    }

    .api-key-input:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
    }

    /* Button Styles */
    .save-button {
        background: black;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        cursor: pointer;
        height: 35px;
        font-size: 14px;
        font-weight: 500;
        transition: background-color 0.2s;
    }

    .save-button:hover {
        background: #00a724;
    }

    /* Link Instructions */
    .link-instructions {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        padding: 12px;
        font-size: 12px;
        line-height: 1.4;
    }

    .link-instructions p {
        margin: 0 0 4px 0;
        color: #666;
    }

    .link-instructions code {
        background: #e9ecef;
        padding: 2px 4px;
        border-radius: 3px;
        font-weight: bold;
        color: #333;
    }

    /* PIN Section */
    .pin-section {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .pin-input {
        flex: 1;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        line-height: 17px;
        text-align: center;
        letter-spacing: 2px;
        font-family: monospace;
    }

    .pin-input:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
    }

    .verify-button {
        background: black;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px;
        height: 35px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background-color 0.2s;
    }

    .verify-button:hover:not(:disabled) {
        background: #0056b3;
    }

    .verify-button:disabled {
        background: #6c757d;
        cursor: not-allowed;
    }

    /* Verification Message */
    .verification-message {
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        text-align: center;
    }

    /* Linked Chat Info */
    .linked-chat-info {
        display: flex;
        flex-direction: column;
        gap: 5px;
        font-size: 14px;
        line-height: 17px;
    }

    .unlink-button {
        background: black;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px;
        cursor: pointer;
        font-size: 14px;
        height: 35px;
        transition: background-color 0.2s;
        align-self: flex-start;
        width: 100%;
    }

    .unlink-button:hover {
        background: #c82333;
    }

    /* Actions Section */
    .actions-section {
        margin-top: auto;
    }

    .action-buttons {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .delete-button {
        background: #000000;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px;
        cursor: pointer;
        font-size: 14px;
        height: 35px;
        font-weight: 500;
        transition: background-color 0.2s;
    }

    .delete-button:hover {
        background: #c82333;
    }

    /* Delete confirmation styles */
    .delete-confirmation {
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

    .confirmation-dialog {
        background: white;
        border-radius: 8px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .confirmation-dialog h4 {
        margin: 0 0 16px 0;
        color: #dc3545;
        font-size: 1.2em;
    }

    .confirmation-dialog p {
        margin: 0 0 12px 0;
        line-height: 1.4;
    }

    .warning-text {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 4px;
        padding: 12px;
        color: #856404;
        font-size: 0.9em;
    }

    .confirmation-buttons {
        display: flex;
        gap: 12px;
        margin-top: 20px;
        justify-content: flex-end;
    }

    .cancel-button {
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
    }

    .cancel-button:hover {
        background: #5a6268;
    }

    .confirm-delete-button {
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
    }

    .confirm-delete-button:hover {
        background: #c82333;
    }
</style>
