<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from "svelte";

    export let selectedBotId: string = "";

    const dispatch = createEventDispatcher();

    let messages: any[] = [];
    let loading = false;
    let pollInterval: NodeJS.Timeout | null = null;
    let lastMessageCount = 0;
    let showNewMessageIndicator = false;
    let isInitialLoad = true;

    async function loadMessages(showLoading = false) {
        if (!selectedBotId) return;

        // Only show loading state on initial load or when explicitly requested
        if (showLoading || isInitialLoad) {
            loading = true;
        }

        try {
            const response = await fetch("/api/messages", {
                headers: {
                    Authorization: `Bearer ${selectedBotId}`,
                    "X-Bot-ID": selectedBotId,
                },
            });
            const newMessages = await response.json();

            // Only update if messages actually changed
            if (JSON.stringify(newMessages) !== JSON.stringify(messages)) {
                messages = newMessages;

                // Dispatch event if new messages were added
                if (newMessages.length > lastMessageCount) {
                    dispatch("newMessages", {
                        count: newMessages.length - lastMessageCount,
                    });
                    showNewMessageIndicator = true;
                    // Hide indicator after 3 seconds
                    setTimeout(() => {
                        showNewMessageIndicator = false;
                    }, 3000);
                }
                lastMessageCount = newMessages.length;
            }
        } catch (error) {
            console.error("Error loading messages:", error);
        } finally {
            if (showLoading || isInitialLoad) {
                loading = false;
                isInitialLoad = false;
            }
        }
    }

    function startPolling() {
        // Clear any existing interval
        if (pollInterval) {
            clearInterval(pollInterval);
        }

        // Poll every 3 seconds for new messages
        pollInterval = setInterval(() => {
            loadMessages();
        }, 3000);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    // Load messages when component mounts or botId changes
    onMount(() => {
        loadMessages(true); // Show loading on initial mount
        startPolling();
    });

    onDestroy(() => {
        stopPolling();
    });

    $: if (selectedBotId) {
        loadMessages(true); // Show loading when switching bots
        startPolling();
    } else {
        stopPolling();
    }

    async function removeMessage(messageId: string) {
        try {
            await fetch(`/api/messages/${messageId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${selectedBotId}`,
                    "X-Bot-ID": selectedBotId,
                },
            });
            // Reload messages after removing
            await loadMessages(false);
        } catch (error) {
            console.error("Error removing message:", error);
        }
    }
</script>

<div class="chat-history">
    <div class="chat-history-header">
        <h3 class="tile-title">Chat History</h3>
        {#if showNewMessageIndicator}
            <span class="new-message-indicator">✨ Updated!</span>
        {/if}
    </div>

    <div class="chat-history-content">
        {#if loading}
            <div class="loading">Loading messages...</div>
        {:else if messages.length === 0}
            <div class="no-messages">No messages yet</div>
        {:else}
            {#each messages as message, index (message.id)}
                <div class="message">
                    <div class="header">
                        <div class="date">
                            {new Date(message.createdAt).toLocaleString(
                                "de-CH",
                                {
                                    timeZone: "Europe/Zurich",
                                }
                            )}
                        </div>
                        <div class="type">{message.role}</div>
                        <button
                            class="controll_button"
                            title="Remove message from history 💀"
                            on:click={() => removeMessage(message.id)}
                        >
                            ×
                        </button>
                    </div>
                    <div class="message-content">
                        {@html message.content}
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</div>

<style>
    .chat-history {
        background: #ff7272;
        padding: 10px;
        height: fit-content;
    }

    .tile-title {
        margin-bottom: 0px;
    }

    .chat-history-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    }

    .chat-history-content {
        max-height: 800px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .loading {
        text-align: center;
        padding: 20px;
        color: #000000;
        font-style: normal;
    }

    .no-messages {
        text-align: center;
        padding: 20px;
        color: #000000;
        font-style: normal;
    }

    .new-message-indicator {
        font-size: 0.8em;
        color: #4caf50;
        font-weight: normal;
        margin-left: 10px;
        animation: pulse 1s ease-in-out;
    }

    @keyframes pulse {
        0% {
            opacity: 1;
        }
        50% {
            opacity: 0.5;
        }
        100% {
            opacity: 1;
        }
    }

    .message {
        background: transparent;
        height: auto;
        padding: 10px;
        border-radius: 8px;
        border: 1px solid black;
        font-size: 14px;
        line-height: 1.5;
    }
    .message .header {
        font-size: 10px;
        margin-bottom: 5px;
        height: 17px;
        line-height: 16px;
    }
    .header .date {
        /* width: 50%; */
        float: left;
        background-color: black;
        color: white;
        margin-right: 5px;
        border-radius: 0px;
        padding: 0 5px;
        padding-bottom: 1px;
    }
    .header .type {
        float: left;
        background-color: black;
        color: white;
        margin-right: 5px;
        border-radius: 0px;
        padding: 0 5px;
        padding-bottom: 1px;
        text-transform: uppercase;
    }
    .message .controll_button {
        float: right;
        height: 17px;
        font-size: 10px;
        line-height: 7px;
        /* background-color: coral; */
        cursor: pointer;
        padding: 0 6px;
        padding-bottom: 1px;
        border-radius: 0px;
    }
    .message-content {
        white-space: break-spaces;
        /* line-height: 17px; */
    }
</style>
