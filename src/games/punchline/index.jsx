import React from "react";
import "../../partyStage.css";
import PartyStageGame from "../../platform/party/PartyStageGame";
import { PARTY_INTRO_VIDEOS } from "../../platform/party/introVideos";
import { punchlineDefinition } from "./model";

const definition = { ...punchlineDefinition, introVideo: PARTY_INTRO_VIDEOS.punchline };

export default function PunchlineGame() {
  return <PartyStageGame definition={definition} />;
}
