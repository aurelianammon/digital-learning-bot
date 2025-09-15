<script lang="ts">
    import { goto } from "$app/navigation";

    export let selectedBotId: string;

    function goToStartPage() {
        goto("/");
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

    .nav-button:active {
        transform: translateY(1px);
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
