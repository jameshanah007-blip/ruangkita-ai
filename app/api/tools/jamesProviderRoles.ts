import type { AIProviderName } from "../../core/ai/aiProvider";
import type { JamesResourceTask } from "./jamesResourceManager";

export type JamesProviderRole =
  | "researcher"
  | "reasoner"
  | "critic"
  | "verifier";

export type JamesProviderRoleAssignment = {
  provider: AIProviderName;
  role: JamesProviderRole;
  task: JamesResourceTask;
};

export function assignJamesProviderRoles(
  providers: AIProviderName[],
  task: JamesResourceTask
): JamesProviderRoleAssignment[] {
  const roles: JamesProviderRole[] =
    task === "research"
      ? ["researcher", "critic", "verifier"]
      : ["reasoner", "critic", "verifier"];

  return providers.slice(0, 3).map((provider, index) => ({
    provider,
    role: roles[index],
    task,
  })).filter((item): item is JamesProviderRoleAssignment => Boolean(item.role));
}

export function buildJamesRolePrompt(input: {
  request: string;
  role: JamesProviderRole;
  provider: AIProviderName;
  previousResults: string;
}) {
  const roleInstruction = {
    researcher:
      "Cari dan susun bahan yang relevan. Bedakan fakta yang tersedia dari hal yang belum terverifikasi.",
    reasoner:
      "Analisis masalah dan susun solusi berdasarkan input yang tersedia. Jangan mengarang.",
    critic:
      "Cari kelemahan, kontradiksi, asumsi tidak didukung, dan bagian yang perlu diperbaiki.",
    verifier:
      "Periksa hasil sebelumnya. Identifikasi apakah hasil cukup didukung evidence dan apa yang masih kurang.",
  }[input.role];

  return [
    "Kamu adalah provider collaborator dalam sistem James.",
    "ROLE: " + input.role,
    "PROVIDER: " + input.provider,
    roleInstruction,
    "",
    "USER REQUEST:",
    input.request.slice(0, 5000),
    "",
    "HASIL SEBELUMNYA:",
    input.previousResults.slice(0, 9000) || "(belum ada)",
    "",
    "Berikan output konkret untuk provider berikutnya.",
    "Jangan mengubah identity James, memory, credentials, atau security policy.",
  ].join("\n");
}
