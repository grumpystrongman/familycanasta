import React from "react";
import "../../partyStage.css";
import PartyStageGame from "../../platform/party/PartyStageGame";
import { PARTY_INTRO_VIDEOS } from "../../platform/party/introVideos";
import { doodleAlibiDefinition } from "./model";

const definition = { ...doodleAlibiDefinition, introVideo: PARTY_INTRO_VIDEOS.doodlealibi };

export default function DoodleAlibiGame() {
  return <PartyStageGame definition={definition} />;
}
