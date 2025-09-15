<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount, onDestroy } from "svelte";

    let botIdInput = "";
    let newBotName = "";
    let isCreating = false;
    let errorMessage = "";
    let successMessage = "";
    let startPageElement: HTMLElement;
    let animationId: number;

    // Gradient animation variables
    let hue = 0;
    let angle = 0;
    let colorIndex = 0;
    const colors = [
        "#ff6b6b",
        "#4ecdc4",
        "#45b7d1",
        "#96ceb4",
        "#feca57",
        "#ff9ff3",
        "#54a0ff",
        "#a55eea",
    ];

    function animateGradient() {
        // Increment hue for color cycling
        hue = (hue + 0.5) % 360;

        // Increment angle for orientation changes
        angle = (angle + 0.3) % 360;

        // Cycle through color index for additional variation
        colorIndex = (colorIndex + 0.1) % colors.length;

        // Create dynamic gradient
        const color1 = `hsl(${hue}, 70%, 60%)`;
        const color2 = `hsl(${(hue + 120) % 360}, 70%, 60%)`;
        const color3 = `hsl(${(hue + 240) % 360}, 70%, 60%)`;

        // Apply the gradient
        if (startPageElement) {
            startPageElement.style.background = `linear-gradient(${angle}deg, ${color1}, ${color2}, ${color3})`;
        }

        // Continue animation
        animationId = requestAnimationFrame(animateGradient);
    }

    onMount(() => {
        if (startPageElement) {
            animateGradient();
        }
    });

    onDestroy(() => {
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
    });

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
                successMessage = `Bot "${newBot.name}" created successfully! Your bot ID is:<br><br><div class="bot-id">${newBot.id}</div><br>Important: Save this ID now! You will lose access to your bot if you don't save it.<br><br>You can now use this ID to access your bot dashboard.`;
                newBotName = "";
                // Auto-navigate to the new bot after creation
                // setTimeout(() => {
                //     goto(`/${newBot.id}`);
                // }, 2000);
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

<div class="start-page" bind:this={startPageElement}>
    <div class="start-container">
        <h3 class="tile-title">Digital Learning Assistant</h3>

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
                {@html successMessage}
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
        background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1);
        transition: background 0.1s ease;
        /* padding: 20px; */
    }

    .tile-title {
        font-size: 14px;
        border: 1px solid black;
        border-radius: 20px;
        padding: 0 14px;
        height: 38px;
        line-height: 37px;
        width: fit-content;
        margin-bottom: 30px;
    }

    .start-container {
        background: white;
        border-radius: 20px;
        padding: 10px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        max-width: 500px;
        width: calc(100% - 40px);
        /* text-align: center; */
    }

    .access-section h2,
    .create-section h2 {
        margin: 0 0 5px 0;
        color: #000000;
        font-size: 1.3em;
        font-weight: 500;
    }

    .create-section h2 {
        margin: 0 0 10px 0;
    }

    .instruction {
        margin: 0 0 10px 0;
        color: black;
        font-size: 14px;
        /* font-style: italic; */
    }

    .input-group {
        display: flex;
        gap: 10px;
        /* margin-bottom: 16px; */
    }

    .bot-id-input,
    .bot-name-input {
        flex: 1;
        padding: 8px;
        border: 1px solid black;
        border-radius: 6px;
        font-size: 14px;
        height: 22px;
        transition: border-color 0.2s;
    }

    .bot-id-input:focus,
    .bot-name-input:focus {
        outline: none;
        border-color: #667eea;
    }

    .access-button,
    .create-button {
        padding: 8px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
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
        margin: 20px 0;
        /* text-align: center; */
    }

    .divider span {
        background: white;
        padding: 0 0px;
        color: black;
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
        margin-top: 10px;
        font-size: 14px;
        line-height: 1.3;
    }

    h2 {
        font-style: normal;
    }
</style>
