<script lang="ts">
    import { onMount, onDestroy } from "svelte";

    export let isVisible = false;

    function close() {
        isVisible = false;
    }

    function handleBackdropClick(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            close();
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
            close();
        }
    }

    // Prevent background scrolling when modal is open
    $: if (isVisible) {
        document.body.style.overflow = "hidden";
    } else {
        document.body.style.overflow = "";
    }

    // Cleanup on component destroy
    onDestroy(() => {
        document.body.style.overflow = "";
    });
</script>

{#if isVisible}
    <div
        class="modal-backdrop"
        on:click={handleBackdropClick}
        on:keydown={handleKeydown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-title"
        tabindex="-1"
    >
        <div class="modal">
            <button class="close-button" on:click={close}>×</button>
            <div class="modal-content">
                <div class="tile-title">
                    {#if window.innerWidth < 800}
                        Welcome
                    {:else}
                        Welcome to Digital Learning Assistant
                    {/if}
                </div>

                <section>
                    <p>
                        The Digital Learning Assistant is an interactive chatbot
                        designed to work with groups of people in Telegram. It
                        uses ChatGPT under the hood to generate intelligent
                        responses to user messages in real-time, making it
                        perfect for workshops, learning sessions, and
                        collaborative discussions.
                    </p>
                </section>

                <section>
                    <h2>Setup</h2>

                    <div class="step">
                        <h3>Step 1: Get Your OpenAI API Key</h3>
                        <ol>
                            <li>
                                Go to <a
                                    href="https://platform.openai.com/api-keys"
                                    target="_blank"
                                    >platform.openai.com/api-keys</a
                                >
                            </li>
                            <li>Sign in or create an account</li>
                            <li>Click "Create new secret key"</li>
                            <li>
                                Copy your API key (you won't be able to see it
                                again!)
                            </li>
                        </ol>
                    </div>

                    <div class="step">
                        <h3>Step 2: Configure Your Bot</h3>
                        <ol>
                            <li>
                                Use your Bot ID to access your bot dashboard
                            </li>
                            <li>Go to the Settings</li>
                            <li>Enter your OpenAI API key</li>
                            <li>
                                The Engagement Factor is the probability of the
                                bot to engage with the user. The default is 0.5.
                                You can change it to a value between 0 and 1.
                                The higher the value, the more the bot will
                                engage in the conversation
                            </li>
                            <li>
                                Customize the bot's system prompt to define its
                                personality and behavior by editing the Context
                                or upload pdf files that provide additional
                                knowledge
                            </li>
                        </ol>
                    </div>

                    <div class="step">
                        <h3>Step 3: Link to Telegram</h3>
                        <ol>
                            <li>
                                Add the bot <strong
                                    >@zhdk_ai_assistant_bot</strong
                                > to your Telegram group
                            </li>
                            <li>
                                In the group, type <code>/link</code> and follow
                                the instructions
                            </li>
                        </ol>
                    </div>

                    <div class="step">
                        <h3>Step 4: Unlink from Telegram</h3>
                        <ol>
                            <li>
                                In the group, type <code>/unlink</code> to remove
                                the bot from the group
                            </li>
                            <li>
                                The bot will not be deleted from the database,
                                but it will not be able to respond to messages
                                in the group anymore.
                            </li>
                        </ol>
                    </div>
                </section>

                <section>
                    <h2>Usage</h2>

                    <div class="usage-item">
                        <h3>Chat with the Bot</h3>
                        <p>
                            Mention the bot in your Telegram group chat. The bot
                            will respond using AI based on your conversation.
                            The bot can autonomousely engage in the
                            conversation, if it thinks it is relevant.
                        </p>
                    </div>

                    <div class="usage-item">
                        <h3>View Chat History</h3>
                        <p>
                            Check the "Chat History" in the dashboard to see all
                            conversations with your bot. Irrelevant or
                            inappropriate messages can also be deleted from the
                            chat history.
                        </p>
                    </div>

                    <div class="usage-item">
                        <h3>Schedule Messages</h3>
                        <p>
                            Use the "Task Scheduler" to schedule automatic
                            messages, images, or prompts at specific times. This
                            can help to keep the conversation engaging and
                            interesting as well as make it easier for the
                            partisipants to follow the schedule of the event.
                        </p>
                    </div>
                </section>

                <section class="about">
                    <h2>About</h2>
                    <p>
                        This tool was developed by Studio <a
                            href="https://alles-negativ.ch"
                            target="_blank">alles-negativ</a
                        >
                        for the AI Encounter workshop hosted at ZHdK in Zurich.
                    </p>
                    <p>
                        It is currently in a public beta phase and can be used
                        by anyone. Feedback is very much welcome on
                        <a
                            href="https://github.com/aurelianammon/digital-learning-bot"
                            target="_blank">Github</a
                        >. Use at your own risk.
                    </p>
                </section>
            </div>
        </div>
    </div>
{/if}

<style>
    :root {
        --modal-background: rgb(254, 134, 226);
    }
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
        overflow-y: auto;
    }

    .modal {
        background: white;
        border-radius: 20px;
        /* padding: 10px; */
        max-width: 800px;
        width: 100%;
        max-height: 60vh;
        overflow-y: auto;
        position: relative;
        background: var(--modal-background);
    }

    .modal::after {
        content: "";
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        border-radius: 20px;
        box-shadow: inset 0 0 0 10px var(--modal-background);
        pointer-events: none;
        z-index: 5;
        margin: auto;
        max-width: 800px;
        width: 100%;
        max-height: 60vh;
    }

    .modal-content {
        position: relative;
        padding: 10px;
    }

    .close-button {
        position: sticky;
        top: 10px;
        float: right;
        background: white;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: black;
        padding: 0;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        padding-bottom: 3px;
        border: 1px solid black;
        z-index: 10;
        margin-right: 10px;
        margin-bottom: -40px;
    }

    .close-button:hover {
        background: black;
        color: white;
    }

    .tile-title {
        margin-bottom: 30px;
    }

    section {
        margin-bottom: 20px;
    }

    section:last-child {
        margin-bottom: 0px;
    }

    h2 {
        font-size: 1.3em;
        font-weight: 500;
        margin-bottom: 10px;
        color: black;
        font-style: normal;
    }

    h3 {
        font-size: 14px;
        font-weight: 900;
        margin-bottom: 5px;
        color: black;
        font-style: normal;
    }

    ol {
        margin-left: 20px;
        margin-bottom: 10px;
    }

    p,
    li {
        font-size: 14px;
        line-height: 1.3;
        list-style-type: disc;
    }

    .usage-item {
        margin-bottom: 10px;
    }

    @media (max-width: 800px) {
        .modal::after {
            max-width: calc(100% - 40px);
        }
    }
</style>
