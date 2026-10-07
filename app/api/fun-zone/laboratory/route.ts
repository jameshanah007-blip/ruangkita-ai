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
import { applyJamesGameLessons, getJamesGameLessons, applyJamesGameMastery, getJamesGameMastery, applyJamesGameAdaptations, getJamesGameAdaptations, applyJamesFailedStrategyAvoidance, getJamesFailedStrategies, applyJamesEffectiveStrategies, getJamesEffectiveStrategies } from "../../../fun-zone/engine/jamesGameLearning";
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

    // GameSpec is the only build contract. Learning may enrich the Director blueprint,
    // but no second composer/build-plan/template is allowed to create another runtime.
    const composedBlueprint: GameBlueprint = learnedBlueprint;

    session =
      markDirectorCompleted(
        session,
        composedBlueprint
      );

    /*
     * ==========================================
     * PHASER GAME RUNTIME
     * ==========================================
     *
     * Phaser is the sole 2D runtime authority.
     * The Director blueprint is compiled into one
     * canonical Phaser GameSpec and one runtime.
     */
    session = markBuilderStarted(session);

    const phaserBuild = buildAuthoritativePhaserGame(composedBlueprint, prompt);
    if (!phaserBuild) {
      throw new Error(
        "Game Specification tidak dapat dipetakan ke genre Phaser yang didukung."
      );
    }

    const builder: BuilderResponse = {
      success: true,
      provider: "james-phaser",
      model: phaserBuild.runtimeId,
      gameHtml: phaserBuild.html,
      validation: {
        valid: true,
        errors: [],
        warnings: [
          "Built from canonical GameSpec using Phaser.",
          "Runtime: " + phaserBuild.runtimeId,
          "Systems: " + phaserBuild.systems.join(", "),
        ],
      },
    };

    const builderProvider = "james-phaser";
    const gameSpec = phaserBuild.spec;

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

    const gameHtml = builder.gameHtml ?? phaserBuild.html;
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

      gameSpec,

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