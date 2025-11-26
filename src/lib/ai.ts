import { HfInference } from "@huggingface/inference";

export const hf = new HfInference(process.env.HF_TOKEN);
