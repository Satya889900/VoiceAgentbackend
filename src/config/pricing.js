// Google Gemini API Pricing Configuration (Gemini 2.0 Flash rates)
export const GEMINI_PRICING = {
  model: 'gemini-2.0-flash',
  // Per 1M tokens in USD
  inputCostPerMillion: 0.10,     // $0.10 per 1M text input tokens
  outputCostPerMillion: 0.40,    // $0.40 per 1M text output tokens
  audioInputPerMillion: 0.70,    // $0.70 per 1M audio input tokens (~25 tokens/sec)
  audioOutputPerMillion: 2.00,   // $2.00 per 1M audio output tokens

  // Token estimates per second of speech
  tokensPerSecondAudioInput: 25,
  tokensPerSecondAudioOutput: 30,
};

/**
 * Calculates estimated cost based on token and audio usage.
 * @param {Object} usage
 * @param {number} usage.inputTokens
 * @param {number} usage.outputTokens
 * @param {number} usage.audioInputSeconds
 * @param {number} usage.audioOutputSeconds
 * @returns {Object} Cost breakdown and total cost in USD
 */
export function calculateCost(usage = {}) {
  const {
    inputTokens = 0,
    outputTokens = 0,
    audioInputSeconds = 0,
    audioOutputSeconds = 0,
  } = usage;

  const audioInputTokens = Math.round(audioInputSeconds * GEMINI_PRICING.tokensPerSecondAudioInput);
  const audioOutputTokens = Math.round(audioOutputSeconds * GEMINI_PRICING.tokensPerSecondAudioOutput);

  const textInputCost = (inputTokens / 1_000_000) * GEMINI_PRICING.inputCostPerMillion;
  const textOutputCost = (outputTokens / 1_000_000) * GEMINI_PRICING.outputCostPerMillion;
  const audioInputCost = (audioInputTokens / 1_000_000) * GEMINI_PRICING.audioInputPerMillion;
  const audioOutputCost = (audioOutputTokens / 1_000_000) * GEMINI_PRICING.audioOutputPerMillion;

  const totalCost = textInputCost + textOutputCost + audioInputCost + audioOutputCost;

  return {
    textInputCost: Number(textInputCost.toFixed(6)),
    textOutputCost: Number(textOutputCost.toFixed(6)),
    audioInputCost: Number(audioInputCost.toFixed(6)),
    audioOutputCost: Number(audioOutputCost.toFixed(6)),
    totalCost: Number(totalCost.toFixed(6)),
    totalTokens: inputTokens + outputTokens + audioInputTokens + audioOutputTokens,
    audioInputTokens,
    audioOutputTokens,
  };
}
