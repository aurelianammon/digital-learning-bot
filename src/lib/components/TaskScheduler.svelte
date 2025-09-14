<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { marked } from 'marked';

	export let jobs: any[] = [];
	export let images: string[] = [];
	export let videos: string[] = [];

	const dispatch = createEventDispatcher();

	let type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'PROMPT' = 'TEXT';
	let text = '';
	let date = '';
	let fileInput: HTMLInputElement;

	$: filteredJobs = jobs.map(job => ({
		...job,
		state: new Date(job.date) > new Date(Date.now())
	}));

	async function addJob() {
		if (!date || !text) return;

		try {
			const message = type === 'TEXT' || type === 'PROMPT' ? marked.parseInline(text) : text;
			
			await fetch('/api/jobs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type,
					message,
					date: new Date(date).toISOString()
				})
			});

			text = '';
			date = '';
			dispatch('update');
		} catch (error) {
			console.error('Error adding job:', error);
		}
	}

	async function removeJob(jobId: string) {
		try {
			await fetch(`/api/jobs/${jobId}`, {
				method: 'DELETE'
			});
			dispatch('update');
		} catch (error) {
			console.error('Error removing job:', error);
		}
	}

	async function uploadFile() {
		if (!fileInput.files?.[0]) return;

		const formData = new FormData();
		formData.append('file', fileInput.files[0]);
		formData.append('type', type);

		try {
			await fetch('/api/files', {
				method: 'POST',
				body: formData
			});

			fileInput.value = '';
			dispatch('update');
		} catch (error) {
			console.error('Error uploading file:', error);
		}
	}
</script>

<div class="top">
	<h2>Task Scheduler</h2>
	<button class:active={type === 'VIDEO'} on:click={() => type = 'VIDEO'}>📹</button>
	<button class:active={type === 'IMAGE'} on:click={() => type = 'IMAGE'}>📷</button>
	<button class:active={type === 'TEXT'} on:click={() => type = 'TEXT'}>🗞️</button>
	<button class:active={type === 'PROMPT'} on:click={() => type = 'PROMPT'}>🤖</button>
</div>

<div class="add">
	{#if type === 'TEXT' || type === 'PROMPT'}
		<textarea
			bind:value={text}
			placeholder="Markdown formatted text"
			rows="4"
		></textarea>
	{:else}
		<div class="select">
			{#if type === 'IMAGE'}
				<select bind:value={text}>
					<option disabled value="">Please select image</option>
					{#each images as image}
						<option value={image}>{image}</option>
					{/each}
				</select>
			{:else if type === 'VIDEO'}
				<select bind:value={text}>
					<option disabled value="">Please select video</option>
					{#each videos as video}
						<option value={video}>{video}</option>
					{/each}
				</select>
			{/if}
			
			<form on:submit|preventDefault={uploadFile}>
				<label for="file-upload" class="custom-file-upload">Upload File</label>
				<input
					id="file-upload"
					bind:this={fileInput}
					type="file"
					accept={type === 'IMAGE' ? 'image/*' : 'video/*'}
					on:change={uploadFile}
				/>
			</form>
		</div>
	{/if}

	<input bind:value={date} type="datetime-local" step="1" />
	<button on:click={addJob}>Add Task</button>
</div>

{#each filteredJobs as job (job.id)}
	<div class="job" class:inactive={!job.state}>
		<div class="header">
			<div class="date">
				{new Date(job.date).toLocaleString('de-CH', { timeZone: 'Europe/Zurich' })}
			</div>
			<div class="type">{job.type}</div>
			<button class="controll_button" on:click={() => removeJob(job.id)}>×</button>
		</div>
		<div class="message">
			{@html job.message}
		</div>
	</div>
{/each}