import React from "react";
import PartyStageGame from "../../platform/party/PartyStageGame";
import { doodleAlibiDefinition } from "./model";

export default function DoodleAlibiGame() {
  return <PartyStageGame definition={doodleAlibiDefinition} />;
}
