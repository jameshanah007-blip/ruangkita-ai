import { resolveLegacyUserId } from "../../auth/cloudIdentity";
import { consumeJamesRateLimit } from "../../tools/jamesRateLimit";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;
import type {
  GameArtifact,
  GameBlueprint,
  LabSession,
  ReferenceImageEvidence,
} from "../../../fun-zone/laboratory/types";
import { buildAutonomousGameHtml } from "../../../fun-zone/engine/jamesAutonomousGameEngine";
import { composeGamePlan } from "../../../fun-zone/engine/gameComposer";
import { generateFunZoneGameBlueprint } from "../../../core/james/funZoneGameDirector";
import { createLocalPlatformerBlueprint } from "../../../fun-zone/engine/localPlatformerDirector";
import { createVisualBlueprint } from "../../../fun-zone/engine/visualDirector";
import { buildAssetRegistry } from "../../../fun-zone/engine/assetRegistry";
import { generateGameAssets } from "../../../fun-zone/engine/assetGenerator";
import { materializeGameAssets } from "../../../fun-zone/engine/assetMaterializer";
import { buildCharacterAssetPlan } from "../../../fun-zone/engine/characterAssetPipeline";
import { createOpenAIImageProvider } from "../../../fun-zone/engine/openAIImageProvider";
import { createGeminiImageProvider } from "../../../fun-zone/engine/geminiImageProvider";
import { applyJamesGameLessons, getJamesGameLessons, applyJamesGameMastery, getJamesGameMastery, applyJamesGameAdaptations, getJamesGameAdaptations, applyJamesFailedStrategyAvoidance, getJamesFailedStrategies, applyJamesEffectiveStrategies, getJamesEffectiveStrategies } from "../../../fun-zone/engine/jamesGameLearning";
import { createGameBuildPlan } from "../../../fun-zone/engine/gameBuildPlan";
import { applyVisualRefinement, evaluateVisualBuild } from "../../../fun-zone/engine/visualQa";
import { analyzeReferenceImage, type ReferenceImageAnalysis } from "../../../fun-zone/engine/referenceImageAnalyzer";


import {
  createArtifact,
  createLabSession,
  markBuilderCompleted,
  markBuilderFailed,
  markBuilderStarted,
  markDirectorCompleted,
  markDirectorFailed,
  markDirectorStarted,
} from "../../../fun-zone/laboratory/orchestrator";

type DirectorResponse = {
  success?: boolean;
  stage?: string;
  provider?: string;
  model?: string;
  prompt?: string;
  blueprint?: GameBlueprint;
  error?: string;
};

type BuilderResponse = {
  success?: boolean;
  stage?: string;
  provider?: string;
  model?: string;
  blueprint?: GameBlueprint;
  gameHtml?: string;
  size?: number;
  validation?: {
    valid?: boolean;
    scope?: "static-contract";
    gameplayVerified?: boolean;
    errors?: string[];
    warnings?: string[];
  };
  error?: string;
};

function normalizeBlueprintArrays(blueprint: GameBlueprint): GameBlueprint {
  return {
    ...blueprint,
    mechanics: Array.isArray(blueprint.mechanics) ? blueprint.mechanics : [],
    playerActions: Array.isArray(blueprint.playerActions) ? blueprint.playerActions : [],
    controls: Array.isArray(blueprint.controls) ? blueprint.controls : [],
    mobileNotes: Array.isArray(blueprint.mobileNotes) ? blueprint.mobileNotes : [],
    testRequirements: Array.isArray(blueprint.testRequirements) ? blueprint.testRequirements : [],
  };
}

