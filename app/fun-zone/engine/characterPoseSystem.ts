import type { CharacterDNA } from "./characterDNA";

export type CharacterPose = "idle" | "move" | "action" | "hit" | "talk";

export type CharacterPoseFrame = {
  pose: CharacterPose;
  identityKey: string;
  frameIndex: number;
  frameCount: number;
  transform: {
    dx: number;
    dy: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
  };
};

export type CharacterPoseSet = {
  identityKey: string;
  poses: Record<CharacterPose, CharacterPoseFrame[]>;
};

const DEFAULT_POSES: CharacterPose[] = ["idle", "move", "action", "hit", "talk"];

export function buildCharacterPoseSet(dna: CharacterDNA): CharacterPoseSet {
  const requested = dna.animationNeeds.length
    ? dna.animationNeeds
    : DEFAULT_POSES;

  const poses = {} as Record<CharacterPose, CharacterPoseFrame[]>;

  for (const pose of DEFAULT_POSES) {
    if (!requested.includes(pose) && pose !== "idle") continue;

    const frameCount = pose === "idle" || pose === "talk" ? 2 : 4;
    poses[pose] = Array.from({ length: frameCount }, (_, frameIndex) => {
      const phase = frameCount <= 1 ? 0 : frameIndex / (frameCount - 1);
      const wave = Math.sin(phase * Math.PI * 2);

      return {
        pose,
        identityKey: dna.identityKey,
        frameIndex,
        frameCount,
        transform: {
          dx: pose === "move" ? wave * 3 : 0,
          dy: pose === "idle" ? Math.abs(wave) * -2 : pose === "hit" ? 2 : 0,
          rotation: pose === "action" ? wave * 0.08 : pose === "hit" ? -0.05 : 0,
          scaleX: pose === "move" ? 1 + wave * 0.025 : 1,
          scaleY: pose === "idle" ? 1 + Math.abs(wave) * 0.018 : 1,
        },
      };
    });
  }

  return {
    identityKey: dna.identityKey,
    poses,
  };
}

export function selectCharacterPose(
  poseSet: CharacterPoseSet,
  pose: CharacterPose,
  elapsedMs: number,
): CharacterPoseFrame {
  const frames = poseSet.poses[pose] || poseSet.poses.idle;
  const index = Math.floor(elapsedMs / 120) % frames.length;
  return frames[index];
}
