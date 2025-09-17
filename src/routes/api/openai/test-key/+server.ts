import { json } from "@sveltejs/kit";
import OpenAI from "openai";
import type { RequestHandler } from "./$types";

// POST - Test OpenAI API key
export const POST: RequestHandler = async ({ request }) => {
    try {
        const { apiKey, model } = await request.json();

        if (!apiKey) {
            return json({ error: "API key is required" }, { status: 400 });
        }

        // Create OpenAI instance with the provided key
        const openai = new OpenAI({
            apiKey: apiKey,
        });

        // Test the API key with a simple completion request
        // const testModel = model || "gpt-4-1106-preview";
        const testModel = "gpt-4-1106-preview";

        const completion = await openai.chat.completions.create({
            model: testModel,
            messages: [
                {
                    role: "user",
                    content:
                        "Say 'API key is valid' if you can read this message.",
                },
            ],
            // max_tokens: 10, // Minimal tokens for testing
        });

        // Check if we got a valid response
        const response = completion.choices[0]?.message?.content;
        const isValid = !!response && response.trim().length > 0;

        return json({
            valid: isValid,
            message: isValid ? "API key is valid" : "API key validation failed",
        });
    } catch (error: any) {
        console.error("OpenAI API key test error:", error);

        // Handle specific OpenAI API errors
        if (error.status === 401) {
            return json(
                {
                    valid: false,
                    message: "Invalid API key",
                },
                { status: 200 }
            );
        } else if (error.status === 429) {
            return json(
                {
                    valid: false,
                    message: "API key rate limit exceeded",
                },
                { status: 200 }
            );
        } else if (error.status === 403) {
            return json(
                {
                    valid: false,
                    message: "API key access forbidden",
                },
                { status: 200 }
            );
        } else {
            return json(
                {
                    valid: false,
                    message: "API key test failed",
                },
                { status: 200 }
            );
        }
    }
};
