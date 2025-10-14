<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { browser } from "$app/environment";

    export let context: string = "";
    export let selectedBotId: string = "";

    const dispatch = createEventDispatcher();

    // PDF.js library (loaded dynamically in browser only)
    let pdfjsLib: any = null;
    let pdfLibLoading = true;

    let contextFiles: Array<{
        id: string;
        originalName: string;
        summary: string;
        createdAt: string;
    }> = [];
    let uploading = false;
    let fileInput: HTMLInputElement;
    let detailsOpen = false;

    onMount(async () => {
        // Load PDF.js only in the browser
        if (browser) {
            try {
                // console.log("Loading PDF.js library...");
                const pdfjs = await import("pdfjs-dist");
                pdfjsLib = pdfjs;

                // Use local worker from static directory
                pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

                // console.log("PDF.js library loaded successfully");
                pdfLibLoading = false;
            } catch (error) {
                console.error("Failed to load PDF.js library:", error);
                pdfLibLoading = false;
            }
        } else {
            pdfLibLoading = false;
        }
        loadContextFiles();
    });

    async function loadContextFiles() {
        if (!selectedBotId) return;

        try {
            const response = await fetch("/api/context-files", {
                headers: {
                    Authorization: `Bearer ${selectedBotId}`,
                    "X-Bot-ID": selectedBotId,
                },
            });
            const data = await response.json();
            contextFiles = data.contextFiles || [];
        } catch (error) {
            console.error("Error loading context files:", error);
        }
    }

    async function handleContextChange() {
        try {
            await fetch("/api/context", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${selectedBotId}`,
                    "X-Bot-ID": selectedBotId,
                },
                body: JSON.stringify({
                    content: context,
                }),
            });
            dispatch("update");
        } catch (error) {
            console.error("Error updating context:", error);
        }
    }

    async function parsePDFText(file: File): Promise<string> {
        try {
            if (!pdfjsLib) {
                console.error("PDF.js library not loaded");
                throw new Error("PDF.js library not loaded yet");
            }

            // console.log("Starting PDF parsing for:", file.name);
            const arrayBuffer = await file.arrayBuffer();
            // console.log("ArrayBuffer loaded, size:", arrayBuffer.byteLength);

            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            // console.log(`PDF loaded, ${pdf.numPages} pages found`);

            let fullText = "";

            // Extract text from each page
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(" ");
                fullText += pageText + "\n\n";
                // console.log(
                //     `Extracted text from page ${i}, length: ${pageText.length}`
                // );
            }

            // console.log(`Total text extracted: ${fullText.length} characters`);
            return fullText.trim();
        } catch (error) {
            console.error("Error parsing PDF:", error);
            console.error(
                "Error details:",
                error instanceof Error ? error.message : String(error)
            );
            throw new Error(
                `Failed to parse PDF text: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }

    async function handleFileUpload() {
        if (!fileInput.files?.[0]) return;

        const file = fileInput.files[0];
        if (file.type !== "application/pdf") {
            alert("Please select a PDF file");
            return;
        }

        // Check file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            alert("File is too large. Maximum size is 10MB.");
            return;
        }

        uploading = true;

        try {
            // Ensure PDF.js is loaded
            if (!pdfjsLib) {
                alert(
                    "PDF library is still loading. Please wait a moment and try again."
                );
                uploading = false;
                return;
            }

            // First, parse the PDF to extract text
            const parsedText = await parsePDFText(file);

            if (!parsedText || parsedText.trim().length === 0) {
                throw new Error(
                    "No text could be extracted from the PDF. The PDF might be image-based or encrypted."
                );
            }

            // Create FormData and append both file and parsed text
            const formData = new FormData();
            formData.append("file", file);
            formData.append("parsedText", parsedText);

            // Upload file using bot-specific API key for processing
            const response = await fetch("/api/context-files", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${selectedBotId}`,
                    "X-Bot-ID": selectedBotId,
                },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Upload failed");
            }

            const result = await response.json();
            // console.log("File uploaded successfully:", result);

            // Show success message
            alert(
                `✅ PDF uploaded and analyzed successfully!\n\nFile: ${file.name}\nExtracted ${parsedText.length} characters`
            );

            // Reload context files
            await loadContextFiles();

            // Clear the file input
            fileInput.value = "";
        } catch (error) {
            console.error("Error uploading file:", error);
            alert(
                `❌ Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        } finally {
            uploading = false;
        }
    }

    async function deleteContextFile(fileId: string) {
        if (!confirm("Are you sure you want to delete this context file?"))
            return;

        try {
            const response = await fetch(`/api/context-files?id=${fileId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${selectedBotId}`,
                    "X-Bot-ID": selectedBotId,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Delete failed");
            }

            // Reload context files
            await loadContextFiles();
        } catch (error) {
            console.error("Error deleting file:", error);
            alert(
                `Delete failed: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }
</script>

<div class="context context-component">
    <h3 class="tile-title">Context / Personality</h3>

    <!-- Context Text Area -->
    <textarea
        bind:value={context}
        on:change={handleContextChange}
        cols="30"
        rows="8"
        placeholder="Enter the context and personality for this bot..."
    ></textarea>

    <!-- File Upload Section -->
    <div class="file-upload-section">
        <details bind:open={detailsOpen}>
            <summary>
                <div class="section-header">
                    <h4>Context Files (PDF)</h4>
                    {#if detailsOpen}
                        <span class="toggle-arrow">▼</span>
                    {:else}
                        <span class="toggle-arrow">▶</span>
                    {/if}
                </div>
            </summary>
            <div class="collapsible-content">
                <div class="upload-controls">
                    <input
                        bind:this={fileInput}
                        type="file"
                        accept=".pdf"
                        style="display: none;"
                        on:change={handleFileUpload}
                    />
                    <button
                        class="upload-btn"
                        on:click={() => fileInput.click()}
                        disabled={uploading || pdfLibLoading}
                    >
                        {#if pdfLibLoading}
                            ⏳ Loading PDF library...
                        {:else if uploading}
                            ⏳ Processing PDF...
                        {:else}
                            Upload PDF
                        {/if}
                    </button>
                    {#if uploading}
                        <p class="upload-status">
                            Extracting text and generating AI summary...
                        </p>
                    {:else if pdfLibLoading}
                        <p class="upload-status">Initializing PDF reader...</p>
                    {/if}
                </div>

                <!-- Context Files List -->
                {#if contextFiles.length > 0}
                    <div class="context-files">
                        {#each contextFiles as file}
                            <div class="context-file-item">
                                <div class="file-info">
                                    <span class="file-name"
                                        >{file.originalName}</span
                                    >
                                </div>
                                <button
                                    class="delete-btn"
                                    on:click={() => deleteContextFile(file.id)}
                                >
                                    REMOVE
                                </button>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </details>
    </div>
</div>

<style>
    .context {
        border-radius: 20px;
        box-sizing: border-box;
        grid-column: 3 / 7;
        grid-row: 1;
        overflow: hidden;
        padding: 10px;
        background: rgb(200, 255, 186);
        height: 100%;
        display: flex;
        flex-direction: column;
        /* gap: 10px; */
    }

    textarea {
        width: 100%;
        border: 1px solid #000000;
        border-radius: 8px;
        padding: 12px;
        font-family: inherit;
        font-size: 14px;
        resize: vertical;
        min-height: 250px;
        flex: 1;
        box-sizing: border-box;
    }

    textarea:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
    }

    /* File Upload Section */
    .file-upload-section {
        margin-top: 10px;
        /* padding-top: 15px; */
    }

    .file-upload-section details {
        cursor: pointer;
    }

    .file-upload-section summary {
        list-style: none;
        user-select: none;
        cursor: pointer;
    }

    .file-upload-section summary::-webkit-details-marker {
        display: none;
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .file-upload-section h4 {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0;
    }

    .toggle-arrow {
        font-size: 12px;
        color: black;
        padding-right: 5px;
        transition: transform 0.2s;
        display: inline-block;
        font-family: "GT America Mono", monospace;
    }

    .collapsible-content {
        margin-top: 5px;
        cursor: default;
    }

    .upload-status {
        margin: 10px 0;
        font-size: 12px;
        color: #667eea;
        font-style: italic;
    }

    .upload-btn {
        background: black;
        color: white;
        border: none;
        padding: 8px 16px;
        height: 35px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s;
        width: 100%;
    }

    .upload-btn:hover:not(:disabled) {
        background: #5a6fd8;
    }

    .upload-btn:disabled {
        background: #ccc;
        cursor: not-allowed;
    }

    /* Context Files List */
    .context-files {
        max-height: 300px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-top: 5px;
    }

    .context-file-item {
        background: none;
        border: 1px solid rgba(0, 0, 0, 1);
        border-radius: 6px;
        padding: 0px 10px 0px 10px;
        font-size: 14px;
        height: 33px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .file-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .file-name {
        /* font-weight: bold; */
        /* color: #333; */
        flex: 1;
        margin: 0px;
        word-break: break-word;
    }

    .delete-btn {
        background: black;
        color: white;
        border: none;
        padding: 2px 4px;
        border-radius: 0px;
        cursor: pointer;
        font-size: 10px;
        transition: background-color 0.2s;
    }

    .delete-btn:hover {
        background: #ff3742;
    }

    /* Mobile responsive styles */
    @media (max-width: 768px) {
        .context {
            grid-column: unset;
            grid-row: unset;
            order: 2;
            margin-bottom: 0;
        }

        textarea {
            min-height: 200px;
        }

        .file-info {
            flex-direction: column;
            align-items: flex-start;
        }

        .file-name {
            margin-right: 0;
            margin-bottom: 4px;
        }
    }
</style>
