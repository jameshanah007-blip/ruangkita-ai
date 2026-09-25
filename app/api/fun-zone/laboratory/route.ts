import { NextResponse } from "next/server";
import type {
  GameArtifact,
  GameBlueprint,
  LabSession,
} from "../../../fun-zone/laboratory/types";

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

    let director:
      DirectorResponse;

    try {
      director =
        await callDirector(
          request,
          prompt
        );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "AI Director gagal.";

      session =
        markDirectorFailed(
          session,
          message
        );

      return NextResponse.json(
        {
          success: false,

          stage: "director",

          session,

          error: message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      !director.blueprint
    ) {
      const message =
        director.error ||
        "AI Director tidak menghasilkan GameBlueprint.";

      session =
        markDirectorFailed(
          session,
          message
        );

      return NextResponse.json(
        {
          success: false,

          stage: "director",

          session,

          error: message,
        },
        {
          status: 500,
        }
      );
    }

    session =
      markDirectorCompleted(
        session,
        director.blueprint
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

    let builder:
      BuilderResponse;

    try {
      builder =
        await callBuilder(
          request,
          director.blueprint
        );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "AI Builder gagal.";

      session =
        markBuilderFailed(
          session,
          message
        );

      return NextResponse.json(
        {
          success: false,

          stage: "builder",

          session,

          error: message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      !builder.gameHtml
    ) {
      const message =
        builder.error ||
        "AI Builder tidak menghasilkan Game Artifact.";

      session =
        markBuilderFailed(
          session,
          message
        );

      return NextResponse.json(
        {
          success: false,

          stage: "builder",

          session,

          error: message,
        },
        {
          status: 500,
        }
      );
    }

    const artifact =
      createArtifactFromBuilder(
        director.blueprint,
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

    return NextResponse.json({
      success: true,

      stage: "builder",

      session,

      blueprint:
        director.blueprint,

      artifact,

      gameHtml:
        builder.gameHtml,

      validation:
        builder.validation || null,

      provider:
        builder.provider || null,

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