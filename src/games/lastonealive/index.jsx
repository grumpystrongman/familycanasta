import React from "react";
import PartyStageGame from "../../platform/party/PartyStageGame";
import { LAST_ONE_ALIVE_TRIVIA, lastOneAliveDefinition } from "./model";

const definition = { ...lastOneAliveDefinition, trivia: LAST_ONE_ALIVE_TRIVIA };

export default function LastOneAliveGame() {
  return <PartyStageGame definition={definition} />;
}