async function persistCloudSession(session: LabSession, gameHtml: string) {
  try {
    const userId = await resolveLegacyUserId();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!userId || !url || !key) return;

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    const filePath = userId + "/" + session.id + ".html";
    const htmlBytes = new TextEncoder().encode(gameHtml);
    const upload = await supabase.storage
      .from("fun-zone-games")
      .upload(filePath, htmlBytes, {
        contentType: "text/html; charset=utf-8",
        upsert: true,
      });

    const gameHtmlUrl = upload.error
      ? null
      : filePath;

    const laboratorySessionId = userId + ":" + session.id;
    const source = "lab:" + JSON.stringify({
      session,
      gameHtml: upload.error ? gameHtml : "",
    });

    await supabase.from("fun_sessions").upsert({
      session_id: laboratorySessionId,
      game_title: session.artifact?.title || session.blueprint?.title || "AI Game Laboratory",
      game_theme: session.blueprint?.theme || null,
      game_genre: session.blueprint?.genre || null,
      difficulty: session.blueprint?.difficulty || null,
      mood: session.blueprint?.mood || null,
      source,
      score: 0,
      lives_remaining: 0,
      total_challenges: 0,
      completed: session.status === "ready",
      started_at: session.createdAt,
      finished_at: new Date().toISOString(),
      game_html_path: gameHtmlUrl,
    }, { onConflict: "session_id" });

    if (upload.error) {
      console.warn("Fun Zone game artifact upload failed:", upload.error.message);
    }
  } catch (error) {
    console.warn("Fun Zone cloud persistence unavailable:", error);
  }
}


function describeErrorValue(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["message", "error", "detail", "details", "code"]) {
      if (typeof record[key] === "string" && record[key].trim()) {
        return record[key] as string;
      }
    }
    try {
      return JSON.stringify(value);
    } catch {
      return "Non-serializable error object";
    }
  }
  return value == null ? "Unknown error" : String(value);
}

async function callDirector(
  prompt: string
): Promise<DirectorResponse> {
  // Call the shared Director service in-process. A self-fetch to this Preview
  // deployment is blocked by Vercel Deployment Protection (HTTP 401).
  return generateFunZoneGameBlueprint(prompt);
}

function createArtifactFromBuilder(
  blueprint: GameBlueprint,
  result: BuilderResponse
): GameArtifact {
  return createArtifact({
    blueprint,

    provider:
      result.provider ||
      "unknown",

    model:
      result.model ||
      "unknown",

    buildAttempts: 1,

    source:
      result.provider === "local" ? "local-game-factory" : "ai-builder",

    version: 1,
  });
}

