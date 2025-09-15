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
    <div class="basic-settings">
        <input
            class="nameInput"
            bind:value={botName}
            on:change={updateBotName}
            on:focus={(e) => (e.target as HTMLInputElement)?.select()}
            title="Click to edit name 🖖"
        />
        <button
            class="settings-button"
            on:click={() => (showApiKeySettings = !showApiKeySettings)}
            title="API Settings"
        >
            🔑
        </button>
        <button
            class="settings-button"
            on:click={() => (showLinkedChat = !showLinkedChat)}
            title="Linked Chat"
        >
            💬 {linkedChat ? "Linked" : "No chat"}
        </button>
        <button
            class="delete-button"
            on:click={() => (showDeleteConfirm = true)}
            title="Delete Bot"
        >
            🗑️
        </button>
    </div>

    {#if showApiKeySettings}
        <div class="api-settings">
            <h4>API Configuration</h4>
            <div class="setting-group">
                <label for="openaiKey">OpenAI API Key:</label>
                <div class="key-input-group">
                    <input
                        id="openaiKey"
                        type="password"
                        bind:value={openaiKey}
                        placeholder="sk-..."
                    />
                    <button on:click={updateApiKey} class="save-btn"
                        >Save</button
                    >
                </div>
            </div>
        </div>
    {/if}

    {#if showLinkedChat}
        <div class="linked-chat">
            <h4>Linked Chat</h4>

            {#if !linkedChat}
                <div class="pin-verification">
                    <h5>Link Chat to This Bot</h5>
                    <p>
                        1. Add any Telegram bot to a chat<br />
                        2. Send <code>/link</code> in that chat<br />
                        3. Enter the PIN you receive here to link that chat to
                        <strong>this specific bot</strong>:
                    </p>
                    <div class="pin-input-group">
                        <input
                            type="text"
                            bind:value={pinToVerify}
                            placeholder="Enter 6-digit PIN"
                            maxlength="6"
                            on:keydown={(e) => e.key === "Enter" && verifyPin()}
                        />
                        <button
                            on:click={verifyPin}
                            disabled={!pinToVerify.trim()}>Verify</button
                        >
                    </div>
                    {#if verificationMessage}
                        <div class="verification-message">
                            {verificationMessage}
                        </div>
                    {/if}
                </div>
            {/if}

            {#if linkedChat}
                <div class="current-chat">
                    <h5>Current Linked Chat</h5>
                    <div class="chat-item">
                        <div class="chat-info">
                            <span class="chat-id"
                                >Chat ID: {linkedChat.chatId}</span
                            >
                            <span class="chat-date"
                                >Linked: {new Date(
                                    linkedChat.linkedAt
                                ).toLocaleDateString()}</span
                            >
                        </div>
                        <button
                            class="unlink-btn"
                            on:click={unlinkChat}
                            title="Unlink chat"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            {:else}
                <p>No chat linked to this bot yet.</p>
            {/if}
        </div>
    {/if}

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
        min-width: 300px;
    }

    .basic-settings {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
    }

    .nameInput {
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        flex: 1;
        min-width: 120px;
    }

    .settings-button {
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s;
        white-space: nowrap;
    }

    .settings-button:hover {
        background: #0056b3;
    }

    .delete-button {
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s;
        white-space: nowrap;
    }

    .delete-button:hover {
        background: #c82333;
    }

    .api-settings,
    .linked-chat {
        background: #f8f9fa;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 16px;
        margin-bottom: 16px;
    }

    .api-settings h4,
    .linked-chat h4 {
        margin: 0 0 12px 0;
        color: #333;
    }

    .setting-group {
        margin-bottom: 12px;
    }

    .setting-group label {
        display: block;
        margin-bottom: 4px;
        font-weight: 500;
        color: #555;
    }

    .key-input-group,
    .pin-input-group {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .key-input-group input,
    .pin-input-group input {
        flex: 1;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-family: monospace;
    }

    .save-btn {
        background: #28a745;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
    }

    .save-btn:hover {
        background: #218838;
    }

    .pin-verification {
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 12px;
        margin-bottom: 16px;
    }

    .pin-verification h5 {
        margin: 0 0 8px 0;
        color: #333;
    }

    .pin-verification p {
        margin: 0 0 8px 0;
        font-size: 0.9em;
        color: #666;
    }

    .pin-verification code {
        background: #e9ecef;
        padding: 2px 4px;
        border-radius: 3px;
        font-weight: bold;
    }

    .verification-message {
        margin-top: 8px;
        padding: 8px;
        border-radius: 4px;
        font-size: 0.9em;
    }

    .pending-links,
    .current-chat {
        margin-bottom: 16px;
    }

    .pending-links h5,
    .current-chat h5 {
        margin: 0 0 8px 0;
        color: #333;
    }

    .pending-link {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 4px;
        padding: 8px;
        margin-bottom: 4px;
        font-size: 0.85em;
    }

    .pending-link span {
        display: block;
        margin-bottom: 2px;
    }

    .pending-link code {
        background: #fff;
        padding: 1px 4px;
        border-radius: 3px;
        font-weight: bold;
        color: #d63384;
    }

    .chat-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 8px;
        margin-bottom: 4px;
    }

    .chat-info {
        flex: 1;
    }

    .chat-id {
        display: block;
        font-family: monospace;
        font-size: 0.85em;
        color: #333;
        margin-bottom: 2px;
    }

    .chat-name {
        display: block;
        font-weight: 500;
        color: #007bff;
        margin-bottom: 2px;
    }

    .chat-date {
        display: block;
        font-size: 0.8em;
        color: #666;
    }

    .unlink-btn {
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .unlink-btn:hover {
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
