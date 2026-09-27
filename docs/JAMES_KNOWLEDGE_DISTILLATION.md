# James Knowledge Distillation & Model Adaptation

James now has two distinct learning mechanisms.

## 1. Knowledge Distillation

James can use Gemini, OpenAI, OpenRouter, and Groq as teacher providers.

Flow: Teacher Providers → Final answers → Distillation Dataset → James Learning Memory / Fine-tuning input.

Each dataset sample stores the prompt, final response, teacher provider, and teacher model. Hidden chain-of-thought is never requested or persisted.

## 2. Model Adaptation / Fine-tuning

The phrase model copying is implemented as compliant model adaptation, not extraction of proprietary model weights.

| Provider | Distillation | Fine-tuning through James | Direct weight copying |
|---|---|---|---|
| OpenAI | Yes | Yes, for supported API models | No |
| Gemini | Yes | No through Gemini API; supported Google tuning paths require separate configuration | No |
| OpenRouter | Yes | No direct provider-agnostic fine-tuning | No |
| Groq | Yes | Yes where account/model/API access supports it | No |

James can therefore learn from all four providers while invoking provider-side fine-tuning only where an official supported path exists.

## Safety boundaries

- Only verified Omanto may trigger model-learning control.
- Provider API keys remain server-side.
- No model-weight extraction.
- No attempt to reproduce hidden reasoning.
- Dataset provenance is stored.
- Distillation jobs are versioned with a dataset hash.
- Fine-tuning is a separate job from distillation.
- A fine-tuned model must be explicitly selected before production routing uses it.
- The existing four-provider fallback architecture remains intact.

## API

GET /api/ai/model-learning returns the capability matrix.

POST /api/ai/model-learning with mode=distill creates a distillation dataset.

POST /api/ai/model-learning with mode=adapt submits a distillation dataset to a supported fine-tuning provider.

## Autonomous Brain integration target

The next integration step is to let the Decision Engine decide which providers should teach James, when evidence is sufficient to distill, which capability gap should become training data, when fine-tuning is justified, how the adapted model performs against baseline, and whether the adapted model should remain experimental or become eligible for routing.

This keeps learning evidence-driven instead of allowing James to continuously retrain itself without validation.