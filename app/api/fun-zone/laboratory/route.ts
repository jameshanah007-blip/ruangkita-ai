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
import { createLocalGameBlueprint } from "../../../fun-zone/engine/localBlueprint";
import { buildAutonomousGameHtml } from "../../../fun-zone/engine/jamesAutonomousGameEngine";
import { composeGamePlan } from "../../../fun-zone/engine/gameComposer";
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


function absoluteUrl(
  request: Request,
  path: string
): string {
  const url =
    new URL(request.url);

  return `${url.origin}${path}`;
}

async function callDirector(
  request: Request,
  prompt: string
): Promise<DirectorResponse> {
  const response =
    await fetch(
      absoluteUrl(
        request,
        "/api/fun-zone/brain"
      ),
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          prompt,
        }),

        cache: "no-store",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error ||
        "AI Director gagal."
    );
  }

  return data;
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

    session =
      markDirectorStarted(
        session
      );

    let director: DirectorResponse;
    let directorProvider = "ai";

    try {
      director = await callDirector(request, prompt);
    } catch (error) {
      console.warn("Fun Zone Director unavailable; using local blueprint fallback.", error);
      director = {
        success: true,
        provider: "local",
        model: "local-blueprint-v1",
        blueprint: createLocalGameBlueprint(prompt),
      };
      directorProvider = "local";
    }

    if (!director.blueprint) {
      console.warn("Fun Zone Director returned no blueprint; using local blueprint fallback.");
      director = {
        success: true,
        provider: "local",
        model: "local-blueprint-v1",
        blueprint: createLocalGameBlueprint(prompt),
      };
      directorProvider = "local";
    } else if (director.provider) {
      directorProvider = director.provider;
    }

    const blueprint = director.blueprint ?? createLocalGameBlueprint(prompt);
    const normalizedBlueprint = normalizeBlueprintArrays(blueprint);
    const learnedGameLessons = await getJamesGameLessons(8);
    const learnedGameMastery = await getJamesGameMastery(12);
    const learnedGameAdaptations = await getJamesGameAdaptations(8);
    const failedGameStrategies = await getJamesFailedStrategies(8);
    const effectiveGameStrategies = await getJamesEffectiveStrategies(6);
    const lessonBlueprint = applyJamesGameLessons(normalizedBlueprint, learnedGameLessons);
    const masteryBlueprint = applyJamesGameMastery(lessonBlueprint, learnedGameMastery);
    const adaptationBlueprint = applyJamesGameAdaptations(masteryBlueprint, learnedGameAdaptations);
    const avoidanceBlueprint = applyJamesFailedStrategyAvoidance(adaptationBlueprint, failedGameStrategies);
    const learnedBlueprint = applyJamesEffectiveStrategies(avoidanceBlueprint, effectiveGameStrategies);

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
    if (visualQa.refinement.required && visualQa.refinement.maxPasses > 0) {
      effectiveBlueprint = applyVisualRefinement(effectiveBlueprint, visualQa);
      buildPlan = createGameBuildPlan(effectiveBlueprint);
      visualBlueprint = createVisualBlueprint(effectiveBlueprint);
      visualQa = evaluateVisualBuild(effectiveBlueprint, buildPlan, visualBlueprint);
      refinementPasses = 1;
    }

    const characterAssetPlan = buildCharacterAssetPlan(visualBlueprint.characters, visualBlueprint.artDirection.style);
    const assetRegistry = buildAssetRegistry(visualBlueprint);
    const realAssetProviders = process.env.JAMES_ENABLE_REAL_ASSET_GENERATION === "true"
      ? [
          createGeminiImageProvider(),
          createOpenAIImageProvider(),
        ].filter((provider): provider is NonNullable<typeof provider> => Boolean(provider))
      : [];
    const generatedAssets = await generateGameAssets(assetRegistry, realAssetProviders);
    const materializedAssets = materializeGameAssets(generatedAssets);
    const protagonistId = visualBlueprint.protagonist.id;
    const runtimeCharacterAsset = materializedAssets.assets.find(
      (asset) =>
        asset.status === "ready" &&
        typeof asset.uri === "string" &&
        asset.uri.length > 0 &&
        (asset.kind === "character" || asset.id === protagonistId),
    );

    if (!runtimeCharacterAsset) {
      const materializedSummary = materializedAssets.assets
        .map((asset) => `${asset.id}:${asset.kind}:${asset.status}`)
        .join(", ");
      throw new Error(
        `Fun Zone asset contract failed: playable protagonist asset was not materialized. Expected id "${protagonistId}" or kind "character". Materialized assets: ${materializedSummary || "none"}.`,
      );
    }

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
    let builder: BuilderResponse = {
      success: true,
      provider: "james-autonomous",
      model: "autonomous-game-compiler-v2-asset-contract",
      gameHtml: buildAutonomousGameHtml(composedBlueprint, materializedAssets),
      validation: {
        valid: true,
        errors: [],
        warnings: ["Laboratory authoritative builder: materialized assets are mandatory runtime inputs."],
      },
    };
    let builderProvider = "james-autonomous";
    if (!builder.gameHtml) {
      builder = {
        success: true,
        provider: "james-autonomous",
        model: "autonomous-game-compiler-v1",
        gameHtml: buildAutonomousGameHtml(composedBlueprint, materializedAssets),
        validation: {
          valid: true,
          errors: [],
          warnings: ["James autonomous compiler regenerated the artifact."],
        },
      };
      builderProvider = "james-autonomous";
    }

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

    const gameHtml = builder.gameHtml ?? buildAutonomousGameHtml(composedBlueprint, materializedAssets);
    await persistCloudSession(session, gameHtml);


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
    console.error(
      "Laboratory API error:",
      error
    );

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

        stage: "final",

        session,

        error: message,
      },
      {
        status: 500,
      }
    );
  }
}