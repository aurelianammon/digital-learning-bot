import OpenAI from "openai";

// Uses GPT Vision to caption an image at the given URL
export async function generateImageCaption(
    imageUrl: string,
    apiKey: string
): Promise<string> {
    try {
        const openai = new OpenAI({ apiKey });

        const completion = await openai.chat.completions.create({
            model: "gpt-5", // vision-capable GPT-5
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Provide a concise, descriptive caption for this image. Mention key objects, scene, and any notable details.",
                        },
                        {
                            type: "image_url",
                            image_url: { url: imageUrl },
                        },
                    ],
                },
            ],
        });

        const caption = completion.choices?.[0]?.message?.content?.trim() || "";
        return caption;
    } catch (error) {
        console.error("Error generating image caption with GPT Vision:", error);
        throw error;
    }
}
