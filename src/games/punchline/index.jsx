import React from "react";
import "../../partyStage.css";
import PartyStageGame from "../../platform/party/PartyStageGame";
import { punchlineDefinition } from "./model";

export default function PunchlineGame() {
  return <PartyStageGame definition={punchlineDefinition} />;
}
