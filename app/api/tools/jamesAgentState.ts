import { createClient } from "@supabase/supabase-js";
import type { JamesTaskAction } from "./jamesTaskPlanner";

export type JamesAgentTaskState = {
  id?: string;
  userId: string;
  conversationId: string;
  request: string;
  status: "running" | "completed" | "failed" | "paused";
  currentStep: number;
  maxSteps: number;
  actions: JamesTaskAction[];
  outputs: Record<string, string>;
  updatedAt?: string;
};

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function safeId(value: string) {
  return /^[0-9a-fA-F-]{20,100}$/.test(value);
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function createJamesAgentTask(input: {
  userId: string;
  conversationId: string;
  request: string;
  actions: JamesTaskAction[];
}) {
  const db = getDb();
  if (!db || !safeId(input.userId) || !safeId(input.conversationId)) return null;

  const state = {
    actions: input.actions,
    outputs: {},
  };

  const { data, error } = await db
    .from("james_agent_tasks")
    .insert({
      user_id: input.userId,
      conversation_id: input.conversationId,
      request: input.request.slice(0, 4000),
      status: "running",
      current_step: 0,
      max_steps: Math.max(input.actions.length, 1),
      state,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("James agent task persistence unavailable:", error.message);
    return null;
  }

  return typeof data?.id === "string" ? data.id : null;
}

export async function updateJamesAgentTask(
  taskId: string | null,
  owner: { userId: string; conversationId: string },
  patch: {
    status?: JamesAgentTaskState["status"];
    currentStep?: number;
    maxSteps?: number;
    actions?: JamesTaskAction[];
    outputs?: Record<string, string>;
  }
) {
  if (
    !taskId ||
    !safeId(taskId) ||
    !safeId(owner.userId) ||
    !safeId(owner.conversationId)
  ) return false;

  const db = getDb();
  if (!db) return false;

  const statePatch = patch.actions || patch.outputs
    ? {
        ...(patch.actions ? { actions: patch.actions } : {}),
        ...(patch.outputs ? { outputs: patch.outputs } : {}),
      }
    : null;

  const values: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.status) values.status = patch.status;
  if (typeof patch.currentStep === "number") values.current_step = patch.currentStep;

  if (typeof patch.maxSteps === "number") {
    values.max_steps = Math.max(patch.maxSteps, 1);
  } else if (patch.actions) {
    values.max_steps = Math.max(patch.actions.length, 1);
  }

  if (statePatch) {
    const { data: existing } = await db
      .from("james_agent_tasks")
      .select("state")
      .eq("id", taskId)
      .eq("user_id", owner.userId)
      .eq("conversation_id", owner.conversationId)
      .maybeSingle();

    values.state = {
      ...(existing?.state && typeof existing.state === "object" ? existing.state : {}),
      ...statePatch,
    };
  }

  const { error } = await db
    .from("james_agent_tasks")
    .update(values)
    .eq("id", taskId)
    .eq("user_id", owner.userId)
    .eq("conversation_id", owner.conversationId);

  if (error) {
    console.warn("James agent task update unavailable:", error.message);
    return false;
  }

  return true;
}

export async function getLatestJamesAgentTask(userId: string, conversationId: string) {
  const db = getDb();
  if (!db || !safeId(userId) || !safeId(conversationId)) return null;

  const { data, error } = await db
    .from("james_agent_tasks")
    .select("id, user_id, conversation_id, request, status, current_step, max_steps, state, updated_at")
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .in("status", ["running", "paused"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const state = data.state && typeof data.state === "object"
    ? data.state as Record<string, unknown>
    : {};
  const rawActions = Array.isArray(state.actions) ? state.actions : [];
  const actions = rawActions.filter((item): item is JamesTaskAction =>
    Boolean(item && typeof item === "object" && typeof (item as JamesTaskAction).id === "string")
  );
  const outputs = state.outputs && typeof state.outputs === "object"
    ? state.outputs as Record<string, string>
    : {};

  return {
    id: data.id,
    userId: data.user_id,
    conversationId: data.conversation_id,
    request: data.request,
    status: data.status,
    currentStep: data.current_step,
    maxSteps: data.max_steps,
    actions,
    outputs,
    updatedAt: data.updated_at,
  } satisfies JamesAgentTaskState;
}

export async function getJamesAgentTask(
  taskId: string,
  owner: { userId: string; conversationId: string },
) {
  const db = getDb();
  if (
    !db ||
    !safeId(taskId) ||
    !safeId(owner.userId) ||
    !safeId(owner.conversationId)
  ) return null;

  const { data, error } = await db
    .from("james_agent_tasks")
    .select("id, user_id, conversation_id, request, status, current_step, max_steps, state, updated_at")
    .eq("id", taskId)
    .eq("user_id", owner.userId)
    .eq("conversation_id", owner.conversationId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn("James agent task read unavailable:", error.message);
    return null;
  }

  const state = data.state && typeof data.state === "object"
    ? data.state as Record<string, unknown>
    : {};

  const rawActions = Array.isArray(state.actions) ? state.actions : [];
  const actions = rawActions.filter((item): item is JamesTaskAction =>
    Boolean(item && typeof item === "object" && typeof (item as JamesTaskAction).id === "string")
  );

  const outputs = state.outputs && typeof state.outputs === "object"
    ? state.outputs as Record<string, string>
    : {};

  return {
    id: data.id,
    userId: data.user_id,
    conversationId: data.conversation_id,
    request: data.request,
    status: data.status,
    currentStep: data.current_step,
    maxSteps: data.max_steps,
    actions,
    outputs,
    updatedAt: data.updated_at,
  } satisfies JamesAgentTaskState;
}

export async function completeJamesAgentTask(
  taskId: string | null,
  owner: { userId: string; conversationId: string },
  outputs: Record<string, string>,
) {
  return updateJamesAgentTask(taskId, owner, {
    status: "completed",
    outputs,
  });
}

export async function failJamesAgentTask(
  taskId: string | null,
  owner: { userId: string; conversationId: string },
  outputs: Record<string, string>,
) {
  return updateJamesAgentTask(taskId, owner, {
    status: "failed",
    outputs,
  });
}

export function describeTaskPersistenceError(error: unknown) {
  return safeError(error);
}
