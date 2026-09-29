import { resolveLegacyUserId } from "../../auth/cloudIdentity";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;
import type {
  GameArtifact,
  GameBlueprint,
  LabSession,
} from "../../../fun-zone/laboratory/types";
import { createLocalGameBlueprint } from "../../../fun-zone/engine/localBlueprint";
import { buildLocalGameHtml } from "../../../fun-zone/engine/localFactory";

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

async function callBuilder(
  request: Request,
  blueprint: GameBlueprint
): Promise<BuilderResponse> {
  const response =
    await fetch(
      absoluteUrl(
        request,
        "/api/fun-zone/factory"
      ),
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          blueprint,
        }),

        cache: "no-store",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error ||
        "AI Builder gagal."
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
      "ai-builder",

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
    const body =
      await request.json();

    const prompt =
      typeof body?.prompt === "string"
        ? body.prompt.trim()
        : "";

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

    const normalizedBlueprint = normalizeBlueprintArrays(director.blueprint);

    session =
      markDirectorCompleted(
        session,
        normalizedBlueprint
      );

    /*
     * ==========================================
     * BUILDER
     * ==========================================
     */

    session =
      markBuilderStarted(
        session
      );

    let builder: BuilderResponse;
    let builderProvider = "ai";

    try {
      builder = await callBuilder(request, normalizedBlueprint);
    } catch (error) {
      console.warn("Fun Zone Builder unavailable; using local game factory fallback.", error);
      builder = {
        success: true,
        provider: "local",
        model: "local-canvas-factory-v1",
        gameHtml: buildLocalGameHtml(normalizedBlueprint),
        validation: {
          valid: true,
          errors: [],
          warnings: ["Generated by local fallback factory."],
        },
      };
      builderProvider = "local";
    }

    if (!builder.gameHtml) {
      console.warn("Fun Zone Builder returned no artifact; using local game factory fallback.");
      builder = {
        success: true,
        provider: "local",
        model: "local-canvas-factory-v1",
        gameHtml: buildLocalGameHtml(normalizedBlueprint),
        validation: {
          valid: true,
          errors: [],
          warnings: ["Generated by local fallback factory."],
        },
      };
      builderProvider = "local";
    } else if (builder.provider) {
      builderProvider = builder.provider;
    }

    const artifact =
      createArtifactFromBuilder(
        normalizedBlueprint,
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

    await persistCloudSession(session, builder.gameHtml);


    return NextResponse.json({
      success: true,

      stage: "builder",

      session,

      blueprint:
        normalizedBlueprint,

      artifact,

      gameHtml:
        builder.gameHtml,

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