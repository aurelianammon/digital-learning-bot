import { HfInference } from "@huggingface/inference";

const hf = new HfInference(process.env.HF_ACCESS_TOKEN);

export async function generateImageCaption(imageUrl: string): Promise<string> {
    try {
        const response = await fetch(imageUrl);
        const imageBlob = await response.blob();

        const result = await hf.imageToText({
            data: imageBlob,
            model: "Salesforce/blip-image-captioning-base",
        });

        return result.generated_text || "";
    } catch (error) {
        console.error("Error generating image caption:", error);
        throw error;
    }
}
