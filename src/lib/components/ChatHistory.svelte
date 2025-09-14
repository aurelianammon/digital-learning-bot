<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let messages: any[] = [];

	const dispatch = createEventDispatcher();

	async function removeMessage(messageId: string) {
		try {
			await fetch(`/api/messages/${messageId}`, {
				method: 'DELETE'
			});
			dispatch('update');
		} catch (error) {
			console.error('Error removing message:', error);
		}
	}
</script>

<h2>Active Chat History</h2>

{#each messages as message, index (message.id)}
	<div class="job">
		<div class="header">
			<div class="type">{message.role}</div>
			<button
				class="controll_button"
				title="Remove message from history 💀"
				on:click={() => removeMessage(message.id)}
			>
				×
			</button>
		</div>
		<div class="message">
			{@html message.content}
		</div>
	</div>
{/each}