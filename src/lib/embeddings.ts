import { InferenceClient } from "@huggingface/inference";

const hf = new InferenceClient(process.env.HF_TOKEN);

export async function createEmbedding(text: string) {
    const result = await hf.featureExtraction({
        model: "BAAI/bge-small-en-v1.5",
        inputs: text,
    });

    return result;
}