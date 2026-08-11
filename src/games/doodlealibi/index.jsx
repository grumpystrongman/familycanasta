import React from "react";
import "../../partyStage.css";
import "../../platform/party/showrunnerBootstrap";
import PartyStageGame from "../../platform/party/PartyStageGame";
import { PARTY_INTRO_VIDEOS } from "../../platform/party/introVideos";
import { DOODLE_CASES, doodleAlibiDefinition } from "./model";
import { DOODLE_EXTRA_CASES } from "./contentExpansion";

for (const item of DOODLE_EXTRA_CASES) {
  if (!DOODLE_CASES.some((existing) => existing.id === item.id)) DOODLE_CASES.push(item);
}

const definition = { ...doodleAlibiDefinition, introVideo: PARTY_INTRO_VIDEOS.doodlealibi };

export default function DoodleAlibiGame() {
  return <PartyStageGame definition={definition} />;
}
