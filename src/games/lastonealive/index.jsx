import React from "react";
import "../../partyStage.css";
import PartyStageGame from "../../platform/party/PartyStageGame";
import { PARTY_INTRO_VIDEOS } from "../../platform/party/introVideos";
import { LAST_ONE_ALIVE_TRIVIA, lastOneAliveDefinition } from "./model";

const definition = { ...lastOneAliveDefinition, trivia: LAST_ONE_ALIVE_TRIVIA, introVideo: PARTY_INTRO_VIDEOS.lastonealive };

export default function LastOneAliveGame() {
  return <PartyStageGame definition={definition} />;
}
