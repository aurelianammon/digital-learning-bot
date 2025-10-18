<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import Introduction from "$lib/components/Introduction.svelte";

    export let selectedBotId: string;

    let showIntro = false;
    let selectedBot: any = null;
    let hasCheckedIntro = false;

    onMount(async () => {
        if (selectedBotId) {
            await loadBotForIntro();
        }
    });

    async function loadBotForIntro() {
        try {
            const botResponse = await fetch(`/api/bots/${selectedBotId}`);
            if (botResponse.ok) {
                selectedBot = await botResponse.json();
                // Check if intro should be shown
                if (!selectedBot.introShown) {
                    setTimeout(() => {
                        showIntro = true;
                    }, 1000);
                }
                hasCheckedIntro = true;
            }
        } catch (error) {
            console.error("Error loading bot for intro:", error);
        }
    }

    // Watch for intro being closed and update the database
    $: if (
        hasCheckedIntro &&
        !showIntro &&
        selectedBot &&
        !selectedBot.introShown
    ) {
        updateIntroShown();
    }

    async function updateIntroShown() {
        if (!selectedBotId) return;

        try {
            await fetch(`/api/bots/${selectedBotId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    introShown: true,
                }),
            });
            // Update local state
            if (selectedBot) {
                selectedBot.introShown = true;
            }
        } catch (error) {
            console.error("Error updating intro shown status:", error);
        }
    }

    function goToStartPage() {
        goto("/");
    }

    function showIntroduction() {
        showIntro = true;
    }
</script>

<nav class="navigation">
    <div class="nav-content">
        <h1 class="nav-title">
            <span class="full-title">Digital Learning Assistant</span>
            <span class="short-title">D.L.A.</span>
        </h1>
        <div class="buttons">
            <button
                class="nav-button"
                class:active={showIntro}
                title="Introduction"
                on:click={showIntroduction}
            >
                Intro
            </button>
            <button
                class="nav-button id-button"
                title="Copy Bot ID to clipboard"
                on:click={() => navigator.clipboard.writeText(selectedBotId)}
            >
                {selectedBotId}
            </button>
            <button
                class="nav-button"
                title="Go back to Start Page"
                on:click={goToStartPage}
            >
                Logout
            </button>
        </div>
    </div>
</nav>

<Introduction bind:isVisible={showIntro} />

<style>
    .navigation {
        background: transparent;
        padding: 10px;
    }

    .nav-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .nav-title {
        /* font-weight: 900; */
        margin: 0;
        color: white;
        font-size: 20px;
        font-style: normal;
        font-weight: normal;
    }

    .short-title {
        display: none;
    }

    .full-title {
        display: inline;
    }

    .nav-button {
        background: black;
        color: white;
        border: 1px solid white;
        padding: 0 15px;
        height: 40px;
        min-width: 40px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: regular;
        cursor: pointer;
        transition: all 0.2s ease;
        padding-bottom: 2px;
    }

    .nav-button:hover {
        background: white;
        color: black;
        border-color: white;
    }

    .nav-button.active {
        background: white;
        color: black;
        border-color: white;
    }

    .buttons {
        display: flex;
        gap: 10px;
        align-items: center;
    }

    /* Mobile responsive styles */
    @media (max-width: 768px) {
        .id-button {
            display: none;
        }

        .short-title {
            display: inline;
        }

        .full-title {
            display: none;
        }
    }
</style>