export async function POST(
  request: Request
) {
  let session:
    | LabSession
    | null = null;
  let failureStage = "request";

  try {
    const userId = await resolveLegacyUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Session James tidak valid." },
        { status: 403 },
      );
    }

    const rateLimit = await consumeJamesRateLimit(userId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Batas penggunaan Fun Zone Laboratory tercapai." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    const body =
      await request.json();

    const prompt =
      typeof body?.prompt === "string"
        ? body.prompt.trim()
        : "";

    const referenceImage = body?.referenceImage as Partial<ReferenceImageEvidence> | undefined;
    const validReferenceImage = referenceImage?.available === true &&
      typeof referenceImage.dataUrl === "string" &&
      /^data:image\/(png|jpeg|webp);base64,/i.test(referenceImage.dataUrl) &&
      referenceImage.dataUrl.length <= 8_000_000
      ? {
          version: 1 as const,
          available: true,
          source: "user-upload" as const,
          mimeType: referenceImage.mimeType,
          dataUrl: referenceImage.dataUrl,
          width: typeof referenceImage.width === "number" ? referenceImage.width : undefined,
          height: typeof referenceImage.height === "number" ? referenceImage.height : undefined,
        }
      : {
          version: 1 as const,
          available: false,
          source: "user-upload" as const,
        };

    const referenceImageAnalysis: ReferenceImageAnalysis = await analyzeReferenceImage(validReferenceImage, prompt);

    const referenceImageMetadata = {
      available: validReferenceImage.available,
      source: validReferenceImage.source,
      mimeType: validReferenceImage.mimeType,
      width: validReferenceImage.width,
      height: validReferenceImage.height,
    };

    if (prompt.length > 12000) {
      return NextResponse.json(
        { success: false, stage: "director", error: "Prompt terlalu panjang. Maksimum 12.000 karakter." },
        { status: 413 },
      );
    }

    if (!prompt) {
      return NextResponse.json(
        {
          success: false,

          stage: "director",

          error:
            "Deskripsi game belum diberikan.",
        },
        {
          status: 400,
        }
      );
    }

    session =
      createLabSession({
        prompt,

        maxRepairAttempts:
          typeof body?.maxRepairAttempts ===
            "number"
            ? body.maxRepairAttempts
            : undefined,
      });

    /*
     * ==========================================
     * DIRECTOR
     * ==========================================
     */

    failureStage = "director";
    session =
      markDirectorStarted(
        session
      );

    let director: DirectorResponse;
    let directorProvider = "ai";

    // Supported local templates must not depend on AI quota. This is an
    // explicit genre route, not a silent fallback after an AI failure.
    const localPlatformerBlueprint = createLocalPlatformerBlueprint(prompt);
    if (localPlatformerBlueprint) {
      directorProvider = "local";
      director = {
        success: true,
        stage: "director",
        provider: "local",
        model: "local-platformer-template-v1",
        prompt,
        blueprint: localPlatformerBlueprint,
      };
      console.info("Fun Zone local Director selected", {
        template: "platformer-2d",
        reason: "supported deterministic local template",
      });
    } else {
      try {
        director = await callDirector(prompt);
      } catch (error) {
        const detail = describeErrorValue(error);
        console.error("Fun Zone Director failed; no template matched the prompt, so no game specification was substituted.", {
          errorType: error instanceof Error ? error.name : typeof error,
          message: detail,
          cause: error instanceof Error && error.cause ? describeErrorValue(error.cause) : undefined,
        });
        throw new Error(
          `Fun Zone Director failed. No supported local template matched this prompt, and no different game specification was substituted. ${detail}`,
        );
      }
    }

    if (!director.success || !director.blueprint) {
      throw new Error(
        "Fun Zone Director returned no valid blueprint. No unsupported local blueprint fallback was used.",
      );
    }
    if (director.provider) {
      directorProvider = director.provider;
    }
    console.info("Fun Zone pipeline stage completed", {
      stage: "director",
      input: { promptCharacters: prompt.length },
      output: { provider: directorProvider, genre: director.blueprint.genre, hasObjective: Boolean(director.blueprint.objective?.trim()) },
    });

    failureStage = "blueprint";
    const blueprint = director.blueprint;
    const normalizedBlueprint = normalizeBlueprintArrays(blueprint);
    // The supported local template is a deterministic product path, not an AI-assisted path.
    // Skip learned-strategy enrichment here so unrelated memory/learning services cannot
    // change or block the minimum playable game. AI genres retain the existing learning path.
    const isLocalPlatformer = directorProvider === "local" && normalizedBlueprint.genre === "platformer";
    let learnedBlueprint: GameBlueprint;
    if (isLocalPlatformer) {
      learnedBlueprint = normalizedBlueprint;
    } else {
      const learnedGameLessons = await getJamesGameLessons(8);
      const learnedGameMastery = await getJamesGameMastery(12);
      const learnedGameAdaptations = await getJamesGameAdaptations(8);
      const failedGameStrategies = await getJamesFailedStrategies(8);
      const effectiveGameStrategies = await getJamesEffectiveStrategies(6);
      const lessonBlueprint = applyJamesGameLessons(normalizedBlueprint, learnedGameLessons);
      const masteryBlueprint = applyJamesGameMastery(lessonBlueprint, learnedGameMastery);
      const adaptationBlueprint = applyJamesGameAdaptations(masteryBlueprint, learnedGameAdaptations);
      const avoidanceBlueprint = applyJamesFailedStrategyAvoidance(adaptationBlueprint, failedGameStrategies);
      learnedBlueprint = applyJamesEffectiveStrategies(avoidanceBlueprint, effectiveGameStrategies);
    }
    console.info("Fun Zone pipeline stage completed", {
      stage: "blueprint",
      output: {
        genre: learnedBlueprint.genre,
        mechanics: learnedBlueprint.mechanics.length,
        playerActions: learnedBlueprint.playerActions.length,
        controls: learnedBlueprint.controls.length,
        testRequirements: learnedBlueprint.testRequirements.length,
      },
    });

    // Compose reusable gameplay systems before the existing autonomous builder runs.
    // We enrich the existing blueprint instead of replacing the current architecture.
    let effectiveBlueprint = learnedBlueprint;
    const composedPlan = composeGamePlan(effectiveBlueprint);
    let buildPlan = createGameBuildPlan(effectiveBlueprint);
    let visualBlueprint = createVisualBlueprint(learnedBlueprint);
    let visualQa = evaluateVisualBuild(learnedBlueprint, buildPlan, visualBlueprint);
    let refinementPasses = 0;

    // Execute at most one bounded visual refinement before asset generation.
    // This is intentionally additive: the original blueprint remains the base,
    // while QA feedback enriches the next build specification.
    if (!isLocalPlatformer && visualQa.refinement.required && visualQa.refinement.maxPasses > 0) {
      effectiveBlueprint = applyVisualRefinement(effectiveBlueprint, visualQa);
      buildPlan = createGameBuildPlan(effectiveBlueprint);
      visualBlueprint = createVisualBlueprint(effectiveBlueprint);
      visualQa = evaluateVisualBuild(effectiveBlueprint, buildPlan, visualBlueprint);
      refinementPasses = 1;
    }

    failureStage = "asset-registry";
    const characterAssetPlan = buildCharacterAssetPlan(visualBlueprint.characters, visualBlueprint.artDirection.style);
    const assetRegistry = buildAssetRegistry(visualBlueprint);
    console.info("Fun Zone pipeline stage completed", {
      stage: "asset-registry",
      output: {
        genre: visualBlueprint.artDirection.genre,
        assetCount: assetRegistry.assets.length,
        requiredAssetCount: assetRegistry.requiredAssetIds.length,
        requiredAssetIds: assetRegistry.requiredAssetIds,
      },
    });
    const realAssetProviders = process.env.JAMES_ENABLE_REAL_ASSET_GENERATION === "true"
      ? [
          createGeminiImageProvider(),
          createOpenAIImageProvider(),
        ].filter((provider): provider is NonNullable<typeof provider> => Boolean(provider))
      : [];
    failureStage = "asset-provider";
    const generatedAssets = await generateGameAssets(assetRegistry, realAssetProviders);
    console.info("Fun Zone pipeline stage completed", {
      stage: "asset-provider",
      output: {
        count: generatedAssets.assets.length,
        providers: [...new Set(generatedAssets.assets.map((asset) => asset.metadata.provider || "missing"))],
        placeholders: generatedAssets.assets.filter((asset) => asset.status !== "ready" || asset.uri.startsWith("asset://placeholder/")).map((asset) => asset.id),
      },
    });
    failureStage = "asset-materializer";
    const materializedAssets = materializeGameAssets(generatedAssets);
    console.info("Fun Zone pipeline stage completed", {
      stage: "asset-materializer",
      output: {
        count: materializedAssets.assets.length,
        ready: materializedAssets.assets.filter((asset) => asset.status === "ready").length,
        fallbackCount: materializedAssets.assets.filter((asset) => asset.metadata.fallback === true).length,
        warnings: materializedAssets.warnings.length,
      },
    });
    const protagonistId = visualBlueprint.protagonist.id;
    const runtimeCharacterAsset = materializedAssets.assets.find(
      (asset) =>
        asset.status === "ready" &&
        typeof asset.uri === "string" &&
        asset.uri.length > 0 &&
        asset.id === protagonistId,
    );

    if (!runtimeCharacterAsset) {
      const materializedSummary = materializedAssets.assets
        .map((asset) => `${asset.id}:${asset.kind}:${asset.status}`)
        .join(", ");
      throw new Error(
        `Fun Zone asset contract failed: playable protagonist asset was not materialized. Expected exact protagonist id "${protagonistId}". Materialized assets: ${materializedSummary || "none"}.`,
      );
    }

    failureStage = "phaser-runtime";
    const composedBlueprint: GameBlueprint = {
      ...effectiveBlueprint,
      mechanics: [...new Set([...effectiveBlueprint.mechanics, ...composedPlan.systems.map((system) => system.id)])],
      playerActions: [...new Set([...effectiveBlueprint.playerActions, ...composedPlan.requiredActions])],
      testRequirements: [...new Set([...effectiveBlueprint.testRequirements, ...composedPlan.testGoals, ...buildPlan.testStages])],
      controls: [...new Set([...effectiveBlueprint.controls, ...buildPlan.controls.keyboard, ...buildPlan.controls.touch])],
    };

    session =
      markDirectorCompleted(
        session,
        composedBlueprint
      );

    /*
     * ==========================================
     * JAMES AUTONOMOUS BUILDER
     * ==========================================
     *
     * This is the normal Laboratory path.
     * James compiles the blueprint directly into
     * a standalone HTML5 game without calling a
     * provider. A provider can be enabled later as
     * an optional enhancement, never as a dependency.
     */

    session = markBuilderStarted(session);

    // Laboratory is the authoritative builder path.
    // Provider enhancement may advise the Director and asset providers,
    // but it must never bypass the materialized-asset contract.
    // This guarantees the Phaser runtime receives the same assets that
    // passed through Visual Director -> Registry -> Generator -> Materializer.
    const compiledHtml = buildAutonomousGameHtml(composedBlueprint, materializedAssets, protagonistId);
    console.info("Fun Zone pipeline stage completed", {
      stage: "phaser-runtime",
      output: {
        runtime: "Phaser 4.2.1",
        genre: composedBlueprint.genre,
        htmlBytes: new TextEncoder().encode(compiledHtml).byteLength,
        staticContractPassed: true,
        gameplayVerified: false,
      },
    });
    const builder: BuilderResponse = {
      success: true,
      provider: isLocalPlatformer ? "local" : "james-autonomous",
      model: isLocalPlatformer
        ? "phaser-local-platformer-v1"
        : "autonomous-game-compiler-v2-asset-contract",
      gameHtml: compiledHtml,
      validation: {
        valid: true,
        scope: "static-contract",
        gameplayVerified: false,
        errors: [],
        warnings: [
          "Static Phaser compilation and asset contract passed.",
          "Gameplay has not yet been verified in the browser; the browser tester is authoritative for gameplay readiness.",
        ],
      },
    };
    const builderProvider = isLocalPlatformer ? "local" : "james-autonomous";

    const artifact =
      createArtifactFromBuilder(
        composedBlueprint,
        builder
      );

    session =
      markBuilderCompleted(
        session,
        artifact
      );

    /*
     * ==========================================
     * RETURN TO BROWSER
     * ==========================================
     *
     * Sandbox harus dijalankan di browser,
     * bukan di server.
     *
     * Karena itu artifact HTML dikirim
     * ke client bersama session.
     */

    const gameHtml = builder.gameHtml;
    if (!gameHtml) {
      throw new Error("Phaser runtime compilation returned no HTML artifact.");
    }
    failureStage = "artifact-persistence";
    await persistCloudSession(session, gameHtml);


    failureStage = "response";
    return NextResponse.json({
      success: true,

      stage: "builder",

      session,

      blueprint:
        composedBlueprint,

      visualBlueprint,

      visualQa,
      referenceVisualTarget: visualQa.referenceTarget,
      referenceImage: referenceImageMetadata,
      referenceImageAnalysis,
      refinementPlan: visualQa.refinement,
      refinementPasses,

      assetRegistry,

      characterAssetPlan,

      generatedAssets,

      materializedAssets,

      artifact,

      gameHtml,

      validation:
        builder.validation || null,

      provider:
        [directorProvider, builderProvider].join(" → "),

      model:
        builder.model || null,
    });
  } catch (error) {
    console.error("Fun Zone pipeline stage failed", {
      stage: failureStage,
      error: describeErrorValue(error),
      errorType: error instanceof Error ? error.name : typeof error,
      cause: error instanceof Error && error.cause ? describeErrorValue(error.cause) : undefined,
      sessionId: session?.id || null,
    });

    const message =
      error instanceof Error
        ? error.message
        : "Laboratory gagal dijalankan.";

    if (session) {
      session = {
        ...session,

        status: "failed",

        stage: "final",

        error: message,

        updatedAt:
          new Date().toISOString(),
      };
    }

    return NextResponse.json(
      {
        success: false,

        stage: failureStage,

        session,

        error: message,
      },
      {
        status: 500,
      }
    );
  }
}