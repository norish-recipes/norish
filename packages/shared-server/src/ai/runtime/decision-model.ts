/**
 * The AI SDK's evaluation contract answered by an OpenAI-compatible chat
 * model. `createOpenAICompatible` has no evaluation model, and a language
 * model's distribution does not sum to one, so this adapter supplies both.
 */

import type {
  Experimental_EvaluationModelV4CallOptions as EvaluationCallOptions,
  Experimental_EvaluationModelV4 as EvaluationModel,
  Experimental_EvaluationModelV4Question as EvaluationQuestion,
  Experimental_EvaluationModelV4Result as EvaluationResult,
  LanguageModelV4,
} from "@ai-sdk/provider";
import { generateText, Output } from "ai";
import { z } from "zod";

import { aiLogger } from "@norish/shared-server/logger";

import { isRequestShapeRejection } from "./errors";
import { canDegradeToJsonMode, jsonModeInstruction } from "./structured-output";

const DECISION_PROVIDER = "generic-openai";

const DECISION_INSTRUCTIONS = [
  "You answer closed questions about one state. Answer every question and only the questions asked.",
  "For a choice question, return the complete probability distribution over its listed options.",
  "For a score question, return the complete probability distribution over its levels, keyed 0 to levels-1.",
  "For a boolean question, return P(true) as a number in [0, 1].",
  "Every distribution must sum to 1.",
].join("\n");

interface AnswerObject {
  probabilities?: Record<string, number>;
  probability?: number;
}

interface EvaluationModelOptions {
  model: LanguageModelV4;
  jsonModeModel: LanguageModelV4;
}

function answersSchema(questions: Readonly<Record<string, EvaluationQuestion>>): z.ZodType {
  const shape: Record<string, z.ZodType> = {};

  for (const [id, question] of Object.entries(questions)) {
    if (question.type === "choice") {
      const probabilities: Record<string, z.ZodType> = {};

      for (const label of Object.keys(question.criteria)) {
        probabilities[label] = z.number().min(0).max(1);
      }

      shape[id] = z.object({ probabilities: z.object(probabilities) });
      continue;
    }

    if (question.type === "score") {
      const probabilities: Record<string, z.ZodType> = {};

      question.criteria.forEach((_level, index) => {
        probabilities[String(index)] = z.number().min(0).max(1);
      });

      shape[id] = z.object({ probabilities: z.object(probabilities) });
      continue;
    }

    shape[id] = z.object({ probability: z.number().min(0).max(1) });
  }

  return z.object(shape);
}

function normalizeDistribution(probabilities: Record<string, number>): Record<string, number> {
  const total = Object.values(probabilities).reduce((sum, value) => sum + value, 0);

  if (total <= 0) return probabilities;

  return Object.fromEntries(
    Object.entries(probabilities).map(([key, value]) => [key, value / total])
  );
}

function answersFrom(
  questions: Readonly<Record<string, EvaluationQuestion>>,
  output: Record<string, AnswerObject>
): Record<string, EvaluationResult["answers"][string]> {
  const answers: Record<string, EvaluationResult["answers"][string]> = {};

  for (const [id, question] of Object.entries(questions)) {
    const answer = output[id];
    const probabilities = answer?.probabilities ? normalizeDistribution(answer.probabilities) : {};

    if (question.type === "choice") {
      const choice = Object.entries(probabilities).reduce<[string, number]>(
        (best, [label, probability]) => (probability > best[1] ? [label, probability] : best),
        ["", -1]
      )[0];

      answers[id] = { type: "choice", choice, probabilities };
      continue;
    }

    if (question.type === "score") {
      const score = Object.entries(probabilities).reduce(
        (total, [index, probability]) => total + Number(index) * probability,
        0
      );

      answers[id] = { type: "score", score, probabilities };
      continue;
    }

    answers[id] = { type: "boolean", probability: answer?.probability ?? 0 };
  }

  return answers;
}

async function ask({
  model,
  instructions,
  schema,
  options,
}: {
  model: LanguageModelV4;
  instructions: string;
  schema: z.ZodType;
  options: EvaluationCallOptions;
}): Promise<EvaluationResult> {
  const result = await generateText({
    model,
    output: Output.object({ schema }),
    instructions,
    prompt: JSON.stringify({ state: options.state, questions: options.questions }),
    abortSignal: options.abortSignal,
    maxRetries: 0,
  });

  return {
    answers: answersFrom(options.questions, result.output as Record<string, AnswerObject>),
    usage: {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    },
    warnings: result.warnings ?? [],
    response: { modelId: result.response.modelId },
  };
}

async function evaluateQuestions(
  model: LanguageModelV4,
  jsonModeModel: LanguageModelV4,
  options: EvaluationCallOptions
): Promise<EvaluationResult> {
  const schema = answersSchema(options.questions);

  try {
    return await ask({ model, instructions: DECISION_INSTRUCTIONS, schema, options });
  } catch (error) {
    if (!canDegradeToJsonMode(DECISION_PROVIDER) || !isRequestShapeRejection(error)) {
      throw error;
    }

    aiLogger.warn(
      { provider: DECISION_PROVIDER, model: model.modelId },
      "Decision endpoint refused a JSON-schema request, retrying in plain JSON mode"
    );

    return ask({
      model: jsonModeModel,
      instructions: `${DECISION_INSTRUCTIONS}\n\n${await jsonModeInstruction(schema)}`,
      schema,
      options,
    });
  }
}

export function createOpenAICompatibleEvaluationModel({
  model,
  jsonModeModel,
}: EvaluationModelOptions): EvaluationModel {
  return {
    specificationVersion: "v4",
    provider: DECISION_PROVIDER,
    modelId: model.modelId,
    supportedQuestionTypes: ["choice", "score", "boolean"],
    doEvaluate: (options) => evaluateQuestions(model, jsonModeModel, options),
  };
}
